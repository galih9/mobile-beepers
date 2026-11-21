import * as Tone from "tone";
import { midiToFrequency } from "../constants/scalesAndNotes";
import type {
	ArpMode,
	Channel,
	InstrumentConfiguration,
	NoteEvent,
	WaveformType,
} from "../types/music";
import { getAudioAssetsForContext } from "./customWaveforms";
import { resolveRatchetCount } from "./noteRatchet";

const ARP_SEMITONE_TABLE: Record<ArpMode, Array<number>> = {
	none: [0],
	arpFast: [0, 4, 7],
	arpMedium: [0, 3, 7],
	octaveUp: [0, 12],
	fifth: [0, 7],
	majorChord: [0, 4, 7, 11],
	minorChord: [0, 3, 7, 10],
};

const hasWebAudioSupport = (): boolean => {
	return (
		typeof window !== "undefined" &&
		("AudioContext" in window || "webkitAudioContext" in window)
	);
};

const isOfflineAudioContext = (audioContext: BaseAudioContext): boolean => {
	return (
		(typeof OfflineAudioContext !== "undefined" &&
			audioContext instanceof OfflineAudioContext) ||
		"startRendering" in audioContext
	);
};

const resolveMidiFrequency = (midiNote: number): number => {
	try {
		return Tone.Frequency(midiNote, "midi").toFrequency();
	} catch {
		return midiToFrequency(midiNote);
	}
};

let liveMasterGainBus: Tone.Gain | null = null;
let liveMasterLimiter: Tone.Limiter | null = null;
let liveMasterWaveform: Tone.Waveform | null = null;

const ensureLiveMasterChain = (): Tone.Gain | null => {
	if (!hasWebAudioSupport()) {
		return null;
	}
	if (!liveMasterGainBus) {
		liveMasterGainBus = new Tone.Gain(1);
		liveMasterLimiter = new Tone.Limiter(-1);
		liveMasterWaveform = new Tone.Waveform(256);

		liveMasterGainBus.connect(liveMasterLimiter);
		liveMasterLimiter.connect(liveMasterWaveform);
		liveMasterLimiter.toDestination();
	}
	return liveMasterGainBus;
};

export const ensureToneStarted = async (): Promise<void> => {
	if (!hasWebAudioSupport()) {
		return;
	}
	try {
		await Tone.start();
		const toneContext = Tone.getContext();
		if (toneContext.state === "suspended") {
			await toneContext.resume();
		}
		ensureLiveMasterChain();
	} catch {
		// Ignore autoplay restrictions or missing browser AudioContext in tests
	}
};

export const getOrCreateLiveAudioContext = (): AudioContext => {
	const toneContext = Tone.getContext();
	if (toneContext.state === "suspended") {
		void toneContext.resume();
	}
	ensureLiveMasterChain();
	return toneContext.rawContext as AudioContext;
};

export const getLiveMasterInputNode = (): AudioNode => {
	const audioContext = getOrCreateLiveAudioContext();
	const masterBus = ensureLiveMasterChain();
	if (masterBus) {
		return masterBus.input;
	}
	return audioContext.destination;
};

export const readLiveWaveformData = (targetArray: Float32Array): void => {
	if (!liveMasterWaveform) {
		targetArray.fill(0);
		return;
	}
	const samples = liveMasterWaveform.getValue();
	const copyLength = Math.min(targetArray.length, samples.length);
	for (let index = 0; index < copyLength; index += 1) {
		targetArray[index] = samples[index] ?? 0;
	}
	for (let index = copyLength; index < targetArray.length; index += 1) {
		targetArray[index] = 0;
	}
};

/**
 * Offline renders share one echo network per destination + echo setting.
 * A per-note delay feedback loop is never torn down in an OfflineAudioContext,
 * so a song with hundreds of echoed notes would keep hundreds of loops running
 * for the whole render (WAV export appeared to hang). Echo is linear, so
 * summing notes into one shared network sounds identical.
 */
const offlineEchoNetworkCache = new WeakMap<
	AudioNode,
	Map<string, AudioNode>
>();

const createEchoNetwork = (
	audioContext: BaseAudioContext,
	destination: AudioNode,
	instrument: InstrumentConfiguration,
	totalLifeSeconds: number
): AudioNode => {
	if (instrument.echoMix <= 0.01) {
		return destination;
	}

	const isOffline = isOfflineAudioContext(audioContext);
	const cacheKey = `${Math.min(0.65, instrument.echoMix)}|${Math.max(
		0.05,
		Math.min(0.6, instrument.echoTimeSeconds)
	)}`;
	if (isOffline) {
		const cachedNetwork = offlineEchoNetworkCache
			.get(destination)
			?.get(cacheKey);
		if (cachedNetwork) {
			return cachedNetwork;
		}
	}

	const inputBus = audioContext.createGain();
	const dryGain = audioContext.createGain();
	const wetGain = audioContext.createGain();
	const delayNode = audioContext.createDelay(1.0);
	const feedbackGain = audioContext.createGain();
	const echoFilter = audioContext.createBiquadFilter();

	dryGain.gain.value = 1;
	wetGain.gain.value = Math.min(0.65, instrument.echoMix);
	delayNode.delayTime.value = Math.max(
		0.05,
		Math.min(0.6, instrument.echoTimeSeconds)
	);
	feedbackGain.gain.value = 0.28;
	echoFilter.type = "lowpass";
	echoFilter.frequency.value = 3400;

	inputBus.connect(dryGain);
	dryGain.connect(destination);

	inputBus.connect(delayNode);
	delayNode.connect(echoFilter);
	echoFilter.connect(wetGain);
	wetGain.connect(destination);

	echoFilter.connect(feedbackGain);
	feedbackGain.connect(delayNode);

	if (isOffline) {
		let networksForDestination = offlineEchoNetworkCache.get(destination);
		if (!networksForDestination) {
			networksForDestination = new Map();
			offlineEchoNetworkCache.set(destination, networksForDestination);
		}
		networksForDestination.set(cacheKey, inputBus);
		return inputBus;
	}

	// Disconnect delay feedback cleanly after tail decays in live AudioContext
	if (typeof window !== "undefined") {
		const cleanupDelayMs = Math.ceil((totalLifeSeconds + 1.2) * 1000);
		window.setTimeout(() => {
			feedbackGain.disconnect();
			delayNode.disconnect();
		}, cleanupDelayMs);
	}

	return inputBus;
};

const applyWaveformToOscillator = (
	audioContext: BaseAudioContext,
	oscillator: OscillatorNode,
	waveform: WaveformType
): void => {
	const assets = getAudioAssetsForContext(audioContext);
	switch (waveform) {
		case "pulse12": {
			oscillator.setPeriodicWave(assets.pulse12);
			return;
		}
		case "pulse25": {
			oscillator.setPeriodicWave(assets.pulse25);
			return;
		}
		case "pulse50": {
			oscillator.type = "square";
			return;
		}
		case "triangle": {
			oscillator.setPeriodicWave(assets.triangle4Bit);
			return;
		}
		case "sawtooth": {
			oscillator.type = "sawtooth";
			return;
		}
		default: {
			oscillator.type = "triangle";
		}
	}
};

const resolveEffectiveFade = (
	note: NoteEvent,
	instrument: InstrumentConfiguration
): number => {
	if (note.fadeMode === "fadeIn") {
		return -0.85;
	}
	if (note.fadeMode === "fadeOut") {
		return 0.85;
	}
	return Math.max(-1, Math.min(1, instrument.fadeInOut ?? 0));
};

const driveCurveCache = new WeakMap<
	BaseAudioContext,
	Map<number, Float32Array<ArrayBuffer>>
>();

const quantizeDriveAmount = (drive: number | undefined): number => {
	if (drive === undefined || !Number.isFinite(drive)) {
		return 0;
	}
	return Math.round(Math.max(0, Math.min(1, drive)) * 20) / 20;
};

/**
 * Builds a tanh soft-clip curve that progressively bit-crushes as drive rises:
 * 0.25 ≈ warm 8-bit grit, 0.6 ≈ reese / rave crunch, 0.9+ ≈ gabber-grade destruction.
 */
const getDriveCurve = (
	audioContext: BaseAudioContext,
	quantizedDrive: number
): Float32Array<ArrayBuffer> => {
	let contextCache = driveCurveCache.get(audioContext);
	if (!contextCache) {
		contextCache = new Map();
		driveCurveCache.set(audioContext, contextCache);
	}
	const cached = contextCache.get(quantizedDrive);
	if (cached) {
		return cached;
	}
	const sampleCount = 2048;
	const curve = new Float32Array(new ArrayBuffer(sampleCount * 4));
	const steepness = 1 + quantizedDrive * 11;
	const normalizer = Math.tanh(steepness);
	const crushLevels =
		quantizedDrive >= 0.1 ? Math.round(2 ** (8 - quantizedDrive * 4.6)) : 0;
	for (let index = 0; index < sampleCount; index += 1) {
		const x = (index / (sampleCount - 1)) * 2 - 1;
		let y = Math.tanh(steepness * x) / normalizer;
		if (crushLevels > 0) {
			y = Math.round(y * crushLevels) / crushLevels;
		}
		curve[index] = y;
	}
	contextCache.set(quantizedDrive, curve);
	return curve;
};

/**
 * Inserts an overdrive / bit-crush stage in front of `destination` when drive > 0.
 * Returns the node voices should connect into.
 */
const createDriveStage = (
	audioContext: BaseAudioContext,
	destination: AudioNode,
	drive: number | undefined
): AudioNode => {
	const amount = quantizeDriveAmount(drive);
	if (amount < 0.05) {
		return destination;
	}
	const shaper = audioContext.createWaveShaper();
	shaper.curve = getDriveCurve(audioContext, amount);
	shaper.oversample = "none";
	const makeupGain = audioContext.createGain();
	makeupGain.gain.value = 1 / (1 + amount * 0.9);
	shaper.connect(makeupGain);
	makeupGain.connect(destination);
	return shaper;
};

const BREAKCORE_KIT_PRESET_IDS = new Set([
	"breakcore-amen-kit",
	"breakcore-gabber-kick",
]);

/**
 * Breakcore breakbeat kit: tuned amen-style kick, cracking snare, ride tick,
 * splashy crash, breakbeat toms and a glitch zap. All voices honour pitchRatio
 * so pitch-bent drum notes / ratchet rolls rise and fall like resampled breaks.
 * Returns false for pads this kit does not override (they fall back to the 8-bit kit).
 */
const scheduleBreakcoreKitVoice = (
	audioContext: BaseAudioContext,
	voiceBus: AudioNode,
	pitch: number,
	startTime: number,
	pitchRatio: number,
	presetId: string
): boolean => {
	const assets = getAudioAssetsForContext(audioContext);
	const hz = (value: number): number =>
		Math.max(20, Math.min(18000, value * pitchRatio));
	const timeScale = 1 / Math.sqrt(Math.max(0.25, pitchRatio));

	const addNoise = (
		buffer: AudioBuffer,
		filterType: BiquadFilterType,
		frequency: number,
		q: number,
		level: number,
		decaySeconds: number
	): void => {
		const source = audioContext.createBufferSource();
		source.buffer = buffer;
		source.playbackRate.value = Math.max(0.25, Math.min(4, pitchRatio));
		const filter = audioContext.createBiquadFilter();
		filter.type = filterType;
		filter.frequency.setValueAtTime(hz(frequency), startTime);
		filter.Q.value = q;
		const gain = audioContext.createGain();
		const decay = decaySeconds * timeScale;
		gain.gain.setValueAtTime(level, startTime);
		gain.gain.exponentialRampToValueAtTime(0.001, startTime + decay);
		source.connect(filter);
		filter.connect(gain);
		gain.connect(voiceBus);
		source.start(startTime);
		source.stop(startTime + decay + 0.02);
	};

	const addTone = (
		type: OscillatorType | "pulse25",
		fromFrequency: number,
		toFrequency: number,
		sweepSeconds: number,
		level: number,
		decaySeconds: number,
		holdSeconds = 0
	): void => {
		const oscillator = audioContext.createOscillator();
		if (type === "pulse25") {
			oscillator.setPeriodicWave(assets.pulse25);
		} else {
			oscillator.type = type;
		}
		oscillator.frequency.setValueAtTime(hz(fromFrequency), startTime);
		oscillator.frequency.exponentialRampToValueAtTime(
			hz(toFrequency),
			startTime + sweepSeconds * timeScale
		);
		const gain = audioContext.createGain();
		const decay = decaySeconds * timeScale;
		gain.gain.setValueAtTime(level, startTime);
		if (holdSeconds > 0) {
			gain.gain.setValueAtTime(level, startTime + holdSeconds * timeScale);
		}
		gain.gain.exponentialRampToValueAtTime(
			0.001,
			startTime + holdSeconds * timeScale + decay
		);
		oscillator.connect(gain);
		gain.connect(voiceBus);
		oscillator.start(startTime);
		oscillator.stop(startTime + holdSeconds * timeScale + decay + 0.02);
	};

	if (pitch === 0) {
		if (presetId === "breakcore-gabber-kick") {
			// Hardcore "doef": fast pitch dive into a held, tonal ~58 Hz body that the
			// channel overdrive turns into a distorted gabber kick.
			addTone("triangle", 310, 58, 0.05, 1.15, 0.2, 0.16);
			addTone("square", 155, 56, 0.05, 0.32, 0.16, 0.12);
			addNoise(assets.whiteNoiseBuffer, "bandpass", 2600, 0.9, 0.55, 0.012);
			return true;
		}
		// Punchy tuned breakbeat kick with a crisp transient
		addTone("sine", 190, 47, 0.075, 1.2, 0.24);
		addTone("triangle", 120, 50, 0.04, 0.45, 0.09);
		addNoise(assets.whiteNoiseBuffer, "bandpass", 3400, 1.1, 0.5, 0.014);
		return true;
	}

	if (pitch === 1) {
		// Amen-style cracking snare: two tuned shells + bright noise snap
		addTone("triangle", 330, 185, 0.05, 0.85, 0.085);
		addTone("pulse25", 520, 300, 0.03, 0.18, 0.05);
		addNoise(assets.whiteNoiseBuffer, "bandpass", 4200, 0.65, 1.0, 0.13);
		addNoise(assets.whiteNoiseBuffer, "highpass", 7200, 0.7, 0.35, 0.06);
		return true;
	}

	if (pitch === 2) {
		// Ride / hat tick with a faint bell ping
		addNoise(assets.metallicNoiseBuffer, "highpass", 7600, 0.8, 0.55, 0.035);
		addTone("pulse25", 3150, 3050, 0.05, 0.05, 0.09);
		return true;
	}

	if (pitch === 3) {
		// Splashy noise crash
		addNoise(assets.whiteNoiseBuffer, "highpass", 4300, 0.6, 0.6, 0.85);
		addNoise(assets.metallicNoiseBuffer, "bandpass", 8200, 0.9, 0.42, 0.6);
		return true;
	}

	if (pitch === 4 || pitch === 5) {
		// Breakbeat toms
		const base = pitch === 4 ? 205 : 290;
		addTone("triangle", base, base * 0.52, 0.14, 0.9, 0.2);
		addNoise(assets.whiteNoiseBuffer, "bandpass", base * 4.2, 1.4, 0.22, 0.05);
		return true;
	}

	if (pitch === 7) {
		// Glitch zap: sawtooth laser dive
		addTone("sawtooth", 2600, 85, 0.075, 0.5, 0.1);
		addTone("pulse25", 1300, 60, 0.06, 0.22, 0.08);
		return true;
	}

	return false;
};

const scheduleDrumHit = (
	audioContext: BaseAudioContext,
	destination: AudioNode,
	pitch: number,
	startTime: number,
	velocity: number,
	instrument: InstrumentConfiguration,
	effectiveFade: number,
	filterCutoff?: number,
	filterSweepTo?: number,
	pitchRatio = 1
): void => {
	const assets = getAudioAssetsForContext(audioContext);
	const panner = audioContext.createStereoPanner();
	panner.pan.setValueAtTime(instrument.pan, startTime);

	const masterGain = audioContext.createGain();
	const peakLevel = Math.max(0.02, instrument.volume * velocity * 0.55);
	if (effectiveFade < -0.02) {
		const fadeInDuration = Math.min(0.16, 0.14 * Math.abs(effectiveFade));
		masterGain.gain.setValueAtTime(0.001, startTime);
		masterGain.gain.linearRampToValueAtTime(
			peakLevel,
			startTime + fadeInDuration
		);
	} else if (effectiveFade > 0.02) {
		masterGain.gain.setValueAtTime(peakLevel, startTime);
		masterGain.gain.exponentialRampToValueAtTime(
			Math.max(0.001, peakLevel * (1 - effectiveFade * 0.92)),
			startTime + 0.14
		);
	} else {
		masterGain.gain.setValueAtTime(peakLevel, startTime);
	}
	if (filterCutoff !== undefined) {
		const drumFilter = audioContext.createBiquadFilter();
		drumFilter.type = "lowpass";
		const clampedStart = Math.max(180, Math.min(14000, filterCutoff));
		drumFilter.frequency.setValueAtTime(clampedStart, startTime);
		drumFilter.Q.value = 1.6;
		if (filterSweepTo !== undefined) {
			const clampedEnd = Math.max(180, Math.min(14000, filterSweepTo));
			drumFilter.frequency.exponentialRampToValueAtTime(
				clampedEnd,
				startTime + 0.18
			);
		}
		masterGain.connect(drumFilter);
		drumFilter.connect(panner);
	} else {
		masterGain.connect(panner);
	}
	panner.connect(destination);

	// Voices feed the optional overdrive / bit-crush stage before the velocity gain
	const voiceBus = createDriveStage(audioContext, masterGain, instrument.drive);

	if (
		BREAKCORE_KIT_PRESET_IDS.has(instrument.presetId) &&
		scheduleBreakcoreKitVoice(
			audioContext,
			voiceBus,
			pitch,
			startTime,
			pitchRatio,
			instrument.presetId
		)
	) {
		return;
	}

	// Pitch-shift helper for the classic kit (drum notes honour pitchBend in semitones)
	const hz = (value: number): number =>
		Math.max(20, Math.min(18000, value * pitchRatio));

	if (pitch === 0) {
		if (instrument.presetId === "minimal-house-kick") {
			// Punchy retro pulse/noise minimal house kick
			const subOscillator = audioContext.createOscillator();
			const subGain = audioContext.createGain();
			subOscillator.type = "triangle";
			subOscillator.frequency.setValueAtTime(hz(155), startTime);
			subOscillator.frequency.exponentialRampToValueAtTime(
				hz(42),
				startTime + 0.095
			);
			subGain.gain.setValueAtTime(1.05, startTime);
			subGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.2);
			subOscillator.connect(subGain);
			subGain.connect(voiceBus);
			subOscillator.start(startTime);
			subOscillator.stop(startTime + 0.21);

			// Low-frequency 25% pulse body for classic chiptune weight
			const pulseOscillator = audioContext.createOscillator();
			const pulseFilter = audioContext.createBiquadFilter();
			const pulseGain = audioContext.createGain();
			pulseOscillator.setPeriodicWave(assets.pulse25);
			pulseOscillator.frequency.setValueAtTime(hz(125), startTime);
			pulseOscillator.frequency.exponentialRampToValueAtTime(
				hz(46),
				startTime + 0.055
			);
			pulseFilter.type = "lowpass";
			pulseFilter.frequency.setValueAtTime(hz(380), startTime);
			pulseGain.gain.setValueAtTime(0.42, startTime);
			pulseGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.085);
			pulseOscillator.connect(pulseFilter);
			pulseFilter.connect(pulseGain);
			pulseGain.connect(voiceBus);
			pulseOscillator.start(startTime);
			pulseOscillator.stop(startTime + 0.095);

			// Crisp 16ms LFSR noise transient click for house punch
			const clickSource = audioContext.createBufferSource();
			clickSource.buffer = assets.whiteNoiseBuffer;
			clickSource.playbackRate.value = Math.max(0.25, Math.min(4, pitchRatio));
			const clickFilter = audioContext.createBiquadFilter();
			clickFilter.type = "bandpass";
			clickFilter.frequency.setValueAtTime(hz(1850), startTime);
			const clickGain = audioContext.createGain();
			clickGain.gain.setValueAtTime(0.36, startTime);
			clickGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.016);
			clickSource.connect(clickFilter);
			clickFilter.connect(clickGain);
			clickGain.connect(voiceBus);
			clickSource.start(startTime);
			clickSource.stop(startTime + 0.02);
			return;
		}

		// 8-bit Kick
		const oscillator = audioContext.createOscillator();
		const kickGain = audioContext.createGain();
		oscillator.type = "triangle";
		oscillator.frequency.setValueAtTime(hz(165), startTime);
		oscillator.frequency.exponentialRampToValueAtTime(hz(42), startTime + 0.12);
		kickGain.gain.setValueAtTime(1.1, startTime);
		kickGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.18);
		oscillator.connect(kickGain);
		kickGain.connect(voiceBus);
		oscillator.start(startTime);
		oscillator.stop(startTime + 0.19);
		return;
	}

	if (pitch === 1) {
		// Snare: Noise + pitch-swept body
		const noiseSource = audioContext.createBufferSource();
		noiseSource.buffer = assets.whiteNoiseBuffer;
		noiseSource.playbackRate.value = Math.max(0.25, Math.min(4, pitchRatio));
		const noiseFilter = audioContext.createBiquadFilter();
		noiseFilter.type = "bandpass";
		noiseFilter.frequency.setValueAtTime(hz(2200), startTime);
		const noiseGain = audioContext.createGain();
		noiseGain.gain.setValueAtTime(0.85, startTime);
		noiseGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.16);
		noiseSource.connect(noiseFilter);
		noiseFilter.connect(noiseGain);
		noiseGain.connect(voiceBus);
		noiseSource.start(startTime);
		noiseSource.stop(startTime + 0.17);

		const bodyOscillator = audioContext.createOscillator();
		const bodyGain = audioContext.createGain();
		bodyOscillator.type = "triangle";
		bodyOscillator.frequency.setValueAtTime(hz(220), startTime);
		bodyOscillator.frequency.exponentialRampToValueAtTime(
			hz(95),
			startTime + 0.08
		);
		bodyGain.gain.setValueAtTime(0.7, startTime);
		bodyGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.1);
		bodyOscillator.connect(bodyGain);
		bodyGain.connect(voiceBus);
		bodyOscillator.start(startTime);
		bodyOscillator.stop(startTime + 0.11);
		return;
	}

	if (pitch === 2 || pitch === 3) {
		// Closed (2) or Open (3) Metallic Hi-Hat
		const isHouseHats = instrument.presetId === "minimal-house-hats";
		const decaySeconds = isHouseHats
			? pitch === 2
				? 0.045
				: 0.175
			: pitch === 2
				? 0.055
				: 0.24;
		const noiseSource = audioContext.createBufferSource();
		noiseSource.buffer = assets.metallicNoiseBuffer;
		noiseSource.playbackRate.value = Math.max(0.25, Math.min(4, pitchRatio));
		const highPass = audioContext.createBiquadFilter();
		highPass.type = "highpass";
		highPass.frequency.setValueAtTime(hz(isHouseHats ? 6200 : 5200), startTime);
		const hatGain = audioContext.createGain();
		hatGain.gain.setValueAtTime(isHouseHats ? 0.58 : 0.55, startTime);
		hatGain.gain.exponentialRampToValueAtTime(0.001, startTime + decaySeconds);
		noiseSource.connect(highPass);
		highPass.connect(hatGain);
		hatGain.connect(voiceBus);
		noiseSource.start(startTime);
		noiseSource.stop(startTime + decaySeconds + 0.02);
		return;
	}

	if (pitch === 4 || pitch === 5) {
		// Low (4) / High (5) Chip Tom
		const startFrequency = pitch === 4 ? 175 : 285;
		const endFrequency = pitch === 4 ? 75 : 135;
		const tomOscillator = audioContext.createOscillator();
		const tomGain = audioContext.createGain();
		tomOscillator.setPeriodicWave(assets.pulse25);
		tomOscillator.frequency.setValueAtTime(hz(startFrequency), startTime);
		tomOscillator.frequency.exponentialRampToValueAtTime(
			hz(endFrequency),
			startTime + 0.15
		);
		tomGain.gain.setValueAtTime(0.7, startTime);
		tomGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.17);
		tomOscillator.connect(tomGain);
		tomGain.connect(voiceBus);
		tomOscillator.start(startTime);
		tomOscillator.stop(startTime + 0.18);
		return;
	}

	if (pitch === 6) {
		// Retro Multi-Burst Clap
		const noiseSource = audioContext.createBufferSource();
		noiseSource.buffer = assets.whiteNoiseBuffer;
		noiseSource.playbackRate.value = Math.max(0.25, Math.min(4, pitchRatio));
		const bandPass = audioContext.createBiquadFilter();
		bandPass.type = "bandpass";
		bandPass.frequency.setValueAtTime(hz(1600), startTime);
		const clapGain = audioContext.createGain();
		clapGain.gain.setValueAtTime(0.01, startTime);
		clapGain.gain.setValueAtTime(0.85, startTime + 0.002);
		clapGain.gain.setValueAtTime(0.15, startTime + 0.018);
		clapGain.gain.setValueAtTime(0.8, startTime + 0.028);
		clapGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.19);
		noiseSource.connect(bandPass);
		bandPass.connect(clapGain);
		clapGain.connect(voiceBus);
		noiseSource.start(startTime);
		noiseSource.stop(startTime + 0.2);
		return;
	}

	// Pitch 7: Classic 8-bit Coin / Blip FX
	const blipOscillator = audioContext.createOscillator();
	const blipGain = audioContext.createGain();
	blipOscillator.setPeriodicWave(assets.pulse25);
	blipOscillator.frequency.setValueAtTime(hz(987.77), startTime);
	blipOscillator.frequency.setValueAtTime(hz(1318.51), startTime + 0.055);
	blipGain.gain.setValueAtTime(0.55, startTime);
	blipGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.22);
	blipOscillator.connect(blipGain);
	blipGain.connect(voiceBus);
	blipOscillator.start(startTime);
	blipOscillator.stop(startTime + 0.23);
};

export const scheduleChannelNote = (
	audioContext: BaseAudioContext,
	destination: AudioNode,
	note: NoteEvent,
	channel: Channel,
	startTime: number,
	stepDurationSeconds: number
): void => {
	// Micro-timing nudge: shift the whole note slightly off the step grid.
	// Never schedule before "now" (live) or before the render start (offline).
	const timingOffsetSteps = note.timingOffset ?? 0;
	if (timingOffsetSteps !== 0 && Number.isFinite(timingOffsetSteps)) {
		const shiftedStartTime = Math.max(
			audioContext.currentTime,
			startTime + timingOffsetSteps * stepDurationSeconds
		);
		scheduleChannelNote(
			audioContext,
			destination,
			{ ...note, timingOffset: 0 },
			channel,
			shiftedStartTime,
			stepDurationSeconds
		);
		return;
	}

	const instrument = channel.instrument;
	const isDrumVoice =
		channel.type === "drum" || instrument.waveform === "retroKit";

	// Ratchet / stutter: retrigger the note N times across its length.
	// A pitch bend on a ratcheted note becomes a stepped riser (or faller) across the hits.
	const ratchetCount = resolveRatchetCount(note.ratchet);
	if (ratchetCount > 1) {
		const totalSeconds = Math.max(0.04, note.duration * stepDurationSeconds);
		const subDurationSeconds = totalSeconds / ratchetCount;
		for (let hitIndex = 0; hitIndex < ratchetCount; hitIndex += 1) {
			const progress = hitIndex / (ratchetCount - 1);
			const bendOffset = note.pitchBend * progress;
			const subNote: NoteEvent = {
				...note,
				ratchet: 1,
				duration: 1,
				pitch: isDrumVoice ? note.pitch : note.pitch + Math.round(bendOffset),
				pitchBend: isDrumVoice ? bendOffset : 0,
				velocity: Math.max(
					0.1,
					note.velocity * (hitIndex === 0 ? 1 : 0.9 + 0.1 * progress)
				),
			};
			scheduleChannelNote(
				audioContext,
				destination,
				subNote,
				channel,
				startTime + hitIndex * subDurationSeconds,
				subDurationSeconds
			);
		}
		return;
	}

	const effectiveFade = resolveEffectiveFade(note, instrument);
	if (isDrumVoice) {
		scheduleDrumHit(
			audioContext,
			destination,
			note.pitch,
			startTime,
			note.velocity,
			instrument,
			effectiveFade,
			note.filterCutoff,
			note.filterSweepTo,
			note.pitchBend === 0 ? 1 : 2 ** (note.pitchBend / 12)
		);
		return;
	}

	const noteDurationSeconds = Math.max(
		0.04,
		note.duration * stepDurationSeconds
	);
	const attack = Math.max(0.003, instrument.attack);
	const decay = Math.max(0.01, instrument.decay);
	const release = Math.max(0.015, instrument.release);
	const sustainLevel = Math.max(0.02, instrument.sustain);
	const stopTime = startTime + noteDurationSeconds + release + 0.02;

	const baseFrequency = resolveMidiFrequency(note.pitch);
	const peakGain = Math.max(0.01, instrument.volume * note.velocity * 0.34);

	const envelopeGain = audioContext.createGain();
	envelopeGain.gain.setValueAtTime(0.0001, startTime);
	if (effectiveFade < -0.02) {
		const fadeInDuration = Math.max(
			0.02,
			noteDurationSeconds * Math.min(1, Math.abs(effectiveFade))
		);
		if (fadeInDuration < noteDurationSeconds - 0.005) {
			envelopeGain.gain.linearRampToValueAtTime(
				peakGain,
				startTime + fadeInDuration
			);
			envelopeGain.gain.linearRampToValueAtTime(
				Math.max(0.0001, peakGain * sustainLevel),
				startTime + noteDurationSeconds
			);
		} else {
			envelopeGain.gain.linearRampToValueAtTime(
				peakGain,
				startTime + noteDurationSeconds
			);
		}
		envelopeGain.gain.exponentialRampToValueAtTime(
			0.0001,
			startTime + noteDurationSeconds + release
		);
	} else if (effectiveFade > 0.02) {
		envelopeGain.gain.linearRampToValueAtTime(peakGain, startTime + attack);
		const fadeTarget = Math.max(0.0001, peakGain * (1 - effectiveFade * 0.95));
		envelopeGain.gain.exponentialRampToValueAtTime(
			fadeTarget,
			startTime + Math.max(attack + 0.01, noteDurationSeconds)
		);
		envelopeGain.gain.exponentialRampToValueAtTime(
			0.0001,
			startTime + noteDurationSeconds + release
		);
	} else {
		// Keep attack/decay inside the note so short (fast-tempo or ratcheted) notes
		// never schedule their decay after the release, which caused a re-swell + click.
		const attackEnd = Math.min(attack, noteDurationSeconds * 0.6);
		const decayEnd = Math.max(
			attackEnd + 0.002,
			Math.min(attack + decay, noteDurationSeconds)
		);
		envelopeGain.gain.linearRampToValueAtTime(
			peakGain,
			startTime + attackEnd
		);
		envelopeGain.gain.exponentialRampToValueAtTime(
			Math.max(0.0001, peakGain * sustainLevel),
			startTime + decayEnd
		);
		envelopeGain.gain.setValueAtTime(
			Math.max(0.0001, peakGain * sustainLevel),
			startTime + noteDurationSeconds
		);
		envelopeGain.gain.exponentialRampToValueAtTime(
			0.0001,
			startTime + noteDurationSeconds + release
		);
	}

	const startCutoff = Math.max(
		180,
		Math.min(14000, note.filterCutoff ?? instrument.filterCutoff)
	);
	const lowPassFilter = audioContext.createBiquadFilter();
	lowPassFilter.type = "lowpass";
	lowPassFilter.frequency.setValueAtTime(startCutoff, startTime);
	lowPassFilter.Q.value =
		note.filterCutoff !== undefined || note.filterSweepTo !== undefined
			? 2.2
			: 1.1;
	if (note.filterSweepTo !== undefined) {
		const endCutoff = Math.max(180, Math.min(14000, note.filterSweepTo));
		lowPassFilter.frequency.exponentialRampToValueAtTime(
			endCutoff,
			startTime + Math.max(0.03, noteDurationSeconds)
		);
	}

	const panner = audioContext.createStereoPanner();
	panner.pan.setValueAtTime(instrument.pan, startTime);

	const outputBus = createEchoNetwork(
		audioContext,
		destination,
		instrument,
		noteDurationSeconds + release
	);

	envelopeGain.connect(lowPassFilter);
	lowPassFilter.connect(panner);
	panner.connect(outputBus);

	// Oscillators run through the optional overdrive / bit-crush before the envelope
	const oscillatorBus = createDriveStage(
		audioContext,
		envelopeGain,
		instrument.drive
	);

	const oscillators: Array<OscillatorNode> = [];
	const arpOffsets = ARP_SEMITONE_TABLE[instrument.arpMode];

	if (instrument.waveform === "fm") {
		const carrier = audioContext.createOscillator();
		const modulator = audioContext.createOscillator();
		const modulatorGain = audioContext.createGain();

		carrier.type = "sine";
		modulator.type = "sine";
		carrier.frequency.setValueAtTime(baseFrequency, startTime);
		modulator.frequency.setValueAtTime(baseFrequency * 2, startTime);
		modulatorGain.gain.setValueAtTime(baseFrequency * 1.9, startTime);
		modulatorGain.gain.exponentialRampToValueAtTime(
			Math.max(1, baseFrequency * 0.25),
			startTime + noteDurationSeconds
		);

		modulator.connect(modulatorGain);
		modulatorGain.connect(carrier.frequency);
		carrier.connect(oscillatorBus);

		modulator.start(startTime);
		modulator.stop(stopTime);
		oscillators.push(carrier);
	} else if (instrument.waveform === "supersaw") {
		const detuneOffsets = [-16, 0, 16];
		detuneOffsets.forEach((offsetCents) => {
			const oscillator = audioContext.createOscillator();
			const subGain = audioContext.createGain();
			oscillator.type = "sawtooth";
			oscillator.frequency.setValueAtTime(baseFrequency, startTime);
			oscillator.detune.setValueAtTime(
				offsetCents + instrument.detuneCents,
				startTime
			);
			subGain.gain.value = 0.36;
			oscillator.connect(subGain);
			subGain.connect(oscillatorBus);
			oscillators.push(oscillator);
		});
	} else {
		const oscillator = audioContext.createOscillator();
		applyWaveformToOscillator(audioContext, oscillator, instrument.waveform);
		oscillator.frequency.setValueAtTime(baseFrequency, startTime);
		oscillator.detune.setValueAtTime(instrument.detuneCents, startTime);
		oscillator.connect(oscillatorBus);
		oscillators.push(oscillator);
	}

	// Vibrato LFO
	if (instrument.vibratoDepth > 0.5) {
		const vibratoOscillator = audioContext.createOscillator();
		const vibratoGain = audioContext.createGain();
		vibratoOscillator.frequency.setValueAtTime(
			instrument.vibratoSpeed,
			startTime
		);
		vibratoGain.gain.setValueAtTime(instrument.vibratoDepth, startTime);
		vibratoOscillator.connect(vibratoGain);
		oscillators.forEach((oscillator) => {
			vibratoGain.connect(oscillator.detune);
		});
		vibratoOscillator.start(startTime);
		vibratoOscillator.stop(stopTime);
	}

	// Pitch slide automation & chiptune arpeggio stepping
	oscillators.forEach((oscillator) => {
		if (note.pitchBend !== 0) {
			const targetFrequency = resolveMidiFrequency(note.pitch + note.pitchBend);
			if (note.bendStyle === "early" && note.duration >= 2) {
				const bendStart =
					startTime +
					Math.min(noteDurationSeconds * 0.25, stepDurationSeconds * 0.35);
				const bendEnd =
					startTime +
					Math.min(noteDurationSeconds * 0.85, stepDurationSeconds * 1.35);
				oscillator.frequency.setValueAtTime(baseFrequency, bendStart);
				oscillator.frequency.linearRampToValueAtTime(
					targetFrequency,
					Math.max(bendStart + 0.01, bendEnd)
				);
			} else if (
				(note.bendStyle === "late" || !note.bendStyle) &&
				note.duration > 2
			) {
				const bendStart =
					startTime +
					Math.max(
						stepDurationSeconds * 0.5,
						noteDurationSeconds - stepDurationSeconds * 1.6
					);
				oscillator.frequency.setValueAtTime(baseFrequency, bendStart);
				oscillator.frequency.linearRampToValueAtTime(
					targetFrequency,
					Math.max(bendStart + 0.01, startTime + noteDurationSeconds)
				);
			} else {
				oscillator.frequency.linearRampToValueAtTime(
					targetFrequency,
					startTime + noteDurationSeconds
				);
			}
		} else if (arpOffsets.length > 1) {
			const arpStepSeconds = 0.045;
			const totalArpSteps = Math.floor(noteDurationSeconds / arpStepSeconds);
			for (let index = 0; index <= totalArpSteps; index += 1) {
				const semitoneOffset = arpOffsets[index % arpOffsets.length] ?? 0;
				const arpFrequency = resolveMidiFrequency(note.pitch + semitoneOffset);
				oscillator.frequency.setValueAtTime(
					arpFrequency,
					startTime + index * arpStepSeconds
				);
			}
		}

		oscillator.start(startTime);
		oscillator.stop(stopTime);
	});
};

export const playPreviewNote = (
	pitch: number,
	channel: Channel,
	noteOverrides?: Partial<NoteEvent>,
	stepDurationSeconds = 0.12
): void => {
	if (!hasWebAudioSupport()) {
		return;
	}
	void ensureToneStarted();
	const audioContext = getOrCreateLiveAudioContext();
	const previewGain = audioContext.createGain();
	previewGain.gain.value = 0.85;
	previewGain.connect(getLiveMasterInputNode());

	const previewNote: NoteEvent = {
		id: "preview",
		step: 0,
		pitch,
		duration: noteOverrides?.duration ?? 1.5,
		velocity: noteOverrides?.velocity ?? 0.9,
		pitchBend: noteOverrides?.pitchBend ?? 0,
		bendStyle: noteOverrides?.bendStyle,
		fadeMode: noteOverrides?.fadeMode,
	};

	scheduleChannelNote(
		audioContext,
		previewGain,
		previewNote,
		channel,
		audioContext.currentTime + 0.005,
		stepDurationSeconds
	);
};

import * as Tone from "tone";
import { midiToFrequency } from "../constants/scalesAndNotes";
import type {
	ArpMode,
	Channel,
	InstrumentConfiguration,
	NoteEvent,
	WaveformType,
} from "../types/music";
import {
	buildOrnamentPitchEvents,
	DEFAULT_PLAYBACK_CONTEXT,
	resolveArticulationShape,
	type NotePlaybackContext,
} from "./articulation";
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

/**
 * Shared cinematic hall reverb. Every note on a channel with `reverbMix > 0`
 * sends a copy of its sound into ONE convolver per destination (live master or
 * offline render bus), so long ambient tails cost the same as a single effect.
 */
const HALL_REVERB_SECONDS = 3.4;
const HALL_PRE_DELAY_SECONDS = 0.022;
const hallImpulseCache = new WeakMap<BaseAudioContext, AudioBuffer>();
const reverbBusCache = new WeakMap<AudioNode, AudioNode>();

/** Small deterministic PRNG so every render of the impulse is identical */
const createSeededRandom = (seed: number): (() => number) => {
	let state = seed >>> 0;
	return (): number => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

/**
 * Builds a stereo hall impulse: short pre-delay, a few early reflections, then
 * a decorrelated noise tail that decays ~60 dB over HALL_REVERB_SECONDS and
 * darkens over time (air absorbs the highs first), like a stone hall.
 */
const getHallImpulse = (audioContext: BaseAudioContext): AudioBuffer => {
	const cached = hallImpulseCache.get(audioContext);
	if (cached) {
		return cached;
	}
	const sampleRate = audioContext.sampleRate;
	const frameCount = Math.floor(sampleRate * HALL_REVERB_SECONDS);
	const preDelayFrames = Math.floor(sampleRate * HALL_PRE_DELAY_SECONDS);
	const buffer = audioContext.createBuffer(2, frameCount, sampleRate);
	const decayRate = 6.9 / HALL_REVERB_SECONDS;
	const fadeOutFrames = Math.floor(sampleRate * 0.12);
	const earlyReflections: Array<[seconds: number, gain: number]> = [
		[0.011, 0.5],
		[0.019, 0.38],
		[0.027, 0.32],
		[0.041, 0.26],
		[0.058, 0.2],
		[0.079, 0.15],
	];
	for (let channelIndex = 0; channelIndex < 2; channelIndex += 1) {
		const data = buffer.getChannelData(channelIndex);
		const random = createSeededRandom(0x5eed + channelIndex * 7919);
		let lowPassState = 0;
		for (let frame = preDelayFrames; frame < frameCount; frame += 1) {
			const seconds = (frame - preDelayFrames) / sampleRate;
			const envelope = Math.exp(-seconds * decayRate);
			// One-pole low-pass whose cutoff falls as the tail ages
			const damping = Math.min(0.86, 0.18 + seconds * 0.32);
			lowPassState += (1 - damping) * (random() * 2 - 1 - lowPassState);
			let sample = lowPassState * envelope;
			// Soft swell-in of the dense tail so the onset is not a hard click
			sample *= Math.min(1, seconds / 0.06);
			const framesLeft = frameCount - frame;
			if (framesLeft < fadeOutFrames) {
				sample *= framesLeft / fadeOutFrames;
			}
			data[frame] = sample;
		}
		earlyReflections.forEach(([seconds, gain], index) => {
			const offset = Math.floor(
				(HALL_PRE_DELAY_SECONDS + seconds * (channelIndex === 0 ? 1 : 1.13)) *
					sampleRate
			);
			if (offset < frameCount) {
				const sign = (index + channelIndex) % 2 === 0 ? 1 : -1;
				data[offset] = (data[offset] ?? 0) + gain * sign;
			}
		});
	}
	hallImpulseCache.set(audioContext, buffer);
	return buffer;
};

/** Returns (creating once per destination) the input of the shared hall reverb. */
const getReverbBus = (
	audioContext: BaseAudioContext,
	destination: AudioNode
): AudioNode | null => {
	if (typeof audioContext.createConvolver !== "function") {
		return null;
	}
	const cached = reverbBusCache.get(destination);
	if (cached) {
		return cached;
	}
	const inputBus = audioContext.createGain();
	// Keep the low end out of the tail so pads and basses don't turn to mud
	const lowCut = audioContext.createBiquadFilter();
	lowCut.type = "highpass";
	lowCut.frequency.value = 180;
	const highCut = audioContext.createBiquadFilter();
	highCut.type = "lowpass";
	highCut.frequency.value = 7000;
	const convolver = audioContext.createConvolver();
	convolver.normalize = true;
	convolver.buffer = getHallImpulse(audioContext);
	const wetGain = audioContext.createGain();
	wetGain.gain.value = 0.9;
	inputBus.connect(lowCut);
	lowCut.connect(highCut);
	highCut.connect(convolver);
	convolver.connect(wetGain);
	wetGain.connect(destination);
	reverbBusCache.set(destination, inputBus);
	return inputBus;
};

/**
 * Per-channel "punch" glue bus: every note of a channel with `punch > 0` runs
 * through ONE shared compressor (+ make-up gain) for that channel, the way a
 * breakcore producer squashes a whole break on its own bus — transients slam,
 * ghost notes come up, and the kit sounds like one fat sampled break.
 */
const punchBusCache = new WeakMap<AudioNode, Map<string, AudioNode>>();
/** Punch bus input → the destination it feeds (so reverb sends skip the compressor) */
const punchBusRoot = new WeakMap<AudioNode, AudioNode>();

/** Fixed level notes are driven into a punch bus at (the fader sets the output) */
const PUNCH_INPUT_VOLUME = 0.85;

const isPunchActive = (instrument: InstrumentConfiguration): boolean =>
	(instrument.punch ?? 0) >= 0.05;

const punchCeilingCache = new WeakMap<
	BaseAudioContext,
	Float32Array<ArrayBuffer>
>();
/** y = c·tanh(2u / c) on u ∈ [-1, 1] (input pre-scaled by 0.5): linear when quiet, ≤ 0.8 out */
const getPunchCeilingCurve = (
	audioContext: BaseAudioContext
): Float32Array<ArrayBuffer> => {
	const cached = punchCeilingCache.get(audioContext);
	if (cached) {
		return cached;
	}
	const ceilingLevel = 0.8;
	const sampleCount = 2049;
	const curve = new Float32Array(new ArrayBuffer(sampleCount * 4));
	for (let index = 0; index < sampleCount; index += 1) {
		const u = (index / (sampleCount - 1)) * 2 - 1;
		curve[index] = ceilingLevel * Math.tanh((2 * u) / ceilingLevel);
	}
	punchCeilingCache.set(audioContext, curve);
	return curve;
};

const resolvePunchDestination = (
	audioContext: BaseAudioContext,
	destination: AudioNode,
	channel: Channel
): AudioNode => {
	const amount = Math.max(0, Math.min(1, channel.instrument.punch ?? 0));
	if (
		!isPunchActive(channel.instrument) ||
		typeof audioContext.createDynamicsCompressor !== "function"
	) {
		return destination;
	}
	const quantized = Math.round(amount * 20) / 20;
	const faderLevel = Math.max(0, channel.instrument.volume) / PUNCH_INPUT_VOLUME;
	const key = `${channel.id}|${quantized}|${faderLevel.toFixed(3)}`;
	let busesForDestination = punchBusCache.get(destination);
	if (!busesForDestination) {
		busesForDestination = new Map();
		punchBusCache.set(destination, busesForDestination);
	}
	const cached = busesForDestination.get(key);
	if (cached) {
		return cached;
	}
	const input = audioContext.createGain();
	const compressor = audioContext.createDynamicsCompressor();
	compressor.threshold.value = -6 - 24 * quantized;
	compressor.ratio.value = 2 + 8 * quantized;
	compressor.knee.value = 4;
	compressor.attack.value = 0.004;
	compressor.release.value = 0.08;
	const makeup = audioContext.createGain();
	// Win back part of the gain reduction so a punchy bus is denser, not quieter
	makeup.gain.value = 10 ** ((quantized * 6) / 20);
	// Soft-clip ceiling: crushes the transients that slip past the compressor
	// (the "squashed sampled break" sound) and keeps the bus from clipping.
	const ceilingIn = audioContext.createGain();
	ceilingIn.gain.value = 0.5;
	const ceiling = audioContext.createWaveShaper();
	ceiling.curve = getPunchCeilingCurve(audioContext);
	input.connect(compressor);
	compressor.connect(makeup);
	makeup.connect(ceilingIn);
	// Channel fader AFTER the glue: on punch channels the volume slider sets the
	// output level instead of how hard the compressor is driven.
	const fader = audioContext.createGain();
	fader.gain.value = faderLevel;
	ceilingIn.connect(ceiling);
	ceiling.connect(fader);
	fader.connect(destination);
	busesForDestination.set(key, input);
	punchBusRoot.set(input, destination);
	return input;
};

/** Sends `source` into the shared hall reverb at the instrument's reverbMix level. */
const connectReverbSend = (
	audioContext: BaseAudioContext,
	source: AudioNode,
	destination: AudioNode,
	reverbMix: number | undefined
): void => {
	const amount = Math.max(0, Math.min(1, reverbMix ?? 0));
	if (amount < 0.01) {
		return;
	}
	const reverbBus = getReverbBus(
		audioContext,
		punchBusRoot.get(destination) ?? destination
	);
	if (!reverbBus) {
		return;
	}
	const sendGain = audioContext.createGain();
	sendGain.gain.value = amount;
	source.connect(sendGain);
	sendGain.connect(reverbBus);
};

/** Longest tail (seconds) a song's reverb / release can ring after its last note. */
export const getSongTailSeconds = (song: {
	channels: Array<{ instrument: InstrumentConfiguration }>;
}): number => {
	let tail = 0;
	song.channels.forEach((channel) => {
		const instrument = channel.instrument;
		tail = Math.max(tail, instrument.release);
		if ((instrument.reverbMix ?? 0) >= 0.01) {
			tail = Math.max(tail, instrument.release + HALL_REVERB_SECONDS);
		}
	});
	return tail;
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

const CINEMATIC_KIT_PRESET_ID = "cinematic-perc-kit";
const HEAVY_BREAK_KIT_PRESET_ID = "breakcore-heavy-break-kit";

/**
 * Heavy break kit — modelled on the crushed, compressed sampled breaks of
 * modern breakcore: a fat punch kick, a big cracking snare with a noisy room
 * tail (so ghost notes and rolls sound like a real chopped break), crunchy
 * hats, a washy ride/crash and a layered kick+snare "chop" slice.
 * 0 kick · 1 snare · 2 closed hat · 3 crash/ride · 4 low tom · 5 high tom ·
 * 6 open hat · 7 chop (kick + snare slice).
 */
const scheduleHeavyBreakKitVoice = (
	audioContext: BaseAudioContext,
	voiceBus: AudioNode,
	pitch: number,
	startTime: number,
	pitchRatio: number
): boolean => {
	const assets = getAudioAssetsForContext(audioContext);
	const hz = (value: number): number =>
		Math.max(20, Math.min(18000, value * pitchRatio));
	// The layers are stacked hot on purpose; this keeps the kit near the
	// loudness of the other kits before the punch bus squashes it.
	const kitLevel = 0.5;

	const addTone = (
		type: OscillatorType,
		fromFrequency: number,
		toFrequency: number,
		sweepSeconds: number,
		level: number,
		decaySeconds: number
	): void => {
		const oscillator = audioContext.createOscillator();
		oscillator.type = type;
		oscillator.frequency.setValueAtTime(hz(fromFrequency), startTime);
		oscillator.frequency.exponentialRampToValueAtTime(
			hz(toFrequency),
			startTime + sweepSeconds
		);
		const gain = audioContext.createGain();
		gain.gain.setValueAtTime(level * kitLevel, startTime);
		gain.gain.exponentialRampToValueAtTime(0.0001, startTime + decaySeconds);
		oscillator.connect(gain);
		gain.connect(voiceBus);
		oscillator.start(startTime);
		oscillator.stop(startTime + decaySeconds + 0.02);
	};

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
		source.loop = true;
		const filter = audioContext.createBiquadFilter();
		filter.type = filterType;
		filter.frequency.setValueAtTime(hz(frequency), startTime);
		filter.Q.value = q;
		const gain = audioContext.createGain();
		gain.gain.setValueAtTime(level * kitLevel, startTime);
		gain.gain.exponentialRampToValueAtTime(0.0001, startTime + decaySeconds);
		source.connect(filter);
		filter.connect(gain);
		gain.connect(voiceBus);
		source.start(startTime);
		source.stop(startTime + decaySeconds + 0.02);
	};

	const kick = (level: number): void => {
		addTone("sine", 165, 46, 0.065, 1.35 * level, 0.34);
		addTone("triangle", 260, 70, 0.03, 0.4 * level, 0.07);
		addNoise(assets.whiteNoiseBuffer, "bandpass", 4200, 0.9, 0.55 * level, 0.01);
	};
	const snare = (level: number): void => {
		addTone("triangle", 230, 170, 0.045, 1.2 * level, 0.12);
		addNoise(assets.whiteNoiseBuffer, "bandpass", 2600, 0.6, 1.15 * level, 0.19);
		addNoise(assets.whiteNoiseBuffer, "highpass", 6200, 0.7, 0.5 * level, 0.09);
		// Room tail — what makes a sampled break sound big
		addNoise(assets.whiteNoiseBuffer, "lowpass", 3600, 0.5, 0.26 * level, 0.34);
	};

	switch (pitch) {
		case 0: {
			kick(1);
			return true;
		}
		case 1: {
			snare(1);
			return true;
		}
		case 2: {
			addNoise(assets.metallicNoiseBuffer, "highpass", 8200, 0.8, 0.7, 0.045);
			return true;
		}
		case 3: {
			addNoise(assets.whiteNoiseBuffer, "highpass", 4800, 0.6, 0.62, 1.1);
			addNoise(assets.metallicNoiseBuffer, "bandpass", 8800, 0.9, 0.45, 0.8);
			return true;
		}
		case 4:
		case 5: {
			const base = pitch === 4 ? 170 : 250;
			addTone("sine", base * 1.5, base, 0.06, 1.0, 0.26);
			addNoise(assets.whiteNoiseBuffer, "bandpass", base * 5, 1.2, 0.3, 0.06);
			return true;
		}
		case 6: {
			addNoise(assets.metallicNoiseBuffer, "highpass", 7200, 0.8, 0.55, 0.24);
			addNoise(assets.whiteNoiseBuffer, "highpass", 9000, 0.6, 0.2, 0.16);
			return true;
		}
		case 7: {
			kick(0.85);
			snare(0.85);
			return true;
		}
		default: {
			return false;
		}
	}
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

/**
 * Cinematic percussion (Hans Zimmer-style trailer / ambient kit):
 * 0 deep boom · 1 taiko · 2 soft shaker · 3 cymbal swell (rises over the note's
 * length, then blooms) · 4 low timpani (G2) · 5 high timpani (D3) · 6 wind chimes
 * · 7 sub drop. Timpani and booms honour pitchBend, so bend a timpani note to
 * tune it to the chord root (e.g. low timpani −3 = E2, +2 = A2).
 */
const scheduleCinematicKitVoice = (
	audioContext: BaseAudioContext,
	voiceBus: AudioNode,
	pitch: number,
	startTime: number,
	pitchRatio: number,
	noteDurationSeconds: number
): boolean => {
	const assets = getAudioAssetsForContext(audioContext);
	const hz = (value: number): number =>
		Math.max(20, Math.min(18000, value * pitchRatio));

	const addTone = (
		type: OscillatorType,
		fromFrequency: number,
		toFrequency: number,
		sweepSeconds: number,
		level: number,
		decaySeconds: number,
		offsetSeconds = 0,
		attackSeconds = 0.003
	): void => {
		const begin = startTime + offsetSeconds;
		const oscillator = audioContext.createOscillator();
		oscillator.type = type;
		oscillator.frequency.setValueAtTime(hz(fromFrequency), begin);
		oscillator.frequency.exponentialRampToValueAtTime(
			hz(toFrequency),
			begin + sweepSeconds
		);
		const gain = audioContext.createGain();
		gain.gain.setValueAtTime(0.0001, begin);
		gain.gain.linearRampToValueAtTime(level, begin + attackSeconds);
		gain.gain.exponentialRampToValueAtTime(0.0001, begin + decaySeconds);
		oscillator.connect(gain);
		gain.connect(voiceBus);
		oscillator.start(begin);
		oscillator.stop(begin + decaySeconds + 0.02);
	};

	const addNoise = (
		buffer: AudioBuffer,
		filterType: BiquadFilterType,
		frequency: number,
		q: number,
		level: number,
		decaySeconds: number,
		attackSeconds = 0.002
	): void => {
		const source = audioContext.createBufferSource();
		source.buffer = buffer;
		source.loop = true;
		const filter = audioContext.createBiquadFilter();
		filter.type = filterType;
		filter.frequency.setValueAtTime(hz(frequency), startTime);
		filter.Q.value = q;
		const gain = audioContext.createGain();
		gain.gain.setValueAtTime(0.0001, startTime);
		gain.gain.linearRampToValueAtTime(level, startTime + attackSeconds);
		gain.gain.exponentialRampToValueAtTime(0.0001, startTime + decaySeconds);
		source.connect(filter);
		filter.connect(gain);
		gain.connect(voiceBus);
		source.start(startTime);
		source.stop(startTime + decaySeconds + 0.02);
	};

	switch (pitch) {
		case 0: {
			// Deep boom: slow sine dive with a soft felt-mallet thud
			addTone("sine", 78, 33, 0.42, 1.25, 1.8, 0, 0.006);
			addTone("triangle", 120, 46, 0.12, 0.35, 0.35);
			addNoise(assets.whiteNoiseBuffer, "lowpass", 260, 0.7, 0.45, 0.12);
			return true;
		}
		case 1: {
			// Taiko: tight drumhead with a woody skin slap
			addTone("sine", 150, 72, 0.16, 1.0, 0.7);
			addTone("triangle", 230, 110, 0.06, 0.3, 0.16);
			addNoise(assets.whiteNoiseBuffer, "bandpass", 700, 1.2, 0.4, 0.14);
			return true;
		}
		case 2: {
			// Soft shaker: rounded attack, short airy tail
			addNoise(
				assets.whiteNoiseBuffer,
				"bandpass",
				6800,
				0.9,
				0.32,
				0.11,
				0.018
			);
			return true;
		}
		case 3: {
			// Cymbal swell: rises across the written note, then blooms into the downbeat
			const swellSeconds = Math.max(0.3, noteDurationSeconds);
			const bloomSeconds = 0.9;
			const layers: Array<[AudioBuffer, BiquadFilterType, number, number]> = [
				[assets.whiteNoiseBuffer, "highpass", 4200, 0.38],
				[assets.metallicNoiseBuffer, "bandpass", 8600, 0.24],
			];
			layers.forEach(([buffer, filterType, frequency, level]) => {
				const source = audioContext.createBufferSource();
				source.buffer = buffer;
				source.loop = true;
				const filter = audioContext.createBiquadFilter();
				filter.type = filterType;
				filter.frequency.setValueAtTime(hz(frequency * 0.55), startTime);
				filter.frequency.exponentialRampToValueAtTime(
					hz(frequency),
					startTime + swellSeconds
				);
				filter.Q.value = 0.7;
				const gain = audioContext.createGain();
				gain.gain.setValueAtTime(0.0001, startTime);
				gain.gain.exponentialRampToValueAtTime(level, startTime + swellSeconds);
				gain.gain.exponentialRampToValueAtTime(
					0.0001,
					startTime + swellSeconds + bloomSeconds
				);
				source.connect(filter);
				filter.connect(gain);
				gain.connect(voiceBus);
				source.start(startTime);
				source.stop(startTime + swellSeconds + bloomSeconds + 0.03);
			});
			return true;
		}
		case 4:
		case 5: {
			// Timpani: tuned kettle (G2 / D3) with a slight pitch settle and mallet
			const base = pitch === 4 ? 98 : 146.83;
			addTone("sine", base * 1.04, base, 0.08, 1.0, 1.6, 0, 0.004);
			addTone("sine", base * 1.51, base * 1.5, 0.08, 0.32, 0.7);
			addTone("sine", base * 2.0, base * 1.99, 0.08, 0.14, 0.45);
			addNoise(assets.whiteNoiseBuffer, "lowpass", 900, 0.8, 0.28, 0.05);
			return true;
		}
		case 6: {
			// Wind chimes: a scatter of high, slightly detuned glassy pings
			const chimes: Array<[number, number]> = [
				[2349.3, 0],
				[2793.8, 0.07],
				[3136.0, 0.15],
				[2637.0, 0.26],
				[3520.0, 0.36],
				[2960.0, 0.5],
			];
			chimes.forEach(([frequency, offset], index) => {
				addTone(
					"sine",
					frequency,
					frequency * 0.998,
					0.5,
					0.16 - index * 0.012,
					1.4,
					offset
				);
			});
			return true;
		}
		case 7: {
			// Sub drop: long sine dive for big transitions
			addTone("sine", 92, 30, 1.1, 1.0, 1.5, 0, 0.01);
			return true;
		}
		default: {
			return false;
		}
	}
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
	pitchRatio = 1,
	noteDurationSeconds = 0.25
): void => {
	const assets = getAudioAssetsForContext(audioContext);
	const panner = audioContext.createStereoPanner();
	panner.pan.setValueAtTime(instrument.pan, startTime);
	connectReverbSend(audioContext, panner, destination, instrument.reverbMix);

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

	if (
		instrument.presetId === HEAVY_BREAK_KIT_PRESET_ID &&
		scheduleHeavyBreakKitVoice(
			audioContext,
			voiceBus,
			pitch,
			startTime,
			pitchRatio
		)
	) {
		return;
	}

	if (
		instrument.presetId === CINEMATIC_KIT_PRESET_ID &&
		scheduleCinematicKitVoice(
			audioContext,
			voiceBus,
			pitch,
			startTime,
			pitchRatio,
			noteDurationSeconds
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

/**
 * Felt piano: additive, slightly inharmonic partials (real piano strings are
 * a little stiff, so overtones run sharp). Each partial decays on its own —
 * highs fade first, low notes ring longer — and harder velocities are brighter.
 * A detuned unison copy of the lowest partials gives the gentle beating of a
 * real piano's paired strings, plus a soft felt-hammer thump at the attack.
 */
const PIANO_PARTIAL_LEVELS = [1, 0.46, 0.25, 0.14, 0.085, 0.05, 0.03];
const PIANO_INHARMONICITY = 0.00042;

const schedulePianoPartials = (
	audioContext: BaseAudioContext,
	bus: AudioNode,
	note: NoteEvent,
	baseFrequency: number,
	startTime: number,
	stopTime: number,
	detuneCents: number,
	oscillators: Array<OscillatorNode>,
	oscillatorRatios: Map<OscillatorNode, number>
): void => {
	const velocity = Math.max(0.1, Math.min(1, note.velocity));
	const brightness = 0.42 + 0.58 * velocity;
	// ~5 s ring around C3, shorter as notes go up
	const ringSeconds = Math.max(
		0.9,
		Math.min(7, 5.2 * 2 ** (-(note.pitch - 48) / 20))
	);
	const addPartial = (
		ratio: number,
		level: number,
		decaySeconds: number,
		extraDetune: number
	): void => {
		const oscillator = audioContext.createOscillator();
		oscillator.type = "sine";
		oscillator.frequency.setValueAtTime(baseFrequency * ratio, startTime);
		oscillator.detune.setValueAtTime(detuneCents + extraDetune, startTime);
		const gain = audioContext.createGain();
		gain.gain.setValueAtTime(0.0001, startTime);
		gain.gain.linearRampToValueAtTime(level, startTime + 0.004);
		// Two-stage decay: quick initial drop, then a long singing tail
		gain.gain.exponentialRampToValueAtTime(
			Math.max(0.0001, level * 0.32),
			startTime + 0.004 + decaySeconds * 0.16
		);
		gain.gain.exponentialRampToValueAtTime(0.0001, startTime + decaySeconds);
		oscillator.connect(gain);
		gain.connect(bus);
		oscillators.push(oscillator);
		oscillatorRatios.set(oscillator, ratio);
	};

	PIANO_PARTIAL_LEVELS.forEach((partialLevel, index) => {
		const harmonic = index + 1;
		const ratio =
			harmonic * Math.sqrt(1 + PIANO_INHARMONICITY * harmonic * harmonic);
		if (baseFrequency * ratio > 9500) {
			return;
		}
		const level = partialLevel * brightness ** index;
		// Inaudible partials (soft notes' upper overtones) cost CPU for nothing
		if (index > 0 && level < 0.04) {
			return;
		}
		const decaySeconds = ringSeconds / (1 + 0.55 * index);
		addPartial(ratio, level, decaySeconds, 0);
		if (harmonic === 1) {
			addPartial(ratio, level * 0.42, decaySeconds * 1.15, 1.7);
		}
	});

	// Felt hammer thump
	const assets = getAudioAssetsForContext(audioContext);
	const hammer = audioContext.createBufferSource();
	hammer.buffer = assets.whiteNoiseBuffer;
	const hammerFilter = audioContext.createBiquadFilter();
	hammerFilter.type = "bandpass";
	hammerFilter.frequency.value = Math.min(3200, baseFrequency * 3);
	hammerFilter.Q.value = 0.9;
	const hammerGain = audioContext.createGain();
	hammerGain.gain.setValueAtTime(0.03 + 0.07 * velocity, startTime);
	hammerGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.035);
	hammer.connect(hammerFilter);
	hammerFilter.connect(hammerGain);
	hammerGain.connect(bus);
	hammer.start(startTime);
	hammer.stop(Math.min(stopTime, startTime + 0.05));
};

/**
 * Distorted 808: a sine that starts ~3 octaves up and drops to the written
 * pitch in ~50 ms (the kick "punch"), plus a click — so one note is both the
 * kick and the bass note. Pair with drive (~0.5) for the crushed breakcore 808.
 * The drop is part of the tone, not a pitch bend: the note sits on its pitch.
 */
const schedule808Voice = (
	audioContext: BaseAudioContext,
	bus: AudioNode,
	baseFrequency: number,
	startTime: number,
	stopTime: number,
	detuneCents: number,
	oscillators: Array<OscillatorNode>
): void => {
	const body = audioContext.createOscillator();
	body.type = "sine";
	body.frequency.setValueAtTime(Math.min(1200, baseFrequency * 7), startTime);
	body.frequency.exponentialRampToValueAtTime(
		baseFrequency * 1.6,
		startTime + 0.018
	);
	body.frequency.exponentialRampToValueAtTime(baseFrequency, startTime + 0.055);
	body.detune.setValueAtTime(detuneCents, startTime);
	body.connect(bus);
	oscillators.push(body);

	// A little 2nd harmonic so the 808 is audible on small speakers
	const overtone = audioContext.createOscillator();
	overtone.type = "sine";
	overtone.frequency.setValueAtTime(baseFrequency * 2, startTime);
	const overtoneGain = audioContext.createGain();
	overtoneGain.gain.value = 0.18;
	overtone.connect(overtoneGain);
	overtoneGain.connect(bus);
	overtone.start(startTime);
	overtone.stop(stopTime);

	const assets = getAudioAssetsForContext(audioContext);
	const click = audioContext.createBufferSource();
	click.buffer = assets.whiteNoiseBuffer;
	const clickFilter = audioContext.createBiquadFilter();
	clickFilter.type = "bandpass";
	clickFilter.frequency.value = 3200;
	const clickGain = audioContext.createGain();
	clickGain.gain.setValueAtTime(0.4, startTime);
	clickGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.012);
	click.connect(clickFilter);
	clickFilter.connect(clickGain);
	clickGain.connect(bus);
	click.start(startTime);
	click.stop(Math.min(stopTime, startTime + 0.02));
};

/**
 * Ensemble strings: five detuned sawtooth "players" spread across the stereo
 * field, drifting slowly against each other (one shared 0.27 Hz LFO pushes
 * them in different directions) — the shimmer of a real section.
 * Pair with a slow attack (0.4–1.2 s) for pads, short notes + staccato for
 * spiccato ostinatos.
 */
const ENSEMBLE_VOICES: Array<[detune: number, pan: number, drift: number]> = [
	[-13, -0.7, 6],
	[-6, -0.35, -5],
	[0, 0, 3],
	[6, 0.35, -6],
	[13, 0.7, 5],
];

const scheduleEnsembleVoices = (
	audioContext: BaseAudioContext,
	bus: AudioNode,
	baseFrequency: number,
	startTime: number,
	stopTime: number,
	detuneCents: number,
	oscillators: Array<OscillatorNode>
): void => {
	const driftLfo = audioContext.createOscillator();
	driftLfo.frequency.setValueAtTime(0.27, startTime);
	ENSEMBLE_VOICES.forEach(([detune, pan, drift]) => {
		const oscillator = audioContext.createOscillator();
		oscillator.type = "sawtooth";
		oscillator.frequency.setValueAtTime(baseFrequency, startTime);
		oscillator.detune.setValueAtTime(detuneCents + detune, startTime);
		const driftGain = audioContext.createGain();
		driftGain.gain.value = drift;
		driftLfo.connect(driftGain);
		driftGain.connect(oscillator.detune);
		const voiceGain = audioContext.createGain();
		voiceGain.gain.value = 0.42;
		const voicePan = audioContext.createStereoPanner();
		voicePan.pan.value = pan;
		oscillator.connect(voiceGain);
		voiceGain.connect(voicePan);
		voicePan.connect(bus);
		oscillators.push(oscillator);
	});
	driftLfo.start(startTime);
	driftLfo.stop(stopTime);
};

/**
 * Airy choir "aah": three detuned voices filtered through vowel formants
 * (~800 / 1150 / 2800 Hz) plus a warm chest band and a whisper of breath noise.
 */
const CHOIR_FORMANTS: Array<[frequency: number, q: number, level: number]> = [
	[800, 5, 1],
	[1150, 7, 0.55],
	[2800, 9, 0.24],
];

const scheduleChoirVoices = (
	audioContext: BaseAudioContext,
	bus: AudioNode,
	baseFrequency: number,
	startTime: number,
	stopTime: number,
	detuneCents: number,
	oscillators: Array<OscillatorNode>
): void => {
	const voiceSum = audioContext.createGain();
	voiceSum.gain.value = 1;
	const makeup = audioContext.createGain();
	makeup.gain.value = 5.8;
	makeup.connect(bus);

	CHOIR_FORMANTS.forEach(([frequency, q, level]) => {
		const formant = audioContext.createBiquadFilter();
		formant.type = "bandpass";
		formant.frequency.value = frequency;
		formant.Q.value = q;
		const formantGain = audioContext.createGain();
		formantGain.gain.value = level;
		voiceSum.connect(formant);
		formant.connect(formantGain);
		formantGain.connect(makeup);
	});
	const chest = audioContext.createBiquadFilter();
	chest.type = "lowpass";
	chest.frequency.value = 480;
	const chestGain = audioContext.createGain();
	chestGain.gain.value = 0.16;
	voiceSum.connect(chest);
	chest.connect(chestGain);
	chestGain.connect(makeup);

	(
		[
			[-9, -0.4],
			[0, 0],
			[9, 0.4],
		] as Array<[number, number]>
	).forEach(([detune, pan]) => {
		const oscillator = audioContext.createOscillator();
		oscillator.type = "sawtooth";
		oscillator.frequency.setValueAtTime(baseFrequency, startTime);
		oscillator.detune.setValueAtTime(detuneCents + detune, startTime);
		const voiceGain = audioContext.createGain();
		voiceGain.gain.value = 0.33;
		const voicePan = audioContext.createStereoPanner();
		voicePan.pan.value = pan;
		oscillator.connect(voiceGain);
		voiceGain.connect(voicePan);
		voicePan.connect(voiceSum);
		oscillators.push(oscillator);
	});

	// Breath
	const assets = getAudioAssetsForContext(audioContext);
	const breath = audioContext.createBufferSource();
	breath.buffer = assets.whiteNoiseBuffer;
	breath.loop = true;
	const breathFilter = audioContext.createBiquadFilter();
	breathFilter.type = "bandpass";
	breathFilter.frequency.value = 3400;
	breathFilter.Q.value = 0.8;
	const breathGain = audioContext.createGain();
	breathGain.gain.value = 0.02;
	breath.connect(breathFilter);
	breathFilter.connect(breathGain);
	breathGain.connect(bus);
	breath.start(startTime);
	breath.stop(stopTime);
};

export const scheduleChannelNote = (
	audioContext: BaseAudioContext,
	destination: AudioNode,
	note: NoteEvent,
	channel: Channel,
	startTime: number,
	stepDurationSeconds: number,
	/** Pattern context for legato slides, legato cut-offs and ornament neighbours */
	playbackContext?: NotePlaybackContext
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
			stepDurationSeconds,
			playbackContext
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
	const articulationShape = resolveArticulationShape(note.articulation);
	// Optional per-channel glue compressor ("punch"); its fader replaces the
	// per-note volume, so notes are driven into it at a fixed level.
	const channelDestination = resolvePunchDestination(
		audioContext,
		destination,
		channel
	);
	const voiceVolume =
		channelDestination !== destination
			? PUNCH_INPUT_VOLUME
			: instrument.volume;
	if (isDrumVoice) {
		scheduleDrumHit(
			audioContext,
			channelDestination,
			note.pitch,
			startTime,
			Math.min(1.5, note.velocity * articulationShape.gainMultiplier),
			{ ...instrument, volume: voiceVolume },
			effectiveFade,
			note.filterCutoff,
			note.filterSweepTo,
			note.pitchBend === 0 ? 1 : 2 ** (note.pitchBend / 12),
			Math.max(0.04, note.duration * stepDurationSeconds)
		);
		return;
	}

	// Articulation sets how much of the written length sounds (gate) and how the
	// note starts; a legato follower cuts this note off where it slurs in.
	const context = playbackContext ?? DEFAULT_PLAYBACK_CONTEXT;
	const isSlurredOut = context.cutAfterSteps !== undefined;
	const soundingSteps = Math.min(
		note.duration * articulationShape.gate,
		context.cutAfterSteps ?? Number.POSITIVE_INFINITY
	);
	const noteDurationSeconds = Math.max(
		isSlurredOut ? 0.02 : 0.04,
		soundingSteps * stepDurationSeconds
	);
	const attack = Math.max(
		0.002,
		Math.min(
			instrument.attack,
			articulationShape.maxAttackSeconds ?? Number.POSITIVE_INFINITY
		)
	);
	const decay = Math.max(0.01, instrument.decay);
	// Slurred-out notes hand over to the next note with a very short crossfade
	const release = isSlurredOut
		? 0.012
		: Math.max(0.012, instrument.release * articulationShape.releaseScale);
	const sustainLevel = Math.max(
		0.02,
		instrument.sustain,
		articulationShape.minSustain
	);
	const stopTime = startTime + noteDurationSeconds + release + 0.02;

	const baseFrequency = resolveMidiFrequency(note.pitch);
	const peakGain = Math.max(
		0.01,
		voiceVolume * note.velocity * 0.34 * articulationShape.gainMultiplier
	);

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
		envelopeGain.gain.linearRampToValueAtTime(peakGain, startTime + attackEnd);
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
	if (articulationShape.filterBoost > 1 && note.filterSweepTo === undefined) {
		// Accent "bite": open the filter at the attack, settle back within ~90 ms
		lowPassFilter.frequency.setValueAtTime(
			Math.min(14000, startCutoff * articulationShape.filterBoost),
			startTime
		);
		lowPassFilter.frequency.exponentialRampToValueAtTime(
			startCutoff,
			startTime + Math.max(0.02, Math.min(0.09, noteDurationSeconds * 0.6))
		);
	} else {
		lowPassFilter.frequency.setValueAtTime(startCutoff, startTime);
	}
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
		channelDestination,
		instrument,
		noteDurationSeconds + release
	);

	envelopeGain.connect(lowPassFilter);
	lowPassFilter.connect(panner);
	panner.connect(outputBus);
	connectReverbSend(audioContext, panner, destination, instrument.reverbMix);

	// Oscillators run through the optional overdrive / bit-crush before the envelope
	const oscillatorBus = createDriveStage(
		audioContext,
		envelopeGain,
		instrument.drive
	);

	const oscillators: Array<OscillatorNode> = [];
	/** Frequency multiple of each oscillator (piano partials ≠ 1) */
	const oscillatorRatios = new Map<OscillatorNode, number>();
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
	} else if (instrument.waveform === "piano") {
		schedulePianoPartials(
			audioContext,
			oscillatorBus,
			note,
			baseFrequency,
			startTime,
			stopTime,
			instrument.detuneCents,
			oscillators,
			oscillatorRatios
		);
	} else if (instrument.waveform === "sub808") {
		schedule808Voice(
			audioContext,
			oscillatorBus,
			baseFrequency,
			startTime,
			stopTime,
			instrument.detuneCents,
			oscillators
		);
	} else if (instrument.waveform === "strings") {
		scheduleEnsembleVoices(
			audioContext,
			oscillatorBus,
			baseFrequency,
			startTime,
			stopTime,
			instrument.detuneCents,
			oscillators
		);
	} else if (instrument.waveform === "choir") {
		scheduleChoirVoices(
			audioContext,
			oscillatorBus,
			baseFrequency,
			startTime,
			stopTime,
			instrument.detuneCents,
			oscillators
		);
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

	// Legato slide from the previous note, or an ornament's quick neighbour notes
	const ornamentEvents = note.ornament
		? buildOrnamentPitchEvents(
				note.ornament,
				noteDurationSeconds,
				stepDurationSeconds,
				context
			)
		: [];
	const slideFromPitch =
		ornamentEvents.length === 0 &&
		note.articulation === "legato" &&
		context.slideFromPitch !== undefined &&
		context.slideFromPitch !== note.pitch
			? context.slideFromPitch
			: undefined;
	const glideSeconds = Math.max(
		0.02,
		Math.min(0.07, stepDurationSeconds * 0.6, noteDurationSeconds * 0.5)
	);

	// Pitch slide automation & chiptune arpeggio stepping
	oscillators.forEach((oscillator) => {
		const ratio = oscillatorRatios.get(oscillator) ?? 1;
		const midiHz = (midi: number): number => resolveMidiFrequency(midi) * ratio;
		const baseHz = baseFrequency * ratio;
		if (slideFromPitch !== undefined) {
			oscillator.frequency.setValueAtTime(midiHz(slideFromPitch), startTime);
			oscillator.frequency.exponentialRampToValueAtTime(
				baseHz,
				startTime + glideSeconds
			);
		}
		for (const event of ornamentEvents) {
			oscillator.frequency.setValueAtTime(
				midiHz(note.pitch + event.offset),
				startTime + event.time
			);
		}
		if (note.pitchBend !== 0) {
			const targetFrequency = midiHz(note.pitch + note.pitchBend);
			if (note.bendStyle === "early" && note.duration >= 2) {
				const bendStart =
					startTime +
					Math.min(noteDurationSeconds * 0.25, stepDurationSeconds * 0.35);
				const bendEnd =
					startTime +
					Math.min(noteDurationSeconds * 0.85, stepDurationSeconds * 1.35);
				oscillator.frequency.setValueAtTime(baseHz, bendStart);
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
				oscillator.frequency.setValueAtTime(baseHz, bendStart);
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
		} else if (arpOffsets.length > 1 && ornamentEvents.length === 0) {
			const arpStepSeconds = 0.045;
			const totalArpSteps = Math.floor(noteDurationSeconds / arpStepSeconds);
			for (let index = 0; index <= totalArpSteps; index += 1) {
				const semitoneOffset = arpOffsets[index % arpOffsets.length] ?? 0;
				const arpFrequency = midiHz(note.pitch + semitoneOffset);
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
		articulation: noteOverrides?.articulation,
		ornament: noteOverrides?.ornament,
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

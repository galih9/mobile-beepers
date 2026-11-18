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

const createEchoNetwork = (
	audioContext: BaseAudioContext,
	destination: AudioNode,
	instrument: InstrumentConfiguration,
	totalLifeSeconds: number
): AudioNode => {
	if (instrument.echoMix <= 0.01) {
		return destination;
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

	// Disconnect delay feedback cleanly after tail decays in live AudioContext
	if (typeof window !== "undefined" && !isOfflineAudioContext(audioContext)) {
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

const scheduleDrumHit = (
	audioContext: BaseAudioContext,
	destination: AudioNode,
	pitch: number,
	startTime: number,
	velocity: number,
	instrument: InstrumentConfiguration,
	effectiveFade: number
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
	masterGain.connect(panner);
	panner.connect(destination);

	if (pitch === 0) {
		// 8-bit Kick
		const oscillator = audioContext.createOscillator();
		const kickGain = audioContext.createGain();
		oscillator.type = "triangle";
		oscillator.frequency.setValueAtTime(165, startTime);
		oscillator.frequency.exponentialRampToValueAtTime(42, startTime + 0.12);
		kickGain.gain.setValueAtTime(1.1, startTime);
		kickGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.18);
		oscillator.connect(kickGain);
		kickGain.connect(masterGain);
		oscillator.start(startTime);
		oscillator.stop(startTime + 0.19);
		return;
	}

	if (pitch === 1) {
		// Snare: Noise + pitch-swept body
		const noiseSource = audioContext.createBufferSource();
		noiseSource.buffer = assets.whiteNoiseBuffer;
		const noiseFilter = audioContext.createBiquadFilter();
		noiseFilter.type = "bandpass";
		noiseFilter.frequency.setValueAtTime(2200, startTime);
		const noiseGain = audioContext.createGain();
		noiseGain.gain.setValueAtTime(0.85, startTime);
		noiseGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.16);
		noiseSource.connect(noiseFilter);
		noiseFilter.connect(noiseGain);
		noiseGain.connect(masterGain);
		noiseSource.start(startTime);
		noiseSource.stop(startTime + 0.17);

		const bodyOscillator = audioContext.createOscillator();
		const bodyGain = audioContext.createGain();
		bodyOscillator.type = "triangle";
		bodyOscillator.frequency.setValueAtTime(220, startTime);
		bodyOscillator.frequency.exponentialRampToValueAtTime(95, startTime + 0.08);
		bodyGain.gain.setValueAtTime(0.7, startTime);
		bodyGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.1);
		bodyOscillator.connect(bodyGain);
		bodyGain.connect(masterGain);
		bodyOscillator.start(startTime);
		bodyOscillator.stop(startTime + 0.11);
		return;
	}

	if (pitch === 2 || pitch === 3) {
		// Closed (2) or Open (3) Metallic Hi-Hat
		const decaySeconds = pitch === 2 ? 0.055 : 0.24;
		const noiseSource = audioContext.createBufferSource();
		noiseSource.buffer = assets.metallicNoiseBuffer;
		const highPass = audioContext.createBiquadFilter();
		highPass.type = "highpass";
		highPass.frequency.setValueAtTime(5200, startTime);
		const hatGain = audioContext.createGain();
		hatGain.gain.setValueAtTime(0.55, startTime);
		hatGain.gain.exponentialRampToValueAtTime(0.001, startTime + decaySeconds);
		noiseSource.connect(highPass);
		highPass.connect(hatGain);
		hatGain.connect(masterGain);
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
		tomOscillator.frequency.setValueAtTime(startFrequency, startTime);
		tomOscillator.frequency.exponentialRampToValueAtTime(
			endFrequency,
			startTime + 0.15
		);
		tomGain.gain.setValueAtTime(0.7, startTime);
		tomGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.17);
		tomOscillator.connect(tomGain);
		tomGain.connect(masterGain);
		tomOscillator.start(startTime);
		tomOscillator.stop(startTime + 0.18);
		return;
	}

	if (pitch === 6) {
		// Retro Multi-Burst Clap
		const noiseSource = audioContext.createBufferSource();
		noiseSource.buffer = assets.whiteNoiseBuffer;
		const bandPass = audioContext.createBiquadFilter();
		bandPass.type = "bandpass";
		bandPass.frequency.setValueAtTime(1600, startTime);
		const clapGain = audioContext.createGain();
		clapGain.gain.setValueAtTime(0.01, startTime);
		clapGain.gain.setValueAtTime(0.85, startTime + 0.002);
		clapGain.gain.setValueAtTime(0.15, startTime + 0.018);
		clapGain.gain.setValueAtTime(0.8, startTime + 0.028);
		clapGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.19);
		noiseSource.connect(bandPass);
		bandPass.connect(clapGain);
		clapGain.connect(masterGain);
		noiseSource.start(startTime);
		noiseSource.stop(startTime + 0.2);
		return;
	}

	// Pitch 7: Classic 8-bit Coin / Blip FX
	const blipOscillator = audioContext.createOscillator();
	const blipGain = audioContext.createGain();
	blipOscillator.setPeriodicWave(assets.pulse25);
	blipOscillator.frequency.setValueAtTime(987.77, startTime);
	blipOscillator.frequency.setValueAtTime(1318.51, startTime + 0.055);
	blipGain.gain.setValueAtTime(0.55, startTime);
	blipGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.22);
	blipOscillator.connect(blipGain);
	blipGain.connect(masterGain);
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
	const instrument = channel.instrument;
	const effectiveFade = resolveEffectiveFade(note, instrument);
	if (channel.type === "drum" || instrument.waveform === "retroKit") {
		scheduleDrumHit(
			audioContext,
			destination,
			note.pitch,
			startTime,
			note.velocity,
			instrument,
			effectiveFade
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
		envelopeGain.gain.linearRampToValueAtTime(peakGain, startTime + attack);
		envelopeGain.gain.exponentialRampToValueAtTime(
			Math.max(0.0001, peakGain * sustainLevel),
			startTime + attack + decay
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

	const lowPassFilter = audioContext.createBiquadFilter();
	lowPassFilter.type = "lowpass";
	lowPassFilter.frequency.setValueAtTime(instrument.filterCutoff, startTime);
	lowPassFilter.Q.value = 1.1;

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
		carrier.connect(envelopeGain);

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
			subGain.connect(envelopeGain);
			oscillators.push(oscillator);
		});
	} else {
		const oscillator = audioContext.createOscillator();
		applyWaveformToOscillator(audioContext, oscillator, instrument.waveform);
		oscillator.frequency.setValueAtTime(baseFrequency, startTime);
		oscillator.detune.setValueAtTime(instrument.detuneCents, startTime);
		oscillator.connect(envelopeGain);
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

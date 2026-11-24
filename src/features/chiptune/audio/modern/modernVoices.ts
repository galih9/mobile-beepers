import type {
	InstrumentConfiguration,
	ModernEngine,
	ModernInstrumentSettings,
} from "../../types/music";
import {
	ENGINE_SAMPLE_INSTRUMENT,
	getBuiltInZone,
	getUserSampleBuffer,
} from "./sampleLibrary";

/**
 * One-note voices for the modern engine, built from plain Web Audio nodes so
 * the exact same code runs live, in previews and in the offline WAV render.
 * Each voice feeds a channel strip (see modernRack.ts) that adds the FX.
 */

/** A point of pitch automation, in cents relative to the written pitch */
export interface PitchPoint {
	/** Absolute context time */
	time: number;
	cents: number;
	/** Ramp linearly from the previous point instead of jumping */
	ramp?: boolean;
}

export interface VoiceRequest {
	context: BaseAudioContext;
	output: AudioNode;
	settings: ModernInstrumentSettings;
	instrument: InstrumentConfiguration;
	/** MIDI pitch (melodic) or drum pad index 0-7 (kits) */
	pitch: number;
	/** 0-1.5 after articulation */
	velocity: number;
	startTime: number;
	/** When the key is released (gate end) */
	endTime: number;
	pitchPoints: Array<PitchPoint>;
	releaseScale: number;
	minSustain: number;
	filterBoost: number;
	maxAttackSeconds?: number;
	cutoffOverride?: number;
	cutoffSweepTo?: number;
	bpm: number;
	/** Called when a kick is scheduled (drives sidechain ducking) */
	onKick?: (time: number, velocity: number) => void;
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

const clamp = (value: number, min: number, max: number): number =>
	Math.max(min, Math.min(max, value));

const midiToHz = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();

/** 2 s of white noise per context (seeded, so renders are repeatable) */
const getNoiseBuffer = (context: BaseAudioContext): AudioBuffer => {
	const cached = noiseCache.get(context);
	if (cached) {
		return cached;
	}
	const length = Math.floor(context.sampleRate * 2);
	const buffer = context.createBuffer(1, length, context.sampleRate);
	const data = buffer.getChannelData(0);
	let seed = 0x2f6b_4e1d;
	for (let index = 0; index < length; index += 1) {
		seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
		data[index] = (seed / 0xff_ff_ff_ff) * 2 - 1;
	}
	noiseCache.set(context, buffer);
	return buffer;
};

const saturationCurves = new Map<number, Float32Array<ArrayBuffer>>();

/** Soft tanh saturation curve (amount 0-10), normalised to ±1 */
export const getSaturationCurve = (
	amount: number
): Float32Array<ArrayBuffer> => {
	const key = Math.round(amount * 20) / 20;
	const cached = saturationCurves.get(key);
	if (cached) {
		return cached;
	}
	const size = 2048;
	const curve = new Float32Array(new ArrayBuffer(size * 4));
	const drive = 1 + key * 3;
	const normaliser = Math.tanh(drive);
	for (let index = 0; index < size; index += 1) {
		const x = (index / (size - 1)) * 2 - 1;
		curve[index] = Math.tanh(x * drive) / normaliser;
	}
	saturationCurves.set(key, curve);
	return curve;
};

/** Apply pitch automation (plus a fixed offset) to a detune parameter */
const applyPitch = (
	parameter: AudioParam,
	points: Array<PitchPoint>,
	baseCents: number
): void => {
	if (points.length === 0) {
		parameter.value = baseCents;
		return;
	}
	points.forEach((point, index) => {
		const value = baseCents + point.cents;
		if (index > 0 && point.ramp) {
			parameter.linearRampToValueAtTime(value, point.time);
		} else {
			parameter.setValueAtTime(value, point.time);
		}
	});
};

/** Same as applyPitch, expressed as a playback-rate multiplier */
const applyPitchToRate = (
	parameter: AudioParam,
	points: Array<PitchPoint>,
	baseRate: number,
	fineCents: number
): void => {
	const rateFor = (cents: number): number =>
		clamp(baseRate * Math.pow(2, (fineCents + cents) / 1200), 0.01, 16);
	if (points.length === 0) {
		parameter.value = rateFor(0);
		return;
	}
	points.forEach((point, index) => {
		const value = rateFor(point.cents);
		if (index > 0 && point.ramp) {
			parameter.linearRampToValueAtTime(value, point.time);
		} else {
			parameter.setValueAtTime(value, point.time);
		}
	});
};

/**
 * ADSR on a gain parameter. Returns the time after which the voice is silent.
 */
const scheduleAdsr = (
	parameter: AudioParam,
	start: number,
	end: number,
	peak: number,
	attack: number,
	decay: number,
	sustain: number,
	release: number
): number => {
	const attackTime = clamp(attack, 0.002, Math.max(0.002, end - start));
	const attackEnd = start + attackTime;
	parameter.setValueAtTime(0, start);
	parameter.linearRampToValueAtTime(peak, attackEnd);
	const releaseStart = Math.max(end, attackEnd);
	if (releaseStart > attackEnd + 0.001) {
		parameter.setTargetAtTime(
			Math.max(0, peak * sustain),
			attackEnd,
			Math.max(0.006, decay / 3)
		);
	}
	parameter.setTargetAtTime(0, releaseStart, Math.max(0.004, release / 4));
	return releaseStart + release * 1.4 + 0.05;
};

interface MelodicShape {
	attack: number;
	decay: number;
	sustain: number;
	release: number;
}

const resolveShape = (request: VoiceRequest): MelodicShape => {
	const { instrument } = request;
	const attack =
		request.maxAttackSeconds !== undefined
			? Math.min(instrument.attack, request.maxAttackSeconds)
			: instrument.attack;
	return {
		attack: Math.max(0.002, attack),
		decay: Math.max(0.02, instrument.decay),
		sustain: clamp(Math.max(instrument.sustain, request.minSustain), 0, 1),
		release: Math.max(0.02, instrument.release * request.releaseScale),
	};
};

/** Volume curve from velocity — musical, never fully silent */
const velocityGain = (velocity: number): number =>
	clamp(Math.pow(clamp(velocity, 0.05, 1.5), 1.35), 0.02, 1.7);

const createFilterWithEnvelope = (
	request: VoiceRequest,
	type: BiquadFilterType,
	envelopeSeconds: number
): BiquadFilterNode => {
	const { context, settings, startTime, endTime } = request;
	const filter = context.createBiquadFilter();
	filter.type = type;
	filter.Q.value = clamp(settings.resonance, 0.3, 18);
	const base = clamp(request.cutoffOverride ?? settings.cutoff, 40, 19_000);
	const velocityAmount = clamp(request.velocity, 0.2, 1.3);
	const peak = clamp(
		base *
			Math.pow(2, settings.filterEnv * velocityAmount) *
			request.filterBoost,
		40,
		19_000
	);
	if (request.cutoffSweepTo !== undefined) {
		// Per-note sweep replaces the envelope: glide from the cutoff to the target
		filter.frequency.setValueAtTime(base, startTime);
		filter.frequency.exponentialRampToValueAtTime(
			clamp(request.cutoffSweepTo, 40, 19_000),
			Math.max(startTime + 0.02, endTime)
		);
		return filter;
	}
	filter.frequency.setValueAtTime(peak, startTime);
	if (peak !== base) {
		filter.frequency.setTargetAtTime(
			base,
			startTime + 0.002,
			Math.max(0.01, envelopeSeconds)
		);
	}
	return filter;
};

// ─── Synth engines ───────────────────────────────────────────────────────────

interface OscillatorLayer {
	type: OscillatorType;
	/** Semitones relative to the note */
	semitones: number;
	gain: number;
	/** Unison voices for this layer */
	voices: number;
	/** 0-1 share of the channel's spread setting */
	spreadShare: number;
	/** Stereo width of the unison voices (0 = mono) */
	width: number;
}

interface SynthRecipe {
	layers: Array<OscillatorLayer>;
	filterType: BiquadFilterType;
	/** Seconds for the filter envelope to fall back */
	filterDecay: (shape: MelodicShape) => number;
	/** Overall output trim */
	level: number;
	/** Slow cutoff wobble (reese movement, pad drift) */
	filterLfo?: { rate: number; depth: number };
	/** Delayed vibrato for leads */
	vibrato?: { rate: number; cents: number; delay: number };
}

const SYNTH_RECIPES: Partial<Record<ModernEngine, SynthRecipe>> = {
	superSaw: {
		layers: [
			{
				type: "sawtooth",
				semitones: 0,
				gain: 1,
				voices: 7,
				spreadShare: 1,
				width: 0.9,
			},
			{
				type: "sawtooth",
				semitones: -12,
				gain: 0.32,
				voices: 1,
				spreadShare: 0,
				width: 0,
			},
		],
		filterType: "lowpass",
		filterDecay: (shape) => shape.decay * 0.6,
		level: 0.34,
	},
	pad: {
		layers: [
			{
				type: "sawtooth",
				semitones: 0,
				gain: 0.8,
				voices: 6,
				spreadShare: 1,
				width: 1,
			},
			{
				type: "triangle",
				semitones: 12,
				gain: 0.35,
				voices: 2,
				spreadShare: 0.5,
				width: 0.8,
			},
		],
		filterType: "lowpass",
		filterDecay: (shape) => Math.max(0.3, shape.attack + shape.decay),
		level: 0.4,
		filterLfo: { rate: 0.23, depth: 0.22 },
	},
	pluck: {
		layers: [
			{
				type: "sawtooth",
				semitones: 0,
				gain: 1,
				voices: 3,
				spreadShare: 0.7,
				width: 0.6,
			},
			{
				type: "square",
				semitones: -12,
				gain: 0.3,
				voices: 1,
				spreadShare: 0,
				width: 0,
			},
		],
		filterType: "lowpass",
		filterDecay: (shape) => Math.max(0.04, shape.decay * 0.45),
		level: 0.42,
	},
	softLead: {
		layers: [
			{
				type: "sine",
				semitones: 0,
				gain: 1,
				voices: 1,
				spreadShare: 0,
				width: 0,
			},
			{
				type: "triangle",
				semitones: 0,
				gain: 0.55,
				voices: 2,
				spreadShare: 0.25,
				width: 0.35,
			},
			{
				type: "sawtooth",
				semitones: 12,
				gain: 0.07,
				voices: 1,
				spreadShare: 0,
				width: 0,
			},
		],
		filterType: "lowpass",
		filterDecay: (shape) => shape.decay,
		level: 0.5,
		vibrato: { rate: 5.4, cents: 11, delay: 0.28 },
	},
	reeseBass: {
		layers: [
			{
				type: "sawtooth",
				semitones: 0,
				gain: 1,
				voices: 2,
				spreadShare: 1,
				width: 0.25,
			},
			{
				type: "sawtooth",
				semitones: 0,
				gain: 0.45,
				voices: 1,
				spreadShare: 0,
				width: 0,
			},
			{
				type: "sine",
				semitones: -12,
				gain: 0.9,
				voices: 1,
				spreadShare: 0,
				width: 0,
			},
		],
		filterType: "lowpass",
		filterDecay: (shape) => shape.decay,
		level: 0.42,
		filterLfo: { rate: 0.55, depth: 0.3 },
	},
	subBass: {
		layers: [
			{
				type: "sine",
				semitones: 0,
				gain: 1,
				voices: 1,
				spreadShare: 0,
				width: 0,
			},
			{
				type: "sine",
				semitones: 12,
				gain: 0.1,
				voices: 1,
				spreadShare: 0,
				width: 0,
			},
		],
		filterType: "lowpass",
		filterDecay: (shape) => shape.decay,
		level: 0.68,
	},
};

const scheduleSynthVoice = (
	request: VoiceRequest,
	recipe: SynthRecipe
): void => {
	const { context, settings, startTime, endTime } = request;
	const shape = resolveShape(request);
	const filter = createFilterWithEnvelope(
		request,
		recipe.filterType,
		recipe.filterDecay(shape)
	);
	const amp = context.createGain();
	const stopTime = scheduleAdsr(
		amp.gain,
		startTime,
		endTime,
		velocityGain(request.velocity) * recipe.level,
		shape.attack,
		shape.decay,
		shape.sustain,
		shape.release
	);
	filter.connect(amp);
	amp.connect(request.output);

	const sources: Array<OscillatorNode> = [];
	const baseMidi = request.pitch + settings.tune;
	const fineCents = request.instrument.detuneCents;

	for (const layer of recipe.layers) {
		const layerGain = layer.gain / Math.sqrt(layer.voices);
		for (let voice = 0; voice < layer.voices; voice += 1) {
			const position =
				layer.voices === 1 ? 0 : (voice / (layer.voices - 1)) * 2 - 1;
			const oscillator = context.createOscillator();
			oscillator.type = layer.type;
			oscillator.frequency.value = midiToHz(baseMidi + layer.semitones);
			applyPitch(
				oscillator.detune,
				request.pitchPoints,
				fineCents + position * settings.spread * layer.spreadShare
			);
			const gain = context.createGain();
			gain.gain.value = layerGain;
			oscillator.connect(gain);
			if (layer.width > 0 && layer.voices > 1) {
				const panner = context.createStereoPanner();
				panner.pan.value = clamp(position * layer.width, -1, 1);
				gain.connect(panner);
				panner.connect(filter);
			} else {
				gain.connect(filter);
			}
			sources.push(oscillator);
		}
	}

	if (recipe.vibrato) {
		const { rate, cents, delay } = recipe.vibrato;
		const lfo = context.createOscillator();
		lfo.frequency.value = rate;
		const depth = context.createGain();
		depth.gain.setValueAtTime(0, startTime);
		depth.gain.setValueAtTime(0, startTime + delay);
		depth.gain.linearRampToValueAtTime(cents, startTime + delay + 0.35);
		lfo.connect(depth);
		sources.forEach((oscillator) => {
			depth.connect(oscillator.detune);
		});
		sources.push(lfo);
	}

	if (recipe.filterLfo) {
		const lfo = context.createOscillator();
		lfo.frequency.value = recipe.filterLfo.rate;
		const depth = context.createGain();
		depth.gain.value =
			clamp(request.cutoffOverride ?? settings.cutoff, 40, 19_000) *
			recipe.filterLfo.depth;
		lfo.connect(depth);
		depth.connect(filter.frequency);
		sources.push(lfo);
	}

	sources.forEach((source) => {
		source.start(startTime);
		source.stop(stopTime);
	});
};

/** Two-operator FM: electric piano (ratio 1 + tine) or bell (ratio 3.5) */
const scheduleFmVoice = (
	request: VoiceRequest,
	kind: "ePiano" | "bell"
): void => {
	const { context, settings, startTime, endTime } = request;
	const shape = resolveShape(request);
	const frequency = midiToHz(request.pitch + settings.tune);
	const velocity = clamp(request.velocity, 0.1, 1.4);

	const filter = context.createBiquadFilter();
	filter.type = "lowpass";
	filter.Q.value = 0.6;
	filter.frequency.value = clamp(
		request.cutoffOverride ?? settings.cutoff,
		200,
		19_000
	);
	const amp = context.createGain();
	const level = kind === "ePiano" ? 0.42 : 0.3;
	const stopTime = scheduleAdsr(
		amp.gain,
		startTime,
		endTime,
		velocityGain(velocity) * level,
		shape.attack,
		shape.decay,
		shape.sustain,
		shape.release
	);
	filter.connect(amp);
	amp.connect(request.output);

	const carrier = context.createOscillator();
	carrier.frequency.value = frequency;
	const modulator = context.createOscillator();
	const ratio = kind === "ePiano" ? 1 : 3.5;
	modulator.frequency.value = frequency * ratio;
	const modulationDepth = context.createGain();
	const startIndex = kind === "ePiano" ? 1.9 * velocity : 4.5 * velocity;
	const endIndex = kind === "ePiano" ? 0.3 : 0.45;
	modulationDepth.gain.setValueAtTime(frequency * startIndex, startTime);
	modulationDepth.gain.setTargetAtTime(
		frequency * endIndex,
		startTime,
		kind === "ePiano" ? 0.32 : 0.55
	);
	modulator.connect(modulationDepth);
	modulationDepth.connect(carrier.frequency);
	applyPitch(
		carrier.detune,
		request.pitchPoints,
		request.instrument.detuneCents
	);
	applyPitch(
		modulator.detune,
		request.pitchPoints,
		request.instrument.detuneCents
	);
	carrier.connect(filter);

	// Tine / shimmer partial: a short bright click (e-piano) or a ringing overtone (bell)
	const partial = context.createOscillator();
	partial.frequency.value = frequency * (kind === "ePiano" ? 7.1 : 2.76);
	applyPitch(partial.detune, request.pitchPoints, 0);
	const partialGain = context.createGain();
	const partialLevel = (kind === "ePiano" ? 0.16 : 0.22) * velocity;
	partialGain.gain.setValueAtTime(partialLevel, startTime);
	partialGain.gain.setTargetAtTime(
		0,
		startTime,
		kind === "ePiano" ? 0.035 : 0.5
	);
	partial.connect(partialGain);
	partialGain.connect(filter);

	[carrier, modulator, partial].forEach((oscillator) => {
		oscillator.start(startTime);
		oscillator.stop(stopTime);
	});
};

/** Korg M1 / drawbar house organ: additive sine partials + percussive key-click */
const scheduleHouseOrganVoice = (request: VoiceRequest): void => {
	const { context, settings, startTime, endTime } = request;
	const shape = resolveShape(request);
	const filter = createFilterWithEnvelope(
		request,
		"lowpass",
		Math.max(0.06, shape.decay * 0.5)
	);
	const amp = context.createGain();
	const stopTime = scheduleAdsr(
		amp.gain,
		startTime,
		endTime,
		velocityGain(request.velocity) * 0.38,
		shape.attack,
		shape.decay,
		shape.sustain,
		shape.release
	);
	filter.connect(amp);
	amp.connect(request.output);

	const baseMidi = request.pitch + settings.tune;
	const baseFrequency = midiToHz(baseMidi);
	const fineCents = request.instrument.detuneCents;
	const oscillators: Array<OscillatorNode> = [];

	const partials: Array<{
		ratio: number;
		gain: number;
		spreadPan?: number;
	}> = [
		{ ratio: 0.5, gain: 0.52 },
		{ ratio: 1, gain: 1, spreadPan: -0.45 },
		{ ratio: 1.5, gain: 0.42 },
		{ ratio: 2, gain: 0.62, spreadPan: 0.45 },
		{ ratio: 3, gain: 0.24 },
	];

	for (const partial of partials) {
		const frequency = baseFrequency * partial.ratio;
		if (frequency > 16_000) {
			continue;
		}
		const oscillator = context.createOscillator();
		oscillator.type = "sine";
		oscillator.frequency.value = frequency;
		applyPitch(oscillator.detune, request.pitchPoints, fineCents);
		const partialGain = context.createGain();
		partialGain.gain.value = partial.gain;
		oscillator.connect(partialGain);
		partialGain.connect(filter);
		oscillators.push(oscillator);

		if (partial.spreadPan !== undefined && settings.spread > 1) {
			const wideOscillator = context.createOscillator();
			wideOscillator.type = "sine";
			wideOscillator.frequency.value = frequency;
			applyPitch(
				wideOscillator.detune,
				request.pitchPoints,
				fineCents + Math.sign(partial.spreadPan) * settings.spread * 0.35
			);
			const wideGain = context.createGain();
			wideGain.gain.value = partial.gain * 0.35;
			const panner = context.createStereoPanner();
			panner.pan.value = partial.spreadPan;
			wideOscillator.connect(wideGain);
			wideGain.connect(panner);
			panner.connect(filter);
			oscillators.push(wideOscillator);
		}
	}

	// Percussive Hammond / M1 key-click transients
	const clickPartials: Array<{ ratio: number; level: number; decay: number }> = [
		{ ratio: 4, level: 0.24, decay: 0.014 },
		{ ratio: 6, level: 0.14, decay: 0.009 },
	];
	for (const click of clickPartials) {
		const frequency = baseFrequency * click.ratio;
		if (frequency > 16_000) {
			continue;
		}
		const oscillator = context.createOscillator();
		oscillator.type = "sine";
		oscillator.frequency.value = frequency;
		applyPitch(oscillator.detune, request.pitchPoints, fineCents);
		const clickGain = context.createGain();
		clickGain.gain.setValueAtTime(click.level, startTime);
		clickGain.gain.setTargetAtTime(0, startTime, click.decay);
		oscillator.connect(clickGain);
		clickGain.connect(filter);
		oscillators.push(oscillator);
	}

	oscillators.forEach((oscillator) => {
		oscillator.start(startTime);
		oscillator.stop(stopTime);
	});
};

/** TB-303 acid synth: saw/square blend through cascaded 24 dB resonant filters */
const scheduleAcid303Voice = (request: VoiceRequest): void => {
	const { context, settings, startTime, endTime } = request;
	const shape = resolveShape(request);
	const envelopeSeconds = Math.max(0.035, shape.decay * 0.35);
	const primaryFilter = createFilterWithEnvelope(
		request,
		"lowpass",
		envelopeSeconds
	);
	const secondaryFilter = createFilterWithEnvelope(
		{
			...request,
			settings: {
				...settings,
				resonance: clamp(settings.resonance * 0.72, 0.5, 12),
			},
		},
		"lowpass",
		envelopeSeconds
	);
	const preClip = context.createWaveShaper();
	preClip.curve = getSaturationCurve(1.4);

	const amp = context.createGain();
	const stopTime = scheduleAdsr(
		amp.gain,
		startTime,
		endTime,
		velocityGain(request.velocity) * 0.44,
		shape.attack,
		shape.decay,
		shape.sustain,
		shape.release
	);
	primaryFilter.connect(secondaryFilter);
	secondaryFilter.connect(preClip);
	preClip.connect(amp);
	amp.connect(request.output);

	const baseMidi = request.pitch + settings.tune;
	const fineCents = request.instrument.detuneCents;
	const oscillators: Array<OscillatorNode> = [];

	const mainSaw = context.createOscillator();
	mainSaw.type = "sawtooth";
	mainSaw.frequency.value = midiToHz(baseMidi);
	applyPitch(mainSaw.detune, request.pitchPoints, fineCents);
	const sawGain = context.createGain();
	sawGain.gain.value = 0.85;
	mainSaw.connect(sawGain);
	sawGain.connect(primaryFilter);
	oscillators.push(mainSaw);

	const squareBlend = context.createOscillator();
	squareBlend.type = "square";
	squareBlend.frequency.value = midiToHz(baseMidi);
	applyPitch(
		squareBlend.detune,
		request.pitchPoints,
		fineCents + clamp(settings.spread * 0.25, 0, 12)
	);
	const squareGain = context.createGain();
	squareGain.gain.value = settings.spread > 1 ? 0.35 : 0.16;
	squareBlend.connect(squareGain);
	squareGain.connect(primaryFilter);
	oscillators.push(squareBlend);

	oscillators.forEach((oscillator) => {
		oscillator.start(startTime);
		oscillator.stop(stopTime);
	});
};

/** TX81Z "Lately Bass" / UK Garage Donk FM bass */
const scheduleFmBassVoice = (request: VoiceRequest): void => {
	const { context, settings, startTime, endTime } = request;
	const shape = resolveShape(request);
	const frequency = midiToHz(request.pitch + settings.tune);
	const velocity = clamp(request.velocity, 0.1, 1.4);
	const fineCents = request.instrument.detuneCents;

	const filter = createFilterWithEnvelope(
		request,
		"lowpass",
		Math.max(0.05, shape.decay * 0.45)
	);
	const amp = context.createGain();
	const stopTime = scheduleAdsr(
		amp.gain,
		startTime,
		endTime,
		velocityGain(velocity) * 0.56,
		shape.attack,
		shape.decay,
		shape.sustain,
		shape.release
	);
	filter.connect(amp);
	amp.connect(request.output);

	const carrier = context.createOscillator();
	carrier.type = "sine";
	carrier.frequency.value = frequency;
	const modulator = context.createOscillator();
	modulator.type = "sine";
	modulator.frequency.value = frequency * 2;
	const modulationDepth = context.createGain();
	modulationDepth.gain.setValueAtTime(frequency * 5.2 * velocity, startTime);
	modulationDepth.gain.setTargetAtTime(frequency * 0.22, startTime, 0.045);
	modulator.connect(modulationDepth);
	modulationDepth.connect(carrier.frequency);

	const subOscillator = context.createOscillator();
	subOscillator.type = "sine";
	subOscillator.frequency.value = frequency;
	const subGain = context.createGain();
	subGain.gain.value = 0.28;
	subOscillator.connect(subGain);
	subGain.connect(filter);

	const punchPartial = context.createOscillator();
	punchPartial.type = "sine";
	punchPartial.frequency.value = frequency * 3;
	const punchGain = context.createGain();
	punchGain.gain.setValueAtTime(0.16 * velocity, startTime);
	punchGain.gain.setTargetAtTime(0, startTime, 0.022);
	punchPartial.connect(punchGain);
	punchGain.connect(filter);

	applyPitch(carrier.detune, request.pitchPoints, fineCents);
	applyPitch(modulator.detune, request.pitchPoints, fineCents);
	applyPitch(subOscillator.detune, request.pitchPoints, fineCents);
	applyPitch(punchPartial.detune, request.pitchPoints, fineCents);
	carrier.connect(filter);

	[carrier, modulator, subOscillator, punchPartial].forEach((oscillator) => {
		oscillator.start(startTime);
		oscillator.stop(stopTime);
	});
};

/** Alpha Juno / Mentasm Rave Hoover: detuned stereo saws + sub with attack pitch-scoop */
const scheduleHooverVoice = (request: VoiceRequest): void => {
	const { context, settings, startTime, endTime } = request;
	const shape = resolveShape(request);
	const filter = createFilterWithEnvelope(
		request,
		"lowpass",
		Math.max(0.08, shape.decay * 0.65)
	);
	const amp = context.createGain();
	const stopTime = scheduleAdsr(
		amp.gain,
		startTime,
		endTime,
		velocityGain(request.velocity) * 0.36,
		shape.attack,
		shape.decay,
		shape.sustain,
		shape.release
	);
	filter.connect(amp);
	amp.connect(request.output);

	const baseMidi = request.pitch + settings.tune;
	const fineCents = request.instrument.detuneCents;
	const spread = Math.max(10, settings.spread);
	const scoopEnd = startTime + Math.min(0.11, Math.max(0.03, (endTime - startTime) * 0.6));
	const scoopRatio = Math.pow(2, -3.8 / 12);

	const oscillators: Array<OscillatorNode> = [];
	const sawCount = 5;
	for (let index = 0; index < sawCount; index += 1) {
		const position = (index / (sawCount - 1)) * 2 - 1;
		const oscillator = context.createOscillator();
		oscillator.type = "sawtooth";
		const targetFrequency = midiToHz(baseMidi);
		oscillator.frequency.setValueAtTime(targetFrequency * scoopRatio, startTime);
		oscillator.frequency.exponentialRampToValueAtTime(targetFrequency, scoopEnd);
		applyPitch(
			oscillator.detune,
			request.pitchPoints,
			fineCents + position * spread
		);
		const gain = context.createGain();
		gain.gain.value = 0.8 / Math.sqrt(sawCount);
		const panner = context.createStereoPanner();
		panner.pan.value = clamp(position * 0.85, -1, 1);
		oscillator.connect(gain);
		gain.connect(panner);
		panner.connect(filter);
		oscillators.push(oscillator);
	}

	// Sub square & upper octave saw
	const extras: Array<{ type: OscillatorType; semitones: number; gain: number }> = [
		{ type: "square", semitones: -12, gain: 0.36 },
		{ type: "sawtooth", semitones: 12, gain: 0.24 },
	];
	for (const extra of extras) {
		const oscillator = context.createOscillator();
		oscillator.type = extra.type;
		const targetFrequency = midiToHz(baseMidi + extra.semitones);
		oscillator.frequency.setValueAtTime(targetFrequency * scoopRatio, startTime);
		oscillator.frequency.exponentialRampToValueAtTime(targetFrequency, scoopEnd);
		applyPitch(oscillator.detune, request.pitchPoints, fineCents);
		const gain = context.createGain();
		gain.gain.value = extra.gain;
		oscillator.connect(gain);
		gain.connect(filter);
		oscillators.push(oscillator);
	}

	// Signature chorus-style PWM / pitch LFO
	const lfo = context.createOscillator();
	lfo.frequency.value = 4.4;
	const lfoDepth = context.createGain();
	lfoDepth.gain.value = 16;
	lfo.connect(lfoDepth);
	oscillators.forEach((oscillator) => {
		lfoDepth.connect(oscillator.detune);
	});
	oscillators.push(lfo);

	oscillators.forEach((oscillator) => {
		oscillator.start(startTime);
		oscillator.stop(stopTime);
	});
};

/** Formant vocal chop / pad: detuned saws + breath routed through parallel vowel filters */
const scheduleVocalChopVoice = (request: VoiceRequest): void => {
	const { context, settings, startTime, endTime } = request;
	const shape = resolveShape(request);
	const filter = createFilterWithEnvelope(
		request,
		"lowpass",
		Math.max(0.08, shape.decay * 0.8)
	);
	const amp = context.createGain();
	const stopTime = scheduleAdsr(
		amp.gain,
		startTime,
		endTime,
		velocityGain(request.velocity) * 0.9,
		shape.attack,
		shape.decay,
		shape.sustain,
		shape.release
	);
	filter.connect(amp);
	amp.connect(request.output);

	const voiceSum = context.createGain();
	voiceSum.gain.value = 1;

	const formants: Array<{ frequency: number; q: number; gain: number }> = [
		{ frequency: 730, q: 5.5, gain: 1 },
		{ frequency: 1150, q: 7.2, gain: 0.72 },
		{ frequency: 2650, q: 8.5, gain: 0.35 },
	];
	for (const spec of formants) {
		const formant = context.createBiquadFilter();
		formant.type = "bandpass";
		formant.frequency.value = spec.frequency;
		formant.Q.value = spec.q;
		const formantGain = context.createGain();
		formantGain.gain.value = spec.gain;
		voiceSum.connect(formant);
		formant.connect(formantGain);
		formantGain.connect(filter);
	}
	const chest = context.createBiquadFilter();
	chest.type = "lowpass";
	chest.frequency.value = 420;
	const chestGain = context.createGain();
	chestGain.gain.value = 0.22;
	voiceSum.connect(chest);
	chest.connect(chestGain);
	chestGain.connect(filter);

	const baseMidi = request.pitch + settings.tune;
	const fineCents = request.instrument.detuneCents;
	const spread = Math.max(6, settings.spread * 0.6);
	const oscillators: Array<OscillatorNode> = [];
	const layers: Array<{
		type: OscillatorType;
		detune: number;
		pan: number;
		gain: number;
	}> = [
		{ type: "sawtooth", detune: -spread, pan: -0.45, gain: 0.34 },
		{ type: "sawtooth", detune: 0, pan: 0, gain: 0.38 },
		{ type: "sawtooth", detune: spread, pan: 0.45, gain: 0.34 },
		{ type: "triangle", detune: 0, pan: 0, gain: 0.28 },
	];

	for (const layer of layers) {
		const oscillator = context.createOscillator();
		oscillator.type = layer.type;
		oscillator.frequency.value = midiToHz(baseMidi);
		applyPitch(
			oscillator.detune,
			request.pitchPoints,
			fineCents + layer.detune
		);
		const gain = context.createGain();
		gain.gain.value = layer.gain;
		const panner = context.createStereoPanner();
		panner.pan.value = layer.pan;
		oscillator.connect(gain);
		gain.connect(panner);
		panner.connect(voiceSum);
		oscillators.push(oscillator);
	}

	const lfo = context.createOscillator();
	lfo.frequency.value = 5.2;
	const lfoDepth = context.createGain();
	lfoDepth.gain.setValueAtTime(0, startTime);
	lfoDepth.gain.setValueAtTime(0, startTime + 0.16);
	lfoDepth.gain.linearRampToValueAtTime(10, startTime + 0.42);
	lfo.connect(lfoDepth);
	oscillators.forEach((oscillator) => {
		lfoDepth.connect(oscillator.detune);
	});
	oscillators.push(lfo);

	// Soft breath air
	const breath = context.createBufferSource();
	breath.buffer = getNoiseBuffer(context);
	breath.loop = true;
	const breathFilter = context.createBiquadFilter();
	breathFilter.type = "bandpass";
	breathFilter.frequency.value = 3200;
	breathFilter.Q.value = 0.8;
	const breathGain = context.createGain();
	breathGain.gain.value = 0.04;
	breath.connect(breathFilter);
	breathFilter.connect(breathGain);
	breathGain.connect(filter);
	breath.start(startTime);
	breath.stop(stopTime);

	oscillators.forEach((oscillator) => {
		oscillator.start(startTime);
		oscillator.stop(stopTime);
	});
};

// ─── Sample engines ──────────────────────────────────────────────────────────

const playBufferVoice = (
	request: VoiceRequest,
	buffer: AudioBuffer,
	options: {
		playbackRate: number;
		offset?: number;
		/** Max seconds of buffer time to play */
		bufferDuration?: number;
		brightness?: boolean;
		level: number;
	}
): void => {
	const { context, settings, startTime } = request;
	const shape = resolveShape(request);
	const source = context.createBufferSource();
	source.buffer = buffer;
	// Pitch automation goes through playbackRate: some wrapped contexts (Tone's
	// standardized-audio-context) don't expose AudioBufferSourceNode.detune.
	applyPitchToRate(
		source.playbackRate,
		request.pitchPoints,
		options.playbackRate,
		request.instrument.detuneCents
	);

	const filter = context.createBiquadFilter();
	filter.type = "lowpass";
	filter.Q.value = clamp(settings.resonance, 0.3, 12);
	const baseCutoff = clamp(
		request.cutoffOverride ?? settings.cutoff,
		60,
		19_000
	);
	// Softer notes are darker, like a real piano hammer
	filter.frequency.value = options.brightness
		? Math.min(
				baseCutoff,
				900 + 17_000 * Math.pow(clamp(request.velocity, 0.05, 1.2), 2)
			)
		: baseCutoff;
	if (request.cutoffSweepTo !== undefined) {
		filter.frequency.setValueAtTime(filter.frequency.value, startTime);
		filter.frequency.exponentialRampToValueAtTime(
			clamp(request.cutoffSweepTo, 40, 19_000),
			Math.max(startTime + 0.02, request.endTime)
		);
	}

	const amp = context.createGain();
	let endTime = request.endTime;
	if (options.bufferDuration !== undefined) {
		const sampleEnd =
			startTime + options.bufferDuration / Math.max(0.01, options.playbackRate);
		endTime = Math.min(endTime, sampleEnd - Math.min(0.006, shape.release));
	}
	const stopTime = scheduleAdsr(
		amp.gain,
		startTime,
		Math.max(startTime + 0.004, endTime),
		velocityGain(request.velocity) * options.level,
		shape.attack,
		shape.decay,
		shape.sustain,
		shape.release
	);
	source.connect(filter);
	filter.connect(amp);
	amp.connect(request.output);
	const offset = options.offset ?? 0;
	if (options.bufferDuration !== undefined) {
		source.start(startTime, offset, options.bufferDuration);
	} else {
		source.start(startTime, offset);
	}
	source.stop(stopTime);
};

const SAMPLE_LEVEL: Partial<Record<ModernEngine, number>> = {
	grandPiano: 1,
	strings: 0.5,
	harp: 0.85,
};

const scheduleBuiltInSampleVoice = (request: VoiceRequest): boolean => {
	const instrument = ENGINE_SAMPLE_INSTRUMENT[request.settings.engine];
	if (!instrument) {
		return false;
	}
	const midi = request.pitch + request.settings.tune;
	const zone = getBuiltInZone(instrument, midi);
	if (!zone) {
		return false;
	}
	playBufferVoice(request, zone.buffer, {
		playbackRate: Math.pow(2, (midi - zone.rootMidi) / 12),
		brightness: request.settings.engine === "grandPiano",
		level: SAMPLE_LEVEL[request.settings.engine] ?? 0.9,
	});
	return true;
};

/** Slice index played by a key: C3 (48) = slice 1, C#3 = slice 2, … */
export const SLICER_BASE_MIDI = 48;

export const resolveSliceIndex = (
	pitch: number,
	sliceCount: number
): number => {
	const count = Math.max(1, Math.round(sliceCount));
	return (((pitch - SLICER_BASE_MIDI) % count) + count) % count;
};

const scheduleUserSampleVoice = (request: VoiceRequest): boolean => {
	const { settings } = request;
	if (!settings.sampleId) {
		return false;
	}
	const buffer = getUserSampleBuffer(settings.sampleId);
	if (!buffer) {
		return false;
	}
	const tuneRate = Math.pow(2, settings.tune / 12);
	if (settings.engine === "slicer") {
		const sliceCount = clamp(Math.round(settings.sliceCount ?? 16), 1, 64);
		const sliceSeconds = buffer.duration / sliceCount;
		const barSeconds = (60 / Math.max(1, request.bpm)) * 4;
		const fitRate =
			settings.fitToTempo !== false
				? buffer.duration /
					(Math.max(0.25, settings.sliceBars ?? 1) * barSeconds)
				: 1;
		const sliceIndex = resolveSliceIndex(request.pitch, sliceCount);
		playBufferVoice(request, buffer, {
			playbackRate: clamp(fitRate * tuneRate, 0.05, 8),
			offset: sliceIndex * sliceSeconds,
			bufferDuration: sliceSeconds,
			level: 0.95,
		});
		return true;
	}
	const rootMidi = settings.sampleRootMidi ?? 60;
	playBufferVoice(request, buffer, {
		playbackRate: clamp(
			Math.pow(2, (request.pitch - rootMidi) / 12) * tuneRate,
			0.05,
			8
		),
		bufferDuration: buffer.duration,
		level: 0.9,
	});
	return true;
};

// ─── Drum kits ───────────────────────────────────────────────────────────────

type DrumStyle = "drumKit" | "breakKit" | "houseKit" | "gabberKit";

interface DrumHit {
	context: BaseAudioContext;
	output: AudioNode;
	time: number;
	velocity: number;
	/** Pitch multiplier from the kit tune */
	tune: number;
	style: DrumStyle;
}

const connectChain = (nodes: Array<AudioNode>): void => {
	for (let index = 0; index < nodes.length - 1; index += 1) {
		const from = nodes[index];
		const to = nodes[index + 1];
		if (from && to) {
			from.connect(to);
		}
	}
};

const noiseBurst = (
	hit: DrumHit,
	filters: Array<{ type: BiquadFilterType; frequency: number; q?: number }>,
	level: number,
	decay: number,
	attack = 0.001
): void => {
	const { context, time } = hit;
	const source = context.createBufferSource();
	source.buffer = getNoiseBuffer(context);
	const filterNodes = filters.map((spec) => {
		const filter = context.createBiquadFilter();
		filter.type = spec.type;
		filter.frequency.value = spec.frequency;
		filter.Q.value = spec.q ?? 0.7;
		return filter;
	});
	const gain = context.createGain();
	gain.gain.setValueAtTime(0, time);
	gain.gain.linearRampToValueAtTime(level * hit.velocity, time + attack);
	gain.gain.setTargetAtTime(0, time + attack, decay / 4);
	connectChain([source, ...filterNodes, gain, hit.output]);
	// Random start in the noise so repeated hats don't sound identical
	const offset = ((time * 7919) % 1.5) + 0.01;
	source.start(time, offset);
	source.stop(time + attack + decay * 1.6 + 0.02);
};

const tonalHit = (
	hit: DrumHit,
	type: OscillatorType,
	startHz: number,
	endHz: number,
	sweep: number,
	level: number,
	decay: number,
	saturate = 0
): void => {
	const { context, time } = hit;
	const oscillator = context.createOscillator();
	oscillator.type = type;
	oscillator.frequency.setValueAtTime(startHz * hit.tune, time);
	oscillator.frequency.exponentialRampToValueAtTime(
		Math.max(20, endHz * hit.tune),
		time + sweep
	);
	const gain = context.createGain();
	gain.gain.setValueAtTime(0, time);
	gain.gain.linearRampToValueAtTime(level * hit.velocity, time + 0.002);
	gain.gain.setTargetAtTime(0, time + 0.002, decay / 4);
	if (saturate > 0) {
		const shaper = context.createWaveShaper();
		shaper.curve = getSaturationCurve(saturate);
		connectChain([oscillator, shaper, gain, hit.output]);
	} else {
		connectChain([oscillator, gain, hit.output]);
	}
	oscillator.start(time);
	oscillator.stop(time + 0.002 + decay * 1.6 + 0.02);
};

/** Six detuned squares through a band-pass — the classic metallic cymbal source */
const metallicHit = (
	hit: DrumHit,
	level: number,
	decay: number,
	highpass: number
): void => {
	const { context, time } = hit;
	const ratios = [2, 3, 4.16, 5.43, 6.79, 8.21];
	const sum = context.createGain();
	sum.gain.value = 1 / ratios.length;
	const oscillators = ratios.map((ratio) => {
		const oscillator = context.createOscillator();
		oscillator.type = "square";
		oscillator.frequency.value = 40 * ratio * hit.tune * 2.3;
		oscillator.connect(sum);
		return oscillator;
	});
	const bandpass = context.createBiquadFilter();
	bandpass.type = "bandpass";
	bandpass.frequency.value = 10_000;
	bandpass.Q.value = 0.6;
	const highpassFilter = context.createBiquadFilter();
	highpassFilter.type = "highpass";
	highpassFilter.frequency.value = highpass;
	const gain = context.createGain();
	gain.gain.setValueAtTime(0, time);
	gain.gain.linearRampToValueAtTime(level * hit.velocity, time + 0.001);
	gain.gain.setTargetAtTime(0, time + 0.001, decay / 4);
	connectChain([sum, bandpass, highpassFilter, gain, hit.output]);
	oscillators.forEach((oscillator) => {
		oscillator.start(time);
		oscillator.stop(time + decay * 1.6 + 0.03);
	});
};

const scheduleKick = (hit: DrumHit): void => {
	if (hit.style === "gabberKit") {
		// Brutal distorted gabber kick: fast pitch dive into heavy clipped body
		tonalHit(hit, "triangle", 320, 54, 0.05, 1.05, 0.42, 7.5);
		tonalHit(hit, "square", 160, 52, 0.05, 0.36, 0.34, 5);
		noiseBurst(
			hit,
			[
				{ type: "bandpass", frequency: 2800, q: 1 },
				{ type: "highpass", frequency: 1400 },
			],
			0.55,
			0.014
		);
		return;
	}
	if (hit.style === "houseKit") {
		// Tight 909 four-on-the-floor club kick
		tonalHit(hit, "sine", 185, 50, 0.055, 1.12, 0.38, 1.1);
		noiseBurst(
			hit,
			[
				{ type: "highpass", frequency: 2400 },
				{ type: "lowpass", frequency: 8500 },
			],
			0.42,
			0.011
		);
		return;
	}
	const isBreak = hit.style === "breakKit";
	// Body: fast pitch drop into a round sub, lightly saturated
	tonalHit(
		hit,
		"sine",
		isBreak ? 120 : 165,
		isBreak ? 52 : 46,
		isBreak ? 0.06 : 0.085,
		isBreak ? 1 : 1.1,
		isBreak ? 0.32 : 0.5,
		isBreak ? 0.8 : 1.4
	);
	// Beater click
	noiseBurst(
		hit,
		[
			{ type: "highpass", frequency: isBreak ? 1500 : 2600 },
			{ type: "lowpass", frequency: 9000 },
		],
		isBreak ? 0.5 : 0.38,
		isBreak ? 0.022 : 0.012
	);
	if (isBreak) {
		// Acoustic shell resonance
		tonalHit(hit, "triangle", 95, 70, 0.04, 0.25, 0.12);
	}
};

const scheduleSnare = (hit: DrumHit): void => {
	if (hit.style === "gabberKit") {
		tonalHit(hit, "triangle", 265, 180, 0.045, 0.68, 0.16, 2.5);
		tonalHit(hit, "sine", 380, 340, 0.03, 0.24, 0.18);
		noiseBurst(
			hit,
			[
				{ type: "highpass", frequency: 1100 },
				{ type: "peaking", frequency: 4400, q: 0.9 },
				{ type: "lowpass", frequency: 12_000 },
			],
			0.92,
			0.26
		);
		return;
	}
	if (hit.style === "houseKit") {
		tonalHit(hit, "triangle", 195, 155, 0.04, 0.55, 0.11);
		noiseBurst(
			hit,
			[
				{ type: "highpass", frequency: 1800 },
				{ type: "peaking", frequency: 4800, q: 0.9 },
				{ type: "lowpass", frequency: 12_500 },
			],
			0.78,
			0.16
		);
		return;
	}
	const isBreak = hit.style === "breakKit";
	tonalHit(
		hit,
		"triangle",
		isBreak ? 240 : 205,
		isBreak ? 190 : 165,
		0.045,
		isBreak ? 0.62 : 0.55,
		isBreak ? 0.16 : 0.11
	);
	if (isBreak) {
		// Ringy top head like a sampled funk snare
		tonalHit(hit, "sine", 340, 320, 0.03, 0.18, 0.2);
	}
	noiseBurst(
		hit,
		[
			{ type: "highpass", frequency: isBreak ? 900 : 1300 },
			{ type: "peaking", frequency: isBreak ? 3500 : 5200, q: 0.8 },
			{ type: "lowpass", frequency: isBreak ? 9500 : 13_000 },
		],
		isBreak ? 0.85 : 0.75,
		isBreak ? 0.24 : 0.17
	);
};

const scheduleClap = (hit: DrumHit): void => {
	const bursts =
		hit.style === "houseKit" ? [0, 0.01, 0.02, 0.03] : [0, 0.009, 0.019];
	const bandpassFrequency =
		hit.style === "gabberKit" ? 1600 : hit.style === "houseKit" ? 1250 : 1400;
	bursts.forEach((offset) => {
		noiseBurst(
			{ ...hit, time: hit.time + offset },
			[
				{ type: "bandpass", frequency: bandpassFrequency, q: 1.1 },
				{ type: "highpass", frequency: 700 },
			],
			0.7,
			0.03
		);
	});
	noiseBurst(
		{ ...hit, time: hit.time + (hit.style === "houseKit" ? 0.035 : 0.026) },
		[
			{ type: "bandpass", frequency: bandpassFrequency - 100, q: 0.9 },
			{ type: "highpass", frequency: 600 },
		],
		0.55,
		hit.style === "breakKit" ? 0.14 : hit.style === "houseKit" ? 0.22 : 0.18
	);
};

const resolveDrumStyle = (engine: ModernEngine): DrumStyle => {
	if (
		engine === "breakKit" ||
		engine === "houseKit" ||
		engine === "gabberKit"
	) {
		return engine;
	}
	return "drumKit";
};

const scheduleDrumKitHit = (request: VoiceRequest): void => {
	const style = resolveDrumStyle(request.settings.engine);
	const hit: DrumHit = {
		context: request.context,
		output: request.output,
		time: request.startTime,
		velocity: clamp(request.velocity, 0.05, 1.5),
		tune: Math.pow(2, request.settings.tune / 12),
		style,
	};
	const isBreak = style === "breakKit";
	const isHouse = style === "houseKit";
	const isGabber = style === "gabberKit";
	switch (Math.round(request.pitch)) {
		case 0: {
			scheduleKick(hit);
			request.onKick?.(hit.time, hit.velocity);
			break;
		}
		case 1: {
			scheduleSnare(hit);
			break;
		}
		case 2: {
			noiseBurst(
				hit,
				[
					{
						type: "highpass",
						frequency: isGabber ? 9500 : isHouse ? 8800 : isBreak ? 6500 : 8000,
					},
					{ type: "peaking", frequency: 11_000, q: 1 },
				],
				isGabber ? 0.44 : isBreak ? 0.42 : 0.36,
				isGabber ? 0.032 : isHouse ? 0.045 : isBreak ? 0.065 : 0.045
			);
			metallicHit(
				hit,
				isBreak ? 0.12 : 0.1,
				isGabber ? 0.028 : 0.04,
				isHouse ? 7600 : 7000
			);
			break;
		}
		case 3: {
			noiseBurst(
				hit,
				[
					{
						type: "highpass",
						frequency: isHouse ? 7800 : isBreak || isGabber ? 6000 : 7500,
					},
				],
				isGabber ? 0.4 : 0.34,
				isHouse ? 0.38 : isBreak ? 0.42 : 0.34
			);
			metallicHit(
				hit,
				isGabber ? 0.2 : 0.16,
				isHouse ? 0.36 : isBreak ? 0.4 : 0.3,
				6500
			);
			break;
		}
		case 4:
		case 5: {
			const isHigh = Math.round(request.pitch) === 5;
			if (isHouse && isHigh) {
				// 909 Rimshot
				tonalHit(hit, "triangle", 440, 360, 0.018, 0.72, 0.045);
				noiseBurst(
					hit,
					[{ type: "bandpass", frequency: 1650, q: 1.4 }],
					0.45,
					0.025
				);
				break;
			}
			if (isGabber && isHigh) {
				// Pitched jungle ghost snare / rim
				tonalHit(hit, "triangle", 310, 220, 0.025, 0.75, 0.08, 1.5);
				noiseBurst(
					hit,
					[{ type: "bandpass", frequency: 2800, q: 1.1 }],
					0.48,
					0.075
				);
				break;
			}
			tonalHit(
				hit,
				"sine",
				isGabber && !isHigh
					? 165
					: (isHigh ? 210 : 145) * (isBreak ? 1.1 : 1),
				isGabber && !isHigh
					? 48
					: (isHigh ? 150 : 90) * (isBreak ? 1.1 : 1),
				0.12,
				0.85,
				isGabber ? 0.34 : isBreak ? 0.26 : 0.34,
				isGabber ? 2.5 : 0.5
			);
			noiseBurst(
				hit,
				[{ type: "bandpass", frequency: isHigh ? 2600 : 1800, q: 0.8 }],
				0.12,
				0.05
			);
			break;
		}
		case 6: {
			scheduleClap(hit);
			break;
		}
		default: {
			if (isGabber) {
				// Amen kick + snare chop layered with bright crash wash
				scheduleKick({ ...hit, velocity: hit.velocity * 0.85 });
				scheduleSnare({ ...hit, velocity: hit.velocity * 0.85 });
				metallicHit(hit, 0.16, 0.7, 5000);
			} else if (isHouse) {
				// Shimmering 909 house ride
				metallicHit(hit, 0.26, 0.85, 5200);
				tonalHit(hit, "sine", 3400, 3320, 0.1, 0.08, 0.55);
				noiseBurst(hit, [{ type: "highpass", frequency: 7500 }], 0.14, 0.55);
			} else if (isBreak) {
				// Ride: bell ping + shimmering wash
				metallicHit(hit, 0.24, 0.9, 4500);
				tonalHit(hit, "sine", 2950, 2900, 0.1, 0.08, 0.6);
				noiseBurst(hit, [{ type: "highpass", frequency: 7000 }], 0.12, 0.6);
			} else {
				// Crash
				noiseBurst(
					hit,
					[
						{ type: "highpass", frequency: 4200 },
						{ type: "lowpass", frequency: 15_000 },
					],
					0.42,
					1.5,
					0.004
				);
				metallicHit(hit, 0.2, 1.2, 4000);
			}
			break;
		}
	}
};

// ─── Entry point ─────────────────────────────────────────────────────────────

export const isModernDrumEngine = (engine: ModernEngine): boolean =>
	engine === "drumKit" ||
	engine === "breakKit" ||
	engine === "houseKit" ||
	engine === "gabberKit";

/**
 * Schedule one note on a modern engine. Returns false when the sound isn't
 * ready (samples still loading / missing) so nothing was played.
 */
export const scheduleModernVoice = (request: VoiceRequest): boolean => {
	const engine = request.settings.engine;
	if (isModernDrumEngine(engine)) {
		scheduleDrumKitHit(request);
		return true;
	}
	if (engine === "sampler" || engine === "slicer") {
		return scheduleUserSampleVoice(request);
	}
	if (ENGINE_SAMPLE_INSTRUMENT[engine]) {
		return scheduleBuiltInSampleVoice(request);
	}
	if (engine === "ePiano" || engine === "bell") {
		scheduleFmVoice(request, engine);
		return true;
	}
	if (engine === "houseOrgan") {
		scheduleHouseOrganVoice(request);
		return true;
	}
	if (engine === "acid303") {
		scheduleAcid303Voice(request);
		return true;
	}
	if (engine === "fmBass") {
		scheduleFmBassVoice(request);
		return true;
	}
	if (engine === "hoover") {
		scheduleHooverVoice(request);
		return true;
	}
	if (engine === "vocalChop") {
		scheduleVocalChopVoice(request);
		return true;
	}
	const recipe = SYNTH_RECIPES[engine];
	if (!recipe) {
		return false;
	}
	scheduleSynthVoice(request, recipe);
	return true;
};

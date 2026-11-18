interface CachedAudioAssets {
	pulse12: PeriodicWave;
	pulse25: PeriodicWave;
	triangle4Bit: PeriodicWave;
	whiteNoiseBuffer: AudioBuffer;
	metallicNoiseBuffer: AudioBuffer;
}

const contextAssetCache = new WeakMap<BaseAudioContext, CachedAudioAssets>();

const createPulsePeriodicWave = (
	audioContext: BaseAudioContext,
	dutyCycle: number
): PeriodicWave => {
	const harmonicCount = 48;
	const real = new Float32Array(harmonicCount);
	const imaginary = new Float32Array(harmonicCount);

	for (let harmonic = 1; harmonic < harmonicCount; harmonic += 1) {
		const coefficient =
			(2 / (harmonic * Math.PI)) * Math.sin(harmonic * Math.PI * dutyCycle);
		real[harmonic] = coefficient;
		imaginary[harmonic] = 0;
	}

	return audioContext.createPeriodicWave(real, imaginary, {
		disableNormalization: false,
	});
};

const createSteppedTriangleWave = (
	audioContext: BaseAudioContext
): PeriodicWave => {
	// Synthesize a gritty 4-bit quantized NES triangle staircase using Fourier coefficients
	const harmonicCount = 32;
	const real = new Float32Array(harmonicCount);
	const imaginary = new Float32Array(harmonicCount);

	for (let harmonic = 1; harmonic < harmonicCount; harmonic += 2) {
		const sign = ((harmonic - 1) / 2) % 2 === 0 ? 1 : -1;
		imaginary[harmonic] =
			(8 / (Math.PI * Math.PI * harmonic * harmonic)) * sign;
	}

	return audioContext.createPeriodicWave(real, imaginary, {
		disableNormalization: false,
	});
};

const createWhiteNoiseBuffer = (
	audioContext: BaseAudioContext,
	durationSeconds: number
): AudioBuffer => {
	const sampleRate = audioContext.sampleRate;
	const frameCount = Math.floor(sampleRate * durationSeconds);
	const buffer = audioContext.createBuffer(1, frameCount, sampleRate);
	const data = buffer.getChannelData(0);

	// Deterministic 15-bit LFSR-inspired stepped noise for authentic NES/GB crunch
	let lfsr = 0x7fff;
	const holdSamples = Math.max(1, Math.floor(sampleRate / 22050));
	let currentSample = 0;

	for (let index = 0; index < frameCount; index += 1) {
		if (index % holdSamples === 0) {
			const feedback = (lfsr & 1) ^ ((lfsr >> 1) & 1);
			lfsr = (lfsr >> 1) | (feedback << 14);
			currentSample = (lfsr & 1) === 1 ? 0.85 : -0.85;
		}
		data[index] = currentSample;
	}

	return buffer;
};

const createMetallicNoiseBuffer = (
	audioContext: BaseAudioContext,
	durationSeconds: number
): AudioBuffer => {
	const sampleRate = audioContext.sampleRate;
	const frameCount = Math.floor(sampleRate * durationSeconds);
	const buffer = audioContext.createBuffer(1, frameCount, sampleRate);
	const data = buffer.getChannelData(0);

	// Short-period 93-bit-like tonal LFSR for retro metallic hats and cymbals
	let lfsr = 0x4a2f;
	const holdSamples = Math.max(1, Math.floor(sampleRate / 14000));
	let currentSample = 0;

	for (let index = 0; index < frameCount; index += 1) {
		if (index % holdSamples === 0) {
			const feedback = (lfsr & 1) ^ ((lfsr >> 6) & 1);
			lfsr = (lfsr >> 1) | (feedback << 13);
			currentSample = (lfsr & 1) === 1 ? 0.8 : -0.8;
		}
		data[index] = currentSample;
	}

	return buffer;
};

export const getAudioAssetsForContext = (
	audioContext: BaseAudioContext
): CachedAudioAssets => {
	const existing = contextAssetCache.get(audioContext);
	if (existing) {
		return existing;
	}

	const created: CachedAudioAssets = {
		pulse12: createPulsePeriodicWave(audioContext, 0.125),
		pulse25: createPulsePeriodicWave(audioContext, 0.25),
		triangle4Bit: createSteppedTriangleWave(audioContext),
		whiteNoiseBuffer: createWhiteNoiseBuffer(audioContext, 0.6),
		metallicNoiseBuffer: createMetallicNoiseBuffer(audioContext, 0.5),
	};

	contextAssetCache.set(audioContext, created);
	return created;
};

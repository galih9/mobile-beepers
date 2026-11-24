import { PitchDetector } from "pitchy";
import {
	isMidiNoteInScale,
	MELODIC_MAX_MIDI,
	MELODIC_MIN_MIDI,
	midiToNoteName,
} from "../constants/scalesAndNotes";
import type { MusicalKey, NoteEvent, ScaleType } from "../types/music";

export const HUM_DETECTOR_BUFFER_SIZE = 2048;
export const MIN_HUM_FREQUENCY_HZ = 65; // ~C2
export const MAX_HUM_FREQUENCY_HZ = 1100; // ~C#6
export const DEFAULT_MIN_CLARITY = 0.85;
export const DEFAULT_MIN_RMS = 0.015;
export const DEFAULT_MIN_NOTE_MS = 75;
export const MAX_DROPOUT_BRIDGE_MS = 60;

export type HumQuantizeGrid = 1 | 2 | 4;

export interface LivePitchReading {
	frequencyHz: number;
	clarity: number;
	rms: number;
	midi: number | null;
	noteName: string | null;
	centsOffset: number;
}

export interface HumPitchFrame {
	timeMs: number;
	frequencyHz: number;
	clarity: number;
	rms: number;
}

export interface HumQuantizeOptions {
	bpm: number;
	beatsPerBar: number;
	stepsPerBeat: number;
	barCount: number;
	rootKey: MusicalKey;
	scale: ScaleType;
	snapToScale: boolean;
	quantizeSteps: HumQuantizeGrid;
	octaveShift: number;
	minimumClarity?: number;
	minimumRms?: number;
	minNoteMs?: number;
}

export interface HumQuantizedNote extends Omit<NoteEvent, "id"> {
	barOffset: number;
	globalStep: number;
}

export interface HumQuantizedResult {
	notesByBar: Array<Array<Omit<NoteEvent, "id">>>;
	flatNotes: Array<HumQuantizedNote>;
}

/**
 * Computes root-mean-square amplitude of a time-domain buffer.
 */
export const computeRms = (samples: Float32Array): number => {
	if (samples.length === 0) {
		return 0;
	}
	let squareSum = 0;
	for (let index = 0; index < samples.length; index += 1) {
		const sample = samples[index] ?? 0;
		squareSum += sample * sample;
	}
	return Math.sqrt(squareSum / samples.length);
};

/**
 * Converts a frequency in Hz to a continuous MIDI note number.
 */
export const frequencyToMidiFloat = (frequencyHz: number): number =>
	69 + 12 * Math.log2(frequencyHz / 440);

/**
 * Folds an arbitrary MIDI note by octaves into the studio's playable piano-roll range (C2–C6).
 */
export const clampMidiToMelodicRange = (midi: number): number => {
	let adjusted = Math.round(midi);
	while (adjusted < MELODIC_MIN_MIDI) {
		adjusted += 12;
	}
	while (adjusted > MELODIC_MAX_MIDI) {
		adjusted -= 12;
	}
	return Math.max(MELODIC_MIN_MIDI, Math.min(MELODIC_MAX_MIDI, adjusted));
};

/**
 * Snaps a MIDI pitch to the closest note in the active key and scale.
 */
export const snapMidiToScale = (
	midi: number,
	rootKey: MusicalKey,
	scale: ScaleType
): number => {
	const clamped = Math.max(
		MELODIC_MIN_MIDI,
		Math.min(MELODIC_MAX_MIDI, Math.round(midi))
	);
	if (scale === "chromatic" || isMidiNoteInScale(clamped, rootKey, scale)) {
		return clamped;
	}
	for (let distance = 1; distance <= 12; distance += 1) {
		const upper = clamped + distance;
		if (upper <= MELODIC_MAX_MIDI && isMidiNoteInScale(upper, rootKey, scale)) {
			return upper;
		}
		const lower = clamped - distance;
		if (lower >= MELODIC_MIN_MIDI && isMidiNoteInScale(lower, rootKey, scale)) {
			return lower;
		}
	}
	return clamped;
};

export interface HumPitchDetectorHandle {
	readonly bufferSize: number;
	detect: (
		samples: Float32Array,
		sampleRate: number,
		minimumClarity?: number,
		minimumRms?: number
	) => LivePitchReading;
}

/**
 * Creates a reusable Pitchy McLeod Pitch Method detector for live Float32Array frames.
 */
export const createHumPitchDetector = (
	bufferSize = HUM_DETECTOR_BUFFER_SIZE
): HumPitchDetectorHandle => {
	const detector = PitchDetector.forFloat32Array(bufferSize);
	detector.clarityThreshold = 0.8;
	detector.minVolumeAbsolute = 0;

	return {
		bufferSize,
		detect: (
			samples: Float32Array,
			sampleRate: number,
			minimumClarity = DEFAULT_MIN_CLARITY,
			minimumRms = DEFAULT_MIN_RMS
		): LivePitchReading => {
			const rms = computeRms(samples);
			if (
				samples.length !== bufferSize ||
				rms < minimumRms ||
				!Number.isFinite(sampleRate) ||
				sampleRate <= 0
			) {
				return {
					frequencyHz: 0,
					clarity: 0,
					rms,
					midi: null,
					noteName: null,
					centsOffset: 0,
				};
			}

			const [rawFrequency, rawClarity] = detector.findPitch(
				samples,
				sampleRate
			);
			const isValid =
				Number.isFinite(rawFrequency) &&
				Number.isFinite(rawClarity) &&
				rawClarity >= minimumClarity &&
				rawFrequency >= MIN_HUM_FREQUENCY_HZ &&
				rawFrequency <= MAX_HUM_FREQUENCY_HZ;

			if (!isValid) {
				return {
					frequencyHz: Number.isFinite(rawFrequency) ? rawFrequency : 0,
					clarity: Number.isFinite(rawClarity) ? rawClarity : 0,
					rms,
					midi: null,
					noteName: null,
					centsOffset: 0,
				};
			}

			const midiFloat = frequencyToMidiFloat(rawFrequency);
			const nearestMidi = Math.round(midiFloat);
			const centsOffset = Math.round((midiFloat - nearestMidi) * 100);

			return {
				frequencyHz: rawFrequency,
				clarity: rawClarity,
				rms,
				midi: nearestMidi,
				noteName: midiToNoteName(nearestMidi),
				centsOffset,
			};
		},
	};
};

interface RawPitchSegment {
	midi: number;
	startMs: number;
	endMs: number;
	averageRms: number;
	frameCount: number;
	precededBySilence: boolean;
}

interface QuantizedMonophonicNote {
	pitch: number;
	startStep: number;
	duration: number;
	velocity: number;
	rawDurationMs: number;
	precededBySilence: boolean;
}

const medianOfThree = (first: number, second: number, third: number): number => {
	const sorted = [first, second, third].sort((left, right) => left - right);
	return sorted[1] ?? second;
};

/**
 * Smooths, segments, scale-snaps, and quantizes raw pitch frames into bar-aligned NoteEvents.
 */
export const quantizeHumFramesToNotes = (
	frames: Array<HumPitchFrame>,
	options: HumQuantizeOptions
): HumQuantizedResult => {
	const barCount = Math.max(1, Math.round(options.barCount));
	const beatsPerBar = Math.max(1, Math.round(options.beatsPerBar));
	const stepsPerBeat = Math.max(1, Math.round(options.stepsPerBeat));
	const stepsPerBar = beatsPerBar * stepsPerBeat;
	const totalSteps = barCount * stepsPerBar;

	const emptyResult = (): HumQuantizedResult => ({
		notesByBar: Array.from({ length: barCount }, () => []),
		flatNotes: [],
	});

	if (frames.length === 0) {
		return emptyResult();
	}

	const minimumClarity = options.minimumClarity ?? DEFAULT_MIN_CLARITY;
	const minimumRms = options.minimumRms ?? DEFAULT_MIN_RMS;
	const minNoteMs = options.minNoteMs ?? DEFAULT_MIN_NOTE_MS;
	const quantizeSteps = Math.max(1, Math.round(options.quantizeSteps));
	const sortedFrames = [...frames].sort(
		(left, right) => left.timeMs - right.timeMs
	);

	// Step 1: Convert each frame to an integer MIDI pitch or null when unvoiced
	const rawMidis: Array<number | null> = sortedFrames.map((frame) => {
		const isVoiced =
			frame.rms >= minimumRms &&
			frame.clarity >= minimumClarity &&
			Number.isFinite(frame.frequencyHz) &&
			frame.frequencyHz >= MIN_HUM_FREQUENCY_HZ &&
			frame.frequencyHz <= MAX_HUM_FREQUENCY_HZ;
		if (!isVoiced) {
			return null;
		}
		return Math.round(frequencyToMidiFloat(frame.frequencyHz));
	});

	// Step 2: 3-frame median smoothing over voiced neighbors to suppress single-frame octave glitches
	const smoothedMidis: Array<number | null> = rawMidis.map((midi, index) => {
		if (midi === null) {
			return null;
		}
		const previous = rawMidis[index - 1] ?? null;
		const next = rawMidis[index + 1] ?? null;
		if (previous !== null && next !== null) {
			return medianOfThree(previous, midi, next);
		}
		return midi;
	});

	// Step 3: Bridge brief unvoiced dropouts (<= MAX_DROPOUT_BRIDGE_MS) when surrounding pitch matches
	let indexCursor = 0;
	while (indexCursor < smoothedMidis.length) {
		if (smoothedMidis[indexCursor] !== null) {
			indexCursor += 1;
			continue;
		}
		const gapStart = indexCursor;
		while (
			indexCursor < smoothedMidis.length &&
			smoothedMidis[indexCursor] === null
		) {
			indexCursor += 1;
		}
		const gapEnd = indexCursor - 1;
		const beforeIndex = gapStart - 1;
		const afterIndex = indexCursor;
		if (beforeIndex >= 0 && afterIndex < smoothedMidis.length) {
			const beforeMidi = smoothedMidis[beforeIndex];
			const afterMidi = smoothedMidis[afterIndex];
			const beforeTime = sortedFrames[beforeIndex]?.timeMs ?? 0;
			const afterTime = sortedFrames[afterIndex]?.timeMs ?? 0;
			if (
				beforeMidi !== null &&
				beforeMidi !== undefined &&
				beforeMidi === afterMidi &&
				afterTime - beforeTime <= MAX_DROPOUT_BRIDGE_MS
			) {
				for (let fill = gapStart; fill <= gapEnd; fill += 1) {
					smoothedMidis[fill] = beforeMidi;
				}
			}
		}
	}

	// Estimate typical frame interval so the final voiced frame receives realistic tail length
	let intervalSum = 0;
	let intervalSamples = 0;
	for (let index = 1; index < sortedFrames.length; index += 1) {
		const delta =
			(sortedFrames[index]?.timeMs ?? 0) -
			(sortedFrames[index - 1]?.timeMs ?? 0);
		if (delta > 0 && delta <= 120) {
			intervalSum += delta;
			intervalSamples += 1;
		}
	}
	const fallbackFrameMs =
		intervalSamples > 0 ? intervalSum / intervalSamples : 20;

	// Step 4: Group contiguous runs of identical MIDI pitch into raw segments
	const segments: Array<RawPitchSegment> = [];
	let runStartIndex = -1;
	let runMidi: number | null = null;
	let sawSilenceBeforeRun = true;

	const finalizeRun = (endExclusiveIndex: number): void => {
		if (runStartIndex < 0 || runMidi === null) {
			return;
		}
		const firstFrame = sortedFrames[runStartIndex];
		const lastFrame = sortedFrames[endExclusiveIndex - 1];
		const followingFrame = sortedFrames[endExclusiveIndex];
		if (!firstFrame || !lastFrame) {
			return;
		}
		const endMs = followingFrame
			? followingFrame.timeMs
			: lastFrame.timeMs + fallbackFrameMs;
		const frameCount = endExclusiveIndex - runStartIndex;
		const durationMs = endMs - firstFrame.timeMs;

		// Ignore short 1-frame pitch glitches and tiny transients
		if (frameCount <= 1 && durationMs < 40) {
			sawSilenceBeforeRun = true;
			return;
		}
		if (durationMs < minNoteMs) {
			return;
		}

		let rmsSum = 0;
		for (let frameIndex = runStartIndex; frameIndex < endExclusiveIndex; frameIndex += 1) {
			rmsSum += sortedFrames[frameIndex]?.rms ?? 0;
		}
		segments.push({
			midi: runMidi,
			startMs: firstFrame.timeMs,
			endMs,
			averageRms: rmsSum / Math.max(1, frameCount),
			frameCount,
			precededBySilence: sawSilenceBeforeRun,
		});
		sawSilenceBeforeRun = false;
	};

	for (let index = 0; index < smoothedMidis.length; index += 1) {
		const midi = smoothedMidis[index] ?? null;
		if (midi === null) {
			if (runMidi !== null) {
				finalizeRun(index);
				runStartIndex = -1;
				runMidi = null;
			}
			sawSilenceBeforeRun = true;
			continue;
		}
		if (runMidi === null) {
			runStartIndex = index;
			runMidi = midi;
		} else if (midi !== runMidi) {
			finalizeRun(index);
			runStartIndex = index;
			runMidi = midi;
		}
	}
	if (runMidi !== null) {
		finalizeRun(smoothedMidis.length);
	}

	if (segments.length === 0) {
		return emptyResult();
	}

	// Step 5: Map segments to quantized grid steps, apply octave shift & scale snap
	const stepDurationMs =
		(60 / Math.max(30, options.bpm) / stepsPerBeat) * 1000;
	const quantizedList: Array<QuantizedMonophonicNote> = [];

	for (const segment of segments) {
		const shiftedMidi = clampMidiToMelodicRange(
			segment.midi + Math.round(options.octaveShift) * 12
		);
		const finalPitch = options.snapToScale
			? snapMidiToScale(shiftedMidi, options.rootKey, options.scale)
			: shiftedMidi;

		const rawDurationMs = Math.max(minNoteMs, segment.endMs - segment.startMs);
		const startStep = Math.max(
			0,
			Math.min(
				totalSteps - 1,
				Math.round(segment.startMs / stepDurationMs / quantizeSteps) *
					quantizeSteps
			)
		);
		const quantizedDuration = Math.max(
			quantizeSteps,
			Math.round(rawDurationMs / stepDurationMs / quantizeSteps) * quantizeSteps
		);
		const clampedDuration = Math.max(
			1,
			Math.min(totalSteps - startStep, quantizedDuration)
		);

		const velocity =
			Math.round(
				Math.max(
					0.55,
					Math.min(1, 0.55 + Math.min(1, segment.averageRms / 0.14) * 0.45)
				) * 100
			) / 100;

		quantizedList.push({
			pitch: finalPitch,
			startStep,
			duration: clampedDuration,
			velocity,
			rawDurationMs,
			precededBySilence: segment.precededBySilence,
		});
	}

	// Step 6: Resolve monophonic collisions and merge consecutive runs that snapped to identical pitch without silence
	quantizedList.sort((left, right) => left.startStep - right.startStep);
	const monophonicNotes: Array<QuantizedMonophonicNote> = [];

	for (const candidate of quantizedList) {
		const previous = monophonicNotes[monophonicNotes.length - 1];
		if (!previous) {
			monophonicNotes.push(candidate);
			continue;
		}
		if (candidate.startStep === previous.startStep) {
			if (candidate.rawDurationMs > previous.rawDurationMs) {
				monophonicNotes[monophonicNotes.length - 1] = candidate;
			}
			continue;
		}
		if (
			!candidate.precededBySilence &&
			candidate.pitch === previous.pitch &&
			candidate.startStep <= previous.startStep + previous.duration
		) {
			const mergedEnd = Math.min(
				totalSteps,
				Math.max(
					previous.startStep + previous.duration,
					candidate.startStep + candidate.duration
				)
			);
			previous.duration = Math.max(1, mergedEnd - previous.startStep);
			previous.velocity = Math.max(previous.velocity, candidate.velocity);
			continue;
		}
		if (previous.startStep + previous.duration > candidate.startStep) {
			previous.duration = Math.max(1, candidate.startStep - previous.startStep);
		}
		monophonicNotes.push(candidate);
	}

	// Step 7: Split notes cleanly across bar boundaries
	const notesByBar: Array<Array<Omit<NoteEvent, "id">>> = Array.from(
		{ length: barCount },
		() => []
	);
	const flatNotes: Array<HumQuantizedNote> = [];

	for (const note of monophonicNotes) {
		let globalStep = note.startStep;
		let remainingDuration = note.duration;

		while (remainingDuration > 0 && globalStep < totalSteps) {
			const barOffset = Math.floor(globalStep / stepsPerBar);
			const stepInBar = globalStep % stepsPerBar;
			const sliceDuration = Math.min(
				remainingDuration,
				stepsPerBar - stepInBar
			);
			const barBucket = notesByBar[barOffset];
			if (barBucket) {
				barBucket.push({
					step: stepInBar,
					pitch: note.pitch,
					duration: sliceDuration,
					velocity: note.velocity,
					pitchBend: 0,
				});
			}
			flatNotes.push({
				barOffset,
				globalStep,
				step: stepInBar,
				pitch: note.pitch,
				duration: sliceDuration,
				velocity: note.velocity,
				pitchBend: 0,
			});
			globalStep += sliceDuration;
			remainingDuration -= sliceDuration;
		}
	}

	return { notesByBar, flatNotes };
};

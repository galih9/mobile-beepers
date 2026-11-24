import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
	clampMidiToMelodicRange,
	createHumPitchDetector,
	HUM_DETECTOR_BUFFER_SIZE,
	quantizeHumFramesToNotes,
	snapMidiToScale,
	type HumPitchFrame,
} from "../audio/humToNotes";
import {
	calculateTapBpm,
	GENRE_BPM_PRESETS,
	MAX_BPM,
	MIN_BPM,
	recordTapTimestamp,
	TAP_TEMPO_MAX_HISTORY,
	TAP_TEMPO_RESET_MS,
} from "../audio/metronome";
import { getGeneralMidiProgramForWaveform } from "../audio/midiExporter";
import { isModernDrumEngine } from "../audio/modern/modernVoices";
import { MetronomeDialog } from "../components/MetronomeDialog";
import {
	getPresetConfigurationById,
	INSTRUMENT_PRESETS,
	WAVEFORM_OPTIONS,
} from "../constants/instrumentPresets";
import {
	getModernPresetById,
	MODERN_ENGINE_LABELS,
	MODERN_INSTRUMENT_PRESETS,
	SYNTH_ENGINES,
} from "../constants/modernPresets";
import { getActivePatternForChannel } from "../store/songHelpers";
import { useChiptuneStore } from "../store/useChiptuneStore";

const ensureDialogPolyfill = (): void => {
	if (!HTMLDialogElement.prototype.showModal) {
		HTMLDialogElement.prototype.showModal = function showModal(
			this: HTMLDialogElement
		): void {
			this.setAttribute("open", "");
		};
	}
	if (!HTMLDialogElement.prototype.close) {
		HTMLDialogElement.prototype.close = function close(
			this: HTMLDialogElement
		): void {
			this.removeAttribute("open");
			this.dispatchEvent(new Event("close"));
		};
	}
};

const createSineBuffer = (
	frequencyHz: number,
	sampleRate = 44_100,
	length = HUM_DETECTOR_BUFFER_SIZE,
	amplitude = 0.5
): Float32Array => {
	const samples = new Float32Array(length);
	for (let index = 0; index < length; index += 1) {
		samples[index] =
			amplitude * Math.sin((2 * Math.PI * frequencyHz * index) / sampleRate);
	}
	return samples;
};

describe("metronome & tap tempo", () => {
	beforeAll(ensureDialogPolyfill);

	beforeEach(() => {
		useChiptuneStore.getState().resetEverything();
	});

	it("calculates accurate BPM from tap timestamps, resets after pauses, and clamps bounds", () => {
		expect(calculateTapBpm([])).toBeNull();
		expect(calculateTapBpm([1000])).toBeNull();
		expect(calculateTapBpm([0, 500, 1000, 1500])).toBe(120);
		expect(calculateTapBpm([0, 484, 968, 1452])).toBe(124);
		expect(calculateTapBpm([0, 345, 690, 1035])).toBe(174);
		expect(calculateTapBpm([0, 2000])).toBe(MIN_BPM);
		expect(calculateTapBpm([0, 100])).toBe(MAX_BPM);

		let history: Array<number> = [];
		for (let count = 0; count < 12; count += 1) {
			history = recordTapTimestamp(history, count * 500);
		}
		expect(history).toHaveLength(TAP_TEMPO_MAX_HISTORY);

		const afterPause = recordTapTimestamp(
			history,
			(history[history.length - 1] ?? 0) + TAP_TEMPO_RESET_MS + 100
		);
		expect(afterPause).toHaveLength(1);
	});

	it("ships valid genre BPM reference presets including House and Breakcore", () => {
		const ids = GENRE_BPM_PRESETS.map((preset) => preset.id);
		expect(ids).toContain("classic-house");
		expect(ids).toContain("deep-house");
		expect(ids).toContain("breakcore");
		expect(ids).toContain("dnb");
		for (const preset of GENRE_BPM_PRESETS) {
			expect(preset.bpm).toBeGreaterThanOrEqual(MIN_BPM);
			expect(preset.bpm).toBeLessThanOrEqual(MAX_BPM);
		}
	});

	it("manages metronome store state and volume clamping", () => {
		const store = useChiptuneStore.getState();
		expect(store.metronomeEnabled).toBe(false);
		expect(store.metronomeAccent).toBe(true);

		store.toggleMetronome();
		expect(useChiptuneStore.getState().metronomeEnabled).toBe(true);

		store.setMetronomeVolume(5);
		expect(useChiptuneStore.getState().metronomeVolume).toBe(1);
		store.setMetronomeVolume(0.01);
		expect(useChiptuneStore.getState().metronomeVolume).toBe(0.1);

		store.setMetronomeAccent(false);
		expect(useChiptuneStore.getState().metronomeAccent).toBe(false);

		store.resetEverything();
		expect(useChiptuneStore.getState().metronomeEnabled).toBe(false);
	});

	it("updates song BPM from MetronomeDialog tap tempo and genre preset buttons", () => {
		let fakeNow = 1000;
		const nowSpy = vi
			.spyOn(performance, "now")
			.mockImplementation(() => fakeNow);

		render(<MetronomeDialog isOpen onClose={vi.fn()} />);

		const tapButton = screen.getByRole("button", { name: /tap tempo/i });
		fireEvent.click(tapButton);
		fakeNow += 484;
		fireEvent.click(tapButton);
		fakeNow += 484;
		fireEvent.click(tapButton);

		expect(useChiptuneStore.getState().song.bpm).toBe(124);

		fireEvent.click(screen.getByRole("button", { name: /breakcore/i }));
		expect(useChiptuneStore.getState().song.bpm).toBe(180);

		nowSpy.mockRestore();
	});
});

describe("humming-to-notes with pitchy", () => {
	beforeEach(() => {
		useChiptuneStore.getState().resetEverything();
	});

	it("detects exact MIDI notes from synthetic sine waves using Pitchy", () => {
		const detector = createHumPitchDetector(HUM_DETECTOR_BUFFER_SIZE);
		const testNotes: Array<{
			frequencyHz: number;
			expectedMidi: number;
			expectedName: string;
		}> = [
			{ frequencyHz: 261.63, expectedMidi: 60, expectedName: "C4" },
			{ frequencyHz: 329.63, expectedMidi: 64, expectedName: "E4" },
			{ frequencyHz: 392.0, expectedMidi: 67, expectedName: "G4" },
			{ frequencyHz: 440.0, expectedMidi: 69, expectedName: "A4" },
		];

		for (const item of testNotes) {
			const samples = createSineBuffer(item.frequencyHz);
			const reading = detector.detect(samples, 44_100);
			expect(reading.midi).toBe(item.expectedMidi);
			expect(reading.noteName).toBe(item.expectedName);
			expect(reading.clarity).toBeGreaterThan(0.9);
			expect(Math.abs(reading.centsOffset)).toBeLessThanOrEqual(5);
		}

		const silence = new Float32Array(HUM_DETECTOR_BUFFER_SIZE);
		const silentReading = detector.detect(silence, 44_100);
		expect(silentReading.midi).toBeNull();
		expect(silentReading.noteName).toBeNull();
	});

	it("clamps melodic range and snaps out-of-scale pitches to song scale", () => {
		expect(clampMidiToMelodicRange(24)).toBe(36);
		expect(clampMidiToMelodicRange(96)).toBe(84);
		expect(clampMidiToMelodicRange(60)).toBe(60);

		expect(snapMidiToScale(60, "C", "minor")).toBe(60);
		const snapped = snapMidiToScale(64, "C", "minor");
		expect([63, 65]).toContain(snapped);
	});

	it("smooths glitches, drops short blips, applies octave shift, and splits multi-bar hums", () => {
		const frames: Array<HumPitchFrame> = [];

		for (let timeMs = 0; timeMs < 480; timeMs += 20) {
			const isGlitch = timeMs === 200;
			frames.push({
				timeMs,
				frequencyHz: isGlitch ? 523.25 : 261.63,
				clarity: 0.96,
				rms: 0.08,
			});
		}
		frames.push({ timeMs: 500, frequencyHz: 0, clarity: 0, rms: 0.002 });
		frames.push({ timeMs: 540, frequencyHz: 440, clarity: 0.95, rms: 0.06 });
		frames.push({ timeMs: 570, frequencyHz: 0, clarity: 0, rms: 0.002 });

		for (let timeMs = 1875; timeMs < 2375; timeMs += 20) {
			frames.push({
				timeMs,
				frequencyHz: 329.63,
				clarity: 0.96,
				rms: 0.1,
			});
		}

		const result = quantizeHumFramesToNotes(frames, {
			bpm: 120,
			beatsPerBar: 4,
			stepsPerBeat: 4,
			barCount: 2,
			rootKey: "C",
			scale: "major",
			snapToScale: true,
			quantizeSteps: 1,
			octaveShift: 1,
		});

		expect(result.notesByBar).toHaveLength(2);
		expect(result.notesByBar[0]?.[0]).toMatchObject({
			step: 0,
			pitch: 72,
			duration: 4,
		});
		expect(result.notesByBar[0]?.[1]).toMatchObject({
			step: 15,
			pitch: 76,
			duration: 1,
		});
		expect(result.notesByBar[1]?.[0]).toMatchObject({
			step: 0,
			pitch: 76,
			duration: 3,
		});
	});

	it("inserts multi-bar hum takes without clobbering shared patterns and supports single-step undo", () => {
		const store = useChiptuneStore.getState();
		store.setBarPatternIndex(0, 0, 1);
		store.setBarPatternIndex(0, 1, 1);
		store.setBarPatternIndex(0, 2, 1);
		const originalBar2Notes = structuredClone(
			getActivePatternForChannel(
				useChiptuneStore.getState().song.channels[0],
				2
			)?.notes ?? []
		);

		useChiptuneStore.getState().applyRecordedNotesToChannel({
			channelIndex: 0,
			startBarIndex: 0,
			mode: "replace",
			notesByBar: [
				[{ step: 0, pitch: 60, duration: 4, velocity: 0.85, pitchBend: 0 }],
				[{ step: 4, pitch: 67, duration: 4, velocity: 0.9, pitchBend: 0 }],
			],
		});

		const afterInsert = useChiptuneStore.getState();
		const channel = afterInsert.song.channels[0];
		expect(getActivePatternForChannel(channel, 0)?.notes).toHaveLength(1);
		expect(getActivePatternForChannel(channel, 0)?.notes[0]?.pitch).toBe(60);
		expect(getActivePatternForChannel(channel, 1)?.notes).toHaveLength(1);
		expect(getActivePatternForChannel(channel, 1)?.notes[0]?.pitch).toBe(67);
		expect(getActivePatternForChannel(channel, 2)?.notes).toEqual(
			originalBar2Notes
		);

		afterInsert.undo();
		const afterUndo = useChiptuneStore.getState();
		expect(afterUndo.song.channels[0]?.barSequence[0]).toBe(1);
		expect(afterUndo.song.channels[0]?.barSequence[1]).toBe(1);

		// Also verify merge mode combines existing notes
		useChiptuneStore.getState().applyRecordedNotesToChannel({
			channelIndex: 0,
			startBarIndex: 0,
			mode: "merge",
			notesByBar: [
				[{ step: 8, pitch: 64, duration: 2, velocity: 0.8, pitchBend: 0 }],
			],
		});
		const mergedNotes =
			getActivePatternForChannel(
				useChiptuneStore.getState().song.channels[0],
				0
			)?.notes ?? [];
		expect(mergedNotes.some((note) => note.step === 8 && note.pitch === 64)).toBe(
			true
		);
		expect(mergedNotes.length).toBeGreaterThanOrEqual(
			originalBar2Notes.length + 1
		);
	});
});

describe("house & breakcore instruments", () => {
	beforeEach(() => {
		useChiptuneStore.getState().resetEverything();
	});

	it("registers all new Modern Mode House & Breakcore engines and presets", () => {
		const newModernPresetIds = [
			"modern-m1-organ",
			"modern-house-piano",
			"modern-deep-chord-organ",
			"modern-vocal-chop",
			"modern-ethereal-choir",
			"modern-rave-hoover",
			"modern-acid-squelch",
			"modern-dub-chord-stab",
			"modern-acid-303",
			"modern-house-fm-bass",
			"modern-garage-donk",
			"modern-neuro-bass",
			"modern-house-909-kit",
			"modern-gabber-kit",
		];

		for (const presetId of newModernPresetIds) {
			const preset = getModernPresetById(presetId);
			expect(preset).toBeDefined();
			expect(getPresetConfigurationById(presetId).id).toBe(presetId);
			const engine = preset?.configuration.modern?.engine;
			expect(engine).toBeDefined();
			if (engine) {
				expect(MODERN_ENGINE_LABELS[engine]).toBeTruthy();
				expect(preset?.category).toBe(
					isModernDrumEngine(engine) ? "drum" : "pitch"
				);
			}
		}

		expect(isModernDrumEngine("houseKit")).toBe(true);
		expect(isModernDrumEngine("gabberKit")).toBe(true);
		expect(SYNTH_ENGINES.has("acid303")).toBe(true);
		expect(SYNTH_ENGINES.has("hoover")).toBe(true);
		expect(SYNTH_ENGINES.has("houseOrgan")).toBe(true);
		expect(SYNTH_ENGINES.has("fmBass")).toBe(true);
		expect(SYNTH_ENGINES.has("vocalChop")).toBe(true);

		const store = useChiptuneStore.getState();
		store.setStudioMode("modern");
		useChiptuneStore.getState().applyInstrumentPreset(0, "modern-acid-303");
		expect(
			useChiptuneStore.getState().song.channels[0]?.instrument.modern?.engine
		).toBe("acid303");

		useChiptuneStore.getState().applyInstrumentPreset(3, "modern-gabber-kit");
		expect(
			useChiptuneStore.getState().song.channels[3]?.instrument.modern?.engine
		).toBe("gabberKit");
		expect(MODERN_INSTRUMENT_PRESETS.length).toBeGreaterThanOrEqual(29);
	});

	it("registers all new Chiptune Mode House & Breakcore waveforms, presets, and MIDI mappings", () => {
		const waveforms = WAVEFORM_OPTIONS.map((option) => option.value);
		expect(waveforms).toContain("organ");
		expect(waveforms).toContain("acid");
		expect(waveforms).toContain("hoover");

		expect(getGeneralMidiProgramForWaveform("organ")).toBe(17);
		expect(getGeneralMidiProgramForWaveform("acid")).toBe(39);
		expect(getGeneralMidiProgramForWaveform("hoover")).toBe(81);

		const newChipPresetIds = [
			"house-m1-organ",
			"house-acid-303",
			"house-fm-bass",
			"house-909-kit",
			"breakcore-rave-hoover",
			"breakcore-acid-lead",
		];
		const presetIdSet = new Set(INSTRUMENT_PRESETS.map((preset) => preset.id));
		for (const presetId of newChipPresetIds) {
			expect(presetIdSet.has(presetId)).toBe(true);
			expect(getPresetConfigurationById(presetId).id).toBe(presetId);
		}
	});
});

import { beforeEach, describe, expect, it } from "vitest";
import {
	buildPianoRollRows,
	isMidiNoteInScale,
	midiToFrequency,
	midiToNoteName,
} from "../constants/scalesAndNotes";
import { getActivePatternForChannel } from "../store/songHelpers";
import { useChiptuneStore } from "../store/useChiptuneStore";

describe("scalesAndNotes", () => {
	it("converts MIDI 69 to 440Hz and note name A4", () => {
		expect(midiToFrequency(69)).toBeCloseTo(440, 2);
		expect(midiToNoteName(69)).toBe("A4");
		expect(midiToNoteName(60)).toBe("C4");
	});

	it("correctly identifies scale membership for C minor", () => {
		expect(isMidiNoteInScale(60, "C", "minor")).toBe(true); // C
		expect(isMidiNoteInScale(63, "C", "minor")).toBe(true); // D#
		expect(isMidiNoteInScale(64, "C", "minor")).toBe(false); // E natural
	});

	it("builds fewer rows when scaleLockOnly is true", () => {
		const scaleRows = buildPianoRollRows("pitch", "C", "minor", true);
		const chromaticRows = buildPianoRollRows("pitch", "C", "minor", false);
		expect(scaleRows.length).toBeLessThan(chromaticRows.length);
		expect(scaleRows.every((row) => row.inScale)).toBe(true);

		const drumRows = buildPianoRollRows("drum", "C", "minor", true);
		expect(drumRows).toHaveLength(8);
	});
});

describe("useChiptuneStore", () => {
	beforeEach(() => {
		useChiptuneStore.getState().createNewProject();
	});

	it("adds, resizes, and removes notes in the selected pattern", () => {
		const store = useChiptuneStore.getState();
		store.clearCurrentPattern();

		useChiptuneStore.getState().addOrReplaceNote({
			step: 4,
			pitch: 67,
			duration: 2,
			velocity: 0.9,
			pitchBend: 0,
		});

		let state = useChiptuneStore.getState();
		let pattern = getActivePatternForChannel(
			state.song.channels[state.selectedChannelIndex],
			state.selectedBarIndex
		);
		expect(pattern?.notes).toHaveLength(1);
		expect(pattern?.notes[0]?.duration).toBe(2);

		state.resizeNoteAt(4, 67, 4);
		state = useChiptuneStore.getState();
		pattern = getActivePatternForChannel(
			state.song.channels[state.selectedChannelIndex],
			state.selectedBarIndex
		);
		expect(pattern?.notes[0]?.duration).toBe(4);

		state.removeNoteAt(5, 67);
		state = useChiptuneStore.getState();
		pattern = getActivePatternForChannel(
			state.song.channels[state.selectedChannelIndex],
			state.selectedBarIndex
		);
		expect(pattern?.notes).toHaveLength(0);
	});

	it("clones patterns to a unique index and generates riffs", () => {
		const initialChannel = useChiptuneStore.getState().song.channels[0];
		const initialPatternNumber = initialChannel?.barSequence[0] ?? 0;

		useChiptuneStore.getState().clonePatternToBar(0, 0);
		const afterCloneChannel = useChiptuneStore.getState().song.channels[0];
		const clonedPatternNumber = afterCloneChannel?.barSequence[0] ?? 0;
		expect(clonedPatternNumber).toBeGreaterThan(initialPatternNumber);

		useChiptuneStore.getState().clearCurrentPattern();
		useChiptuneStore.getState().generateRiffForCurrentPattern();
		const updated = useChiptuneStore.getState();
		const generatedPattern = getActivePatternForChannel(
			updated.song.channels[0],
			0
		);
		expect((generatedPattern?.notes.length ?? 0) > 0).toBe(true);
	});

	it("loads built-in demo songs", () => {
		useChiptuneStore.getState().loadDemoSong("demo-starlight-boss");
		const state = useChiptuneStore.getState();
		expect(state.song.title).toBe("Starlight Boss Rush");
		expect(state.song.bpm).toBe(158);
	});

	it("updates and clamps purple loop range bounds", () => {
		useChiptuneStore.getState().setLoopRange(2, 6);
		let state = useChiptuneStore.getState();
		expect(state.song.loopStartBar).toBe(2);
		expect(state.song.loopEndBar).toBe(6);

		useChiptuneStore.getState().setLoopRange(-5, 999);
		state = useChiptuneStore.getState();
		expect(state.song.loopStartBar).toBe(0);
		expect(state.song.loopEndBar).toBe(state.song.totalBars - 1);
	});
});

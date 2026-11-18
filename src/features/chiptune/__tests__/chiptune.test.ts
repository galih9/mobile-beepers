import { beforeEach, describe, expect, it } from "vitest";
import {
	chiptuneAgentApi,
	noteNameToMidi,
	registerChiptuneAgentApi,
} from "../api/chiptuneAgentApi";
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

	it("moves notes across steps and pitches while clamping duration", () => {
		const store = useChiptuneStore.getState();
		store.clearCurrentPattern();
		store.addOrReplaceNote({
			step: 2,
			pitch: 60,
			duration: 4,
			velocity: 0.9,
			pitchBend: 0,
		});

		useChiptuneStore.getState().moveNoteAt(2, 60, 14, 67);
		const state = useChiptuneStore.getState();
		const pattern = getActivePatternForChannel(
			state.song.channels[state.selectedChannelIndex],
			state.selectedBarIndex
		);
		expect(pattern?.notes).toHaveLength(1);
		expect(pattern?.notes[0]?.step).toBe(14);
		expect(pattern?.notes[0]?.pitch).toBe(67);
		expect(pattern?.notes[0]?.duration).toBe(2);
	});

	it("reorders channels and keeps selectedChannelIndex synced", () => {
		const initialFirstChannel = useChiptuneStore.getState().song.channels[0];
		const initialSecondChannel = useChiptuneStore.getState().song.channels[1];
		expect(initialFirstChannel).toBeDefined();
		expect(initialSecondChannel).toBeDefined();

		useChiptuneStore.getState().setSelectedChannelIndex(0);
		useChiptuneStore.getState().reorderChannels(0, 1);

		const state = useChiptuneStore.getState();
		expect(state.song.channels[0]?.id).toBe(initialSecondChannel?.id);
		expect(state.song.channels[1]?.id).toBe(initialFirstChannel?.id);
		expect(state.selectedChannelIndex).toBe(1);
	});

	it("copies bar pattern slots within a channel and across channels", () => {
		const store = useChiptuneStore.getState();
		store.clearCurrentPattern();
		store.addOrReplaceNote({
			step: 0,
			pitch: 64,
			duration: 2,
			velocity: 0.9,
			pitchBend: 0,
		});

		const sourcePattern =
			useChiptuneStore.getState().song.channels[0]?.barSequence[0] ?? 0;
		expect(sourcePattern).toBeGreaterThan(0);

		useChiptuneStore.getState().copyBarPatternSlot(0, 0, 0, 3);
		expect(useChiptuneStore.getState().song.channels[0]?.barSequence[3]).toBe(
			sourcePattern
		);

		useChiptuneStore.getState().copyBarPatternSlot(0, 0, 1, 2);
		const targetChannel = useChiptuneStore.getState().song.channels[1];
		const assignedPattern = targetChannel?.barSequence[2] ?? 0;
		expect(assignedPattern).toBeGreaterThan(0);
		expect(
			targetChannel?.patterns[String(assignedPattern)]?.notes
		).toHaveLength(1);
		expect(
			targetChannel?.patterns[String(assignedPattern)]?.notes[0]?.pitch
		).toBe(64);
	});

	it("clamps pianoRollZoom between 0.25 and 2.5", () => {
		useChiptuneStore.getState().setPianoRollZoom(0.25);
		expect(useChiptuneStore.getState().pianoRollZoom).toBe(0.25);

		useChiptuneStore.getState().setPianoRollZoom(0.5);
		expect(useChiptuneStore.getState().pianoRollZoom).toBe(0.5);

		useChiptuneStore.getState().setPianoRollZoom(0.75);
		expect(useChiptuneStore.getState().pianoRollZoom).toBe(0.75);

		useChiptuneStore.getState().setPianoRollZoom(1.5);
		expect(useChiptuneStore.getState().pianoRollZoom).toBe(1.5);

		useChiptuneStore.getState().setPianoRollZoom(0.1);
		expect(useChiptuneStore.getState().pianoRollZoom).toBe(0.25);

		useChiptuneStore.getState().setPianoRollZoom(5);
		expect(useChiptuneStore.getState().pianoRollZoom).toBe(2.5);
	});

	it("sets vertical pitch bend and bendStyle on notes", () => {
		const store = useChiptuneStore.getState();
		store.clearCurrentPattern();
		store.addOrReplaceNote({
			step: 2,
			pitch: 60,
			duration: 6,
			velocity: 0.9,
			pitchBend: 0,
		});

		useChiptuneStore.getState().setNotePitchBendAt(5, 60, 7, "late");
		let state = useChiptuneStore.getState();
		let pattern = getActivePatternForChannel(
			state.song.channels[state.selectedChannelIndex],
			state.selectedBarIndex
		);
		expect(pattern?.notes[0]?.pitchBend).toBe(7);
		expect(pattern?.notes[0]?.bendStyle).toBe("late");

		useChiptuneStore.getState().setNotePitchBendAt(2, 60, -40, "early");
		state = useChiptuneStore.getState();
		pattern = getActivePatternForChannel(
			state.song.channels[state.selectedChannelIndex],
			state.selectedBarIndex
		);
		expect(pattern?.notes[0]?.pitchBend).toBe(-24);
		expect(pattern?.notes[0]?.bendStyle).toBe("early");
	});

	it("cycles per-note fadeMode between none, fadeIn, and fadeOut", () => {
		const store = useChiptuneStore.getState();
		store.clearCurrentPattern();
		store.addOrReplaceNote({
			step: 0,
			pitch: 62,
			duration: 4,
			velocity: 0.9,
			pitchBend: 0,
		});

		useChiptuneStore.getState().cycleNoteFadeAt(1, 62);
		let pattern = getActivePatternForChannel(
			useChiptuneStore.getState().song.channels[0],
			0
		);
		expect(pattern?.notes[0]?.fadeMode).toBe("fadeIn");

		useChiptuneStore.getState().cycleNoteFadeAt(1, 62);
		pattern = getActivePatternForChannel(
			useChiptuneStore.getState().song.channels[0],
			0
		);
		expect(pattern?.notes[0]?.fadeMode).toBe("fadeOut");

		useChiptuneStore.getState().cycleNoteFadeAt(1, 62);
		pattern = getActivePatternForChannel(
			useChiptuneStore.getState().song.channels[0],
			0
		);
		expect(pattern?.notes[0]?.fadeMode).toBe("none");
	});

	it("updates channel instrument fadeInOut envelope", () => {
		useChiptuneStore
			.getState()
			.updateChannelInstrument(0, { fadeInOut: -0.85 });
		expect(
			useChiptuneStore.getState().song.channels[0]?.instrument.fadeInOut
		).toBe(-0.85);

		useChiptuneStore.getState().updateChannelInstrument(0, { fadeInOut: 0.75 });
		expect(
			useChiptuneStore.getState().song.channels[0]?.instrument.fadeInOut
		).toBe(0.75);
	});

	it("resets song, saved library, and studio settings on resetEverything", () => {
		const store = useChiptuneStore.getState();
		store.updateSongMetadata({ title: "Custom Boss Track", bpm: 180 });
		store.addOrReplaceNote({
			step: 0,
			pitch: 65,
			duration: 2,
			velocity: 0.9,
			pitchBend: 0,
		});
		store.saveCurrentSongToLibrary();
		store.setPianoRollZoom(2);
		store.setActiveTool("fade");
		store.setActiveWorkspaceTab("synth");

		expect(useChiptuneStore.getState().savedSongs).toHaveLength(1);

		useChiptuneStore.getState().resetEverything();
		const resetState = useChiptuneStore.getState();
		expect(resetState.song.title).toBe("New Chiptune");
		expect(resetState.song.bpm).toBe(132);
		expect(resetState.savedSongs).toHaveLength(0);
		expect(resetState.pianoRollZoom).toBe(1);
		expect(resetState.activeTool).toBe("draw");
		expect(resetState.activeWorkspaceTab).toBe("all");
		const pattern = getActivePatternForChannel(resetState.song.channels[0], 0);
		expect(pattern?.notes.some((note) => note.pitch === 65)).toBe(false);
		expect(resetState.followPlayhead).toBe(true);
	});

	it("follows playhead bar changes when followPlayhead is enabled", () => {
		const store = useChiptuneStore.getState();
		expect(store.followPlayhead).toBe(true);
		store.setSelectedBarIndex(0);

		store.setPlaybackPosition(3, 4);
		expect(useChiptuneStore.getState().playbackBar).toBe(3);
		expect(useChiptuneStore.getState().playbackStep).toBe(4);
		expect(useChiptuneStore.getState().selectedBarIndex).toBe(3);

		useChiptuneStore.getState().setFollowPlayhead(false);
		useChiptuneStore.getState().setPlaybackPosition(5, 2);
		expect(useChiptuneStore.getState().playbackBar).toBe(5);
		expect(useChiptuneStore.getState().selectedBarIndex).toBe(3);
	});

	it("supports switching activeTool to select mode", () => {
		useChiptuneStore.getState().setActiveTool("select");
		expect(useChiptuneStore.getState().activeTool).toBe("select");
	});

	it("increments and decrements bar pattern numbers cleanly", () => {
		const store = useChiptuneStore.getState();
		store.setBarPatternIndex(0, 0, 2);
		expect(useChiptuneStore.getState().song.channels[0]?.barSequence[0]).toBe(
			2
		);

		store.setBarPatternIndex(0, 0, 1);
		expect(useChiptuneStore.getState().song.channels[0]?.barSequence[0]).toBe(
			1
		);

		store.setBarPatternIndex(0, 0, 0);
		expect(useChiptuneStore.getState().song.channels[0]?.barSequence[0]).toBe(
			0
		);
	});
});

describe("chiptuneAgentApi", () => {
	beforeEach(() => {
		useChiptuneStore.getState().createNewProject();
	});

	it("parses melodic note names and drum names to MIDI/pad numbers", () => {
		expect(noteNameToMidi("C4")).toBe(60);
		expect(noteNameToMidi("C#4")).toBe(61);
		expect(noteNameToMidi("Db4")).toBe(61);
		expect(noteNameToMidi("A4")).toBe(69);
		expect(noteNameToMidi("KICK")).toBe(0);
		expect(noteNameToMidi("SNARE")).toBe(1);
	});

	it("adds notes using note names and composes multi-channel songs", () => {
		chiptuneAgentApi.clearPattern(0, 0);
		const added = chiptuneAgentApi.addNote({
			channelIndex: 0,
			barIndex: 0,
			step: 0,
			note: "E4",
			duration: 4,
		});
		expect(added.pitch).toBe(64);
		expect(added.duration).toBe(4);

		const composed = chiptuneAgentApi.composeSong({
			title: "API Symphony",
			bpm: 145,
			rootKey: "D",
			scale: "minor",
			totalBars: 4,
			channels: [
				{
					name: "Lead",
					type: "pitch",
					presetId: "nes-pulse-25",
					barSequence: [1, 1, 2, 2],
					patterns: {
						"1": [
							{ step: 0, note: "D4", duration: 2 },
							{ step: 4, note: "F4", duration: 2 },
						],
						"2": [{ step: 0, note: "A4", duration: 4 }],
					},
				},
				{
					name: "Drums",
					type: "drum",
					presetId: "retro-8bit-kit",
					barSequence: [1, 1, 1, 1],
					patterns: {
						"1": [
							{ step: 0, note: "KICK" },
							{ step: 4, note: "SNARE" },
						],
					},
				},
			],
		});

		expect(composed.title).toBe("API Symphony");
		expect(composed.bpm).toBe(145);
		expect(composed.channels).toHaveLength(2);
		expect(composed.channels[0]?.patterns["1"]?.notes[0]?.pitch).toBe(62);
		expect(composed.channels[1]?.patterns["1"]?.notes[1]?.pitch).toBe(1);

		const registered = registerChiptuneAgentApi();
		expect(window.chiptuneApi).toBe(registered);
		expect(window.ultrabeepApi).toBe(registered);
	});
});

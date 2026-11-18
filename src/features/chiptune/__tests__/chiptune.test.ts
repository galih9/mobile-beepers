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
import { SFX_PRESETS } from "../constants/sfxPresets";
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
		let state = useChiptuneStore.getState();
		expect(state.song.title).toBe("Starlight Boss Rush");
		expect(state.song.bpm).toBe(158);

		useChiptuneStore.getState().loadDemoSong("demo-overworld-quest");
		state = useChiptuneStore.getState();
		expect(state.song.title).toBe("Overworld Quest 1985");
		expect(state.song.bpm).toBe(148);
		expect(state.song.rootKey).toBe("G");
		expect(state.song.scale).toBe("major");

		useChiptuneStore.getState().loadDemoSong("demo-cyber-chase");
		state = useChiptuneStore.getState();
		expect(state.song.title).toBe("Cyber Chase 2088");
		expect(state.song.bpm).toBe(164);

		useChiptuneStore.getState().loadDemoSong("demo-sunken-ruins");
		state = useChiptuneStore.getState();
		expect(state.song.title).toBe("Sunken Coral Ruins");
		expect(state.song.bpm).toBe(108);

		useChiptuneStore.getState().loadDemoSong("demo-haunted-crypt");
		state = useChiptuneStore.getState();
		expect(state.song.title).toBe("Haunted Pixel Crypt");
		expect(state.song.bpm).toBe(132);
	});

	it("loads Neon Club House 125 as a ~1-minute 125 BPM 32-bar house loop", () => {
		useChiptuneStore.getState().loadDemoSong("demo-house-125");
		const { song } = useChiptuneStore.getState();
		expect(song.title).toBe("Neon Club House 125");
		expect(song.bpm).toBe(125);
		expect(song.totalBars).toBe(32);
		expect(song.loopStartBar).toBe(0);
		expect(song.loopEndBar).toBe(31);

		const loopBars = song.loopEndBar - song.loopStartBar + 1;
		const loopDurationSeconds = (loopBars * song.beatsPerBar * 60) / song.bpm;
		expect(loopDurationSeconds).toBeCloseTo(61.44, 2);

		expect(song.channels).toHaveLength(5);
		for (const channel of song.channels) {
			expect(channel.barSequence).toHaveLength(32);
			expect(Object.keys(channel.patterns).length).toBeGreaterThan(0);
		}
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

	it("moves multiple selected notes together to higher and lower pitches while preserving intervals", () => {
		const store = useChiptuneStore.getState();
		store.clearCurrentPattern();
		store.addOrReplaceNote({
			step: 0,
			pitch: 60,
			duration: 2,
			velocity: 0.9,
			pitchBend: 0,
		});
		store.addOrReplaceNote({
			step: 2,
			pitch: 64,
			duration: 3,
			velocity: 0.9,
			pitchBend: 0,
		});
		store.addOrReplaceNote({
			step: 4,
			pitch: 67,
			duration: 2,
			velocity: 0.9,
			pitchBend: 0,
		});

		let state = useChiptuneStore.getState();
		let notes =
			getActivePatternForChannel(
				state.song.channels[state.selectedChannelIndex],
				state.selectedBarIndex
			)?.notes ?? [];
		expect(notes).toHaveLength(3);

		// Move all 3 notes higher by +5 semitones and +2 steps
		useChiptuneStore.getState().moveNotesBatch(
			notes.map((note) => ({
				id: note.id,
				step: note.step + 2,
				pitch: note.pitch + 5,
			}))
		);

		state = useChiptuneStore.getState();
		notes =
			getActivePatternForChannel(
				state.song.channels[state.selectedChannelIndex],
				state.selectedBarIndex
			)?.notes ?? [];
		expect(notes).toHaveLength(3);
		expect(notes.map((note) => [note.step, note.pitch, note.duration])).toEqual(
			[
				[2, 65, 2],
				[4, 69, 3],
				[6, 72, 2],
			]
		);

		// Move all 3 notes lower by -7 semitones and -1 step
		useChiptuneStore.getState().moveNotesBatch(
			notes.map((note) => ({
				id: note.id,
				step: note.step - 1,
				pitch: note.pitch - 7,
			}))
		);

		state = useChiptuneStore.getState();
		notes =
			getActivePatternForChannel(
				state.song.channels[state.selectedChannelIndex],
				state.selectedBarIndex
			)?.notes ?? [];
		expect(notes.map((note) => [note.step, note.pitch, note.duration])).toEqual(
			[
				[1, 58, 2],
				[3, 62, 3],
				[5, 65, 2],
			]
		);
	});

	it("preserves all notes in a chord when moved onto pitches formerly occupied by siblings", () => {
		const store = useChiptuneStore.getState();
		store.clearCurrentPattern();
		store.addOrReplaceNote({
			step: 0,
			pitch: 60,
			duration: 2,
			velocity: 0.9,
			pitchBend: 0,
		});
		store.addOrReplaceNote({
			step: 0,
			pitch: 64,
			duration: 2,
			velocity: 0.9,
			pitchBend: 0,
		});
		store.addOrReplaceNote({
			step: 0,
			pitch: 67,
			duration: 2,
			velocity: 0.9,
			pitchBend: 0,
		});

		const initialNotes =
			getActivePatternForChannel(
				useChiptuneStore.getState().song.channels[0],
				0
			)?.notes ?? [];
		expect(initialNotes).toHaveLength(3);

		// Shift chord so C4->E4 (64), E4->G4 (67), G4->B4 (71)
		const targetPitches = [64, 67, 71];
		useChiptuneStore.getState().moveNotesBatch(
			initialNotes.map((note, index) => ({
				id: note.id,
				step: note.step,
				pitch: targetPitches[index] ?? note.pitch,
			}))
		);

		const updatedNotes =
			getActivePatternForChannel(
				useChiptuneStore.getState().song.channels[0],
				0
			)?.notes ?? [];
		expect(updatedNotes).toHaveLength(3);
		expect(updatedNotes.map((note) => note.pitch)).toEqual([64, 67, 71]);
	});

	it("supports non-destructive live preview during drag and deduplicates unselected notes on commit", () => {
		const store = useChiptuneStore.getState();
		store.clearCurrentPattern();
		store.addOrReplaceNote({
			step: 0,
			pitch: 60,
			duration: 2,
			velocity: 0.9,
			pitchBend: 0,
		});
		store.addOrReplaceNote({
			step: 0,
			pitch: 64,
			duration: 2,
			velocity: 0.9,
			pitchBend: 0,
		});

		const initialNotes =
			getActivePatternForChannel(
				useChiptuneStore.getState().song.channels[0],
				0
			)?.notes ?? [];
		const selectedNote = initialNotes.find((note) => note.pitch === 60);
		expect(selectedNote).toBeDefined();

		// Dragging over unselected pitch 64 without committing preserves unselected note
		useChiptuneStore.getState().moveNotesBatch(
			[
				{
					id: selectedNote?.id ?? "",
					step: 0,
					pitch: 64,
				},
			],
			false
		);
		let currentNotes =
			getActivePatternForChannel(
				useChiptuneStore.getState().song.channels[0],
				0
			)?.notes ?? [];
		expect(currentNotes).toHaveLength(2);

		// Committing at pitch 64 deduplicates the overlapped unselected note
		useChiptuneStore.getState().moveNotesBatch(
			[
				{
					id: selectedNote?.id ?? "",
					step: 0,
					pitch: 64,
				},
			],
			true
		);
		currentNotes =
			getActivePatternForChannel(
				useChiptuneStore.getState().song.channels[0],
				0
			)?.notes ?? [];
		expect(currentNotes).toHaveLength(1);
		expect(currentNotes[0]?.id).toBe(selectedNote?.id);
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

		const midiBytes = chiptuneAgentApi.exportMidiBytes();
		expect(midiBytes.length).toBeGreaterThan(0);
		expect(
			String.fromCharCode(
				midiBytes[0] ?? 0,
				midiBytes[1] ?? 0,
				midiBytes[2] ?? 0,
				midiBytes[3] ?? 0
			)
		).toBe("MThd");

		const midiBlob = chiptuneAgentApi.exportMidiBlob();
		expect(midiBlob.type).toBe("audio/midi");
		expect(midiBlob.size).toBe(midiBytes.length);
	});

	it("exposes SFX Creator mode and short-track controls via chiptuneAgentApi", () => {
		useChiptuneStore.getState().resetEverything();
		expect(chiptuneAgentApi.getStudioMode()).toBe("music");

		const nextMode = chiptuneAgentApi.setStudioMode("sfx");
		expect(nextMode).toBe("sfx");

		const presets = chiptuneAgentApi.listSfxPresets();
		expect(presets.length).toBeGreaterThanOrEqual(8);
		expect(presets.some((preset) => preset.id === "sfx-ray-gun")).toBe(true);

		const loaded = chiptuneAgentApi.loadSfxPreset("sfx-winning");
		expect(loaded.title).toBe("Winning Fanfare");
		expect(loaded.totalBars).toBe(2);

		const generated = chiptuneAgentApi.generateSfx("laser");
		expect(generated.length).toBeGreaterThan(0);

		const shortTrack = chiptuneAgentApi.composeSong({
			title: "1-Bar Zap",
			bpm: 190,
			totalBars: 1,
			channels: [
				{
					name: "Zap",
					type: "pitch",
					presetId: "nes-pulse-12",
					barSequence: [1],
					patterns: {
						"1": [{ step: 0, note: "E5", duration: 3, pitchBend: -18 }],
					},
				},
			],
		});
		expect(shortTrack.totalBars).toBe(1);
		expect(shortTrack.loopEndBar).toBe(0);
	});
});

describe("SFX Creator Mode", () => {
	beforeEach(() => {
		useChiptuneStore.getState().resetEverything();
	});

	it("switches between music and sfx modes while preserving each project", () => {
		const store = useChiptuneStore.getState();
		store.updateSongMetadata({ title: "Hero Music Track", bpm: 140 });
		expect(useChiptuneStore.getState().studioMode).toBe("music");

		store.setStudioMode("sfx");
		let state = useChiptuneStore.getState();
		expect(state.studioMode).toBe("sfx");
		expect(state.loopMode).toBe("once");
		expect(state.song.totalBars).toBeLessThanOrEqual(2);
		expect(state.musicProjectBackup?.title).toBe("Hero Music Track");

		state.updateSongMetadata({ title: "Custom Laser Zap" });
		state.setStudioMode("music");
		state = useChiptuneStore.getState();
		expect(state.studioMode).toBe("music");
		expect(state.loopMode).toBe("song");
		expect(state.song.title).toBe("Hero Music Track");
		expect(state.sfxProjectBackup?.title).toBe("Custom Laser Zap");

		state.setStudioMode("sfx");
		expect(useChiptuneStore.getState().song.title).toBe("Custom Laser Zap");
	});

	it("loads all built-in retro SFX and short music examples", () => {
		const expectedIds = [
			"sfx-ray-gun",
			"sfx-hurt",
			"sfx-attack",
			"sfx-winning",
			"sfx-defeated",
			"sfx-coin-pickup",
			"sfx-power-up",
			"sfx-jump-boost",
			"sfx-explosion",
			"sfx-extra-life",
			"sfx-secret-unlocked",
			"sfx-shield-deflect",
			"sfx-warp-teleport",
			"sfx-stage-clear",
			"sfx-boss-warning",
			"sfx-menu-cursor",
		];
		expect(SFX_PRESETS.map((preset) => preset.id)).toEqual(expectedIds);

		useChiptuneStore.getState().loadSfxPreset("sfx-ray-gun");
		let state = useChiptuneStore.getState();
		expect(state.studioMode).toBe("sfx");
		expect(state.song.title).toBe("Ray Gun Shoot");
		expect(state.song.totalBars).toBe(1);
		expect(state.loopMode).toBe("once");
		expect(
			(getActivePatternForChannel(state.song.channels[0], 0)?.notes.length ??
				0) > 0
		).toBe(true);

		useChiptuneStore.getState().loadSfxPreset("sfx-defeated");
		state = useChiptuneStore.getState();
		expect(state.song.title).toBe("Defeated");
		expect(state.song.totalBars).toBe(2);
		expect(state.scaleLockOnly).toBe(true);
	});

	it("supports shorter tracks (1 to 4 bars) and procedural SFX generation", () => {
		const store = useChiptuneStore.getState();
		store.setStudioMode("sfx");
		store.setTotalBars(1);
		expect(useChiptuneStore.getState().song.totalBars).toBe(1);
		expect(useChiptuneStore.getState().song.loopEndBar).toBe(0);

		store.setTotalBars(2);
		expect(useChiptuneStore.getState().song.totalBars).toBe(2);
		expect(useChiptuneStore.getState().song.loopEndBar).toBe(1);

		store.generateSfxPattern("laser");
		let pattern = getActivePatternForChannel(
			useChiptuneStore.getState().song.channels[0],
			0
		);
		expect((pattern?.notes.length ?? 0) > 0).toBe(true);
		expect(pattern?.notes.some((note) => note.pitchBend < 0)).toBe(true);

		store.generateSfxPattern("hurt");
		pattern = getActivePatternForChannel(
			useChiptuneStore.getState().song.channels[0],
			0
		);
		expect((pattern?.notes.length ?? 0) > 0).toBe(true);
		expect(
			useChiptuneStore.getState().song.channels[0]?.instrument.presetId
		).toBe("vrc6-saw-lead");

		store.generateSfxPattern("boom");
		pattern = getActivePatternForChannel(
			useChiptuneStore.getState().song.channels[0],
			0
		);
		expect((pattern?.notes.length ?? 0) > 0).toBe(true);

		store.generateSfxPattern("blip");
		pattern = getActivePatternForChannel(
			useChiptuneStore.getState().song.channels[0],
			0
		);
		expect((pattern?.notes.length ?? 0) > 0).toBe(true);
	});
});

describe("Undo and Redo System", () => {
	beforeEach(() => {
		useChiptuneStore.getState().resetEverything();
	});

	it("tracks note additions and allows undoing and redoing them", () => {
		const store = useChiptuneStore.getState();
		store.clearCurrentPattern();
		useChiptuneStore.setState({
			past: [],
			future: [],
			canUndo: false,
			canRedo: false,
		});
		expect(store.canUndo).toBe(false);
		expect(store.canRedo).toBe(false);

		// Add note
		store.addOrReplaceNote({
			step: 2,
			pitch: 60,
			duration: 2,
			velocity: 0.9,
			pitchBend: 0,
		});

		expect(useChiptuneStore.getState().canUndo).toBe(true);
		expect(useChiptuneStore.getState().canRedo).toBe(false);

		let pattern = getActivePatternForChannel(
			useChiptuneStore.getState().song.channels[0],
			0
		);
		expect(pattern?.notes).toHaveLength(1);

		// Undo note addition
		useChiptuneStore.getState().undo();
		expect(useChiptuneStore.getState().canUndo).toBe(false);
		expect(useChiptuneStore.getState().canRedo).toBe(true);

		pattern = getActivePatternForChannel(
			useChiptuneStore.getState().song.channels[0],
			0
		);
		expect(pattern?.notes ?? []).toHaveLength(0);

		// Redo note addition
		useChiptuneStore.getState().redo();
		expect(useChiptuneStore.getState().canUndo).toBe(true);
		expect(useChiptuneStore.getState().canRedo).toBe(false);

		pattern = getActivePatternForChannel(
			useChiptuneStore.getState().song.channels[0],
			0
		);
		expect(pattern?.notes).toHaveLength(1);
		expect(pattern?.notes[0]?.pitch).toBe(60);
	});

	it("restores channel and bar selection when undoing", () => {
		const store = useChiptuneStore.getState();
		store.setSelectedChannelIndex(1);
		store.setSelectedBarIndex(2);

		// Edit note on channel 1, bar 2
		store.addOrReplaceNote({
			step: 0,
			pitch: 64,
			duration: 4,
			velocity: 0.8,
			pitchBend: 0,
		});

		// Switch focus somewhere else
		useChiptuneStore.getState().setSelectedChannelIndex(0);
		useChiptuneStore.getState().setSelectedBarIndex(0);

		// Undo should restore focus back to channel 1, bar 2
		useChiptuneStore.getState().undo();
		expect(useChiptuneStore.getState().selectedChannelIndex).toBe(1);
		expect(useChiptuneStore.getState().selectedBarIndex).toBe(2);
	});

	it("undoes and redoes pattern slot changes", () => {
		const store = useChiptuneStore.getState();
		expect(store.song.channels[0]?.barSequence[2]).toBe(0);
		store.setBarPatternIndex(0, 2, 3);
		expect(useChiptuneStore.getState().song.channels[0]?.barSequence[2]).toBe(
			3
		);

		useChiptuneStore.getState().undo();
		expect(useChiptuneStore.getState().song.channels[0]?.barSequence[2]).toBe(
			0
		);

		useChiptuneStore.getState().redo();
		expect(useChiptuneStore.getState().song.channels[0]?.barSequence[2]).toBe(
			3
		);
	});
});

describe("Multiple Bar Selection and Arrangement", () => {
	beforeEach(() => {
		useChiptuneStore.getState().resetEverything();
	});

	it("allows selecting multiple bars across instruments", () => {
		const store = useChiptuneStore.getState();
		expect(store.barSelection).toBeNull();

		store.setBarSelection({
			startBar: 1,
			endBar: 3,
			startChannel: 0,
			endChannel: 2,
		});

		const selection = useChiptuneStore.getState().barSelection;
		expect(selection).not.toBeNull();
		expect(selection?.startBar).toBe(1);
		expect(selection?.endBar).toBe(3);
		expect(selection?.startChannel).toBe(0);
		expect(selection?.endChannel).toBe(2);

		store.clearBarSelection();
		expect(useChiptuneStore.getState().barSelection).toBeNull();

		store.selectAllBars();
		const allSelection = useChiptuneStore.getState().barSelection;
		expect(allSelection?.startBar).toBe(0);
		expect(allSelection?.endBar).toBe(
			useChiptuneStore.getState().song.totalBars - 1
		);
		expect(allSelection?.startChannel).toBe(0);
		expect(allSelection?.endChannel).toBe(
			useChiptuneStore.getState().song.channels.length - 1
		);
	});

	it("copies and pastes multiple bars across instruments to another bar", () => {
		const store = useChiptuneStore.getState();
		// Set up pattern 1 on channel 0, bar 0 and bar 1
		store.setBarPatternIndex(0, 0, 1);
		store.setBarPatternIndex(0, 1, 2);
		// Set up pattern 1 on channel 1, bar 0 and bar 1
		store.setBarPatternIndex(1, 0, 1);
		store.setBarPatternIndex(1, 1, 1);

		// Select bars 0..1 across channels 0..1
		store.setBarSelection({
			startBar: 0,
			endBar: 1,
			startChannel: 0,
			endChannel: 1,
		});

		store.copySelectedBars();
		const clipboard = useChiptuneStore.getState().copiedBarsClipboard;
		expect(clipboard).not.toBeNull();
		expect(clipboard?.barCount).toBe(2);
		expect(clipboard?.channelCount).toBe(2);

		// Paste at bar 4
		store.pasteBarsAt(4);
		const song = useChiptuneStore.getState().song;
		expect(song.channels[0]?.barSequence[4]).toBe(1);
		expect(song.channels[0]?.barSequence[5]).toBe(2);
		expect(song.channels[1]?.barSequence[4]).toBe(1);
		expect(song.channels[1]?.barSequence[5]).toBe(1);

		// Selection should now highlight destination bars 4..5
		expect(useChiptuneStore.getState().barSelection?.startBar).toBe(4);
		expect(useChiptuneStore.getState().barSelection?.endBar).toBe(5);
	});

	it("arranges (moves) multiple bars to a specific bar and clears source", () => {
		const store = useChiptuneStore.getState();
		store.setBarPatternIndex(0, 0, 1);
		store.setBarPatternIndex(0, 1, 2);
		store.setBarPatternIndex(1, 0, 1);
		store.setBarPatternIndex(1, 1, 2);

		store.setBarSelection({
			startBar: 0,
			endBar: 1,
			startChannel: 0,
			endChannel: 1,
		});

		// Move selected bars 0..1 to bar 6
		store.moveSelectedBarsTo(6);

		let song = useChiptuneStore.getState().song;
		// Original source bars 0..1 should be cleared (0)
		expect(song.channels[0]?.barSequence[0]).toBe(0);
		expect(song.channels[0]?.barSequence[1]).toBe(0);
		expect(song.channels[1]?.barSequence[0]).toBe(0);
		expect(song.channels[1]?.barSequence[1]).toBe(0);

		// Destination bars 6..7 should have the arranged patterns
		expect(song.channels[0]?.barSequence[6]).toBe(1);
		expect(song.channels[0]?.barSequence[7]).toBe(2);
		expect(song.channels[1]?.barSequence[6]).toBe(1);
		expect(song.channels[1]?.barSequence[7]).toBe(2);

		// Undo the move
		useChiptuneStore.getState().undo();
		song = useChiptuneStore.getState().song;
		expect(song.channels[0]?.barSequence[0]).toBe(1);
		expect(song.channels[0]?.barSequence[1]).toBe(2);
		expect(song.channels[0]?.barSequence[6]).toBe(0);
	});

	it("duplicates multiple bars to another bar preserving source", () => {
		const store = useChiptuneStore.getState();
		store.setBarPatternIndex(0, 0, 1);
		store.setBarPatternIndex(0, 1, 2);

		store.setBarSelection({
			startBar: 0,
			endBar: 1,
			startChannel: 0,
			endChannel: 0,
		});

		store.duplicateSelectedBarsTo(2);

		const song = useChiptuneStore.getState().song;
		// Source preserved
		expect(song.channels[0]?.barSequence[0]).toBe(1);
		expect(song.channels[0]?.barSequence[1]).toBe(2);
		// Duplicated at bar 2..3
		expect(song.channels[0]?.barSequence[2]).toBe(1);
		expect(song.channels[0]?.barSequence[3]).toBe(2);
	});

	it("shifts selected bars left and right", () => {
		const store = useChiptuneStore.getState();
		store.setBarPatternIndex(0, 2, 1);
		store.setBarPatternIndex(0, 3, 2);

		store.setBarSelection({
			startBar: 2,
			endBar: 3,
			startChannel: 0,
			endChannel: 0,
		});

		// Shift left by 1 bar
		store.shiftSelectedBars(-1);
		let song = useChiptuneStore.getState().song;
		expect(song.channels[0]?.barSequence[1]).toBe(1);
		expect(song.channels[0]?.barSequence[2]).toBe(2);
		expect(song.channels[0]?.barSequence[3]).toBe(0);

		// Shift right by 2 bars
		store.shiftSelectedBars(2);
		song = useChiptuneStore.getState().song;
		expect(song.channels[0]?.barSequence[3]).toBe(1);
		expect(song.channels[0]?.barSequence[4]).toBe(2);
	});

	it("clears content of selected bars", () => {
		const store = useChiptuneStore.getState();
		store.setBarPatternIndex(0, 0, 1);
		store.setBarPatternIndex(0, 1, 2);
		store.setBarPatternIndex(1, 0, 3);
		store.setBarPatternIndex(1, 1, 4);

		store.setBarSelection({
			startBar: 0,
			endBar: 1,
			startChannel: 0,
			endChannel: 1,
		});

		store.clearSelectedBarsContent();
		const song = useChiptuneStore.getState().song;
		expect(song.channels[0]?.barSequence[0]).toBe(0);
		expect(song.channels[0]?.barSequence[1]).toBe(0);
		expect(song.channels[1]?.barSequence[0]).toBe(0);
		expect(song.channels[1]?.barSequence[1]).toBe(0);
	});
});

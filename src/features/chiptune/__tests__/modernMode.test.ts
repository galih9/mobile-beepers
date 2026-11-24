import { beforeEach, describe, expect, it } from "vitest";
import { renderSongToMidiBytes } from "../audio/midiExporter";
import {
	getModernTailSeconds,
	songUsesModernRack,
} from "../audio/modern/modernRack";
import {
	isModernDrumEngine,
	resolveSliceIndex,
} from "../audio/modern/modernVoices";
import {
	BUILT_IN_SAMPLE_ZONES,
	sampleNoteNameToMidi,
} from "../audio/modern/sampleLibrary";
import {
	DEMO_SONGS,
	getDemoSongMetadata,
	MODERN_DEMO_SONGS,
} from "../constants/demoSongs";
import { getPresetConfigurationById } from "../constants/instrumentPresets";
import { modernAfterglowSong } from "../constants/modernBreakcoreDemo";
import {
	getModernPresetById,
	MODERN_INSTRUMENT_PRESETS,
} from "../constants/modernPresets";
import { createBlankModernProject } from "../constants/modernProject";
import {
	buildPianoRollRows,
	MODERN_DRUM_PAD_DEFINITIONS,
} from "../constants/scalesAndNotes";
import { useChiptuneStore } from "../store/useChiptuneStore";

describe("modern mode switching", () => {
	beforeEach(() => {
		useChiptuneStore.getState().resetEverything();
	});

	it("opens the modern demo and keeps each mode's project", () => {
		const store = useChiptuneStore.getState();
		store.updateSongMetadata({ title: "My Chip Song" });

		store.setStudioMode("modern");
		let state = useChiptuneStore.getState();
		expect(state.studioMode).toBe("modern");
		expect(state.song.engine).toBe("modern");
		expect(state.song.title).toBe(modernAfterglowSong.title);
		expect(state.isPlaying).toBe(false);

		state.updateSongMetadata({ title: "My Breakcore" });
		state.setStudioMode("music");
		state = useChiptuneStore.getState();
		expect(state.studioMode).toBe("music");
		expect(state.song.title).toBe("My Chip Song");
		expect(state.modernProjectBackup?.title).toBe("My Breakcore");

		state.setStudioMode("sfx");
		state.setStudioMode("modern");
		state = useChiptuneStore.getState();
		expect(state.song.title).toBe("My Breakcore");
		expect(state.musicProjectBackup?.title).toBe("My Chip Song");
		expect(state.canUndo).toBe(false);
	});

	it("loading a modern demo from chiptune mode switches to modern", () => {
		const store = useChiptuneStore.getState();
		expect(store.studioMode).toBe("music");
		store.loadDemoSong(modernAfterglowSong.id);
		const state = useChiptuneStore.getState();
		expect(state.studioMode).toBe("modern");
		expect(state.song.title).toBe(modernAfterglowSong.title);
		expect(state.musicProjectBackup).not.toBeNull();
	});

	it("new channels and new projects use modern instruments", () => {
		const store = useChiptuneStore.getState();
		store.setStudioMode("modern");
		useChiptuneStore.getState().createNewProject();
		let state = useChiptuneStore.getState();
		expect(state.song.engine).toBe("modern");
		expect(
			state.song.channels.every((channel) => channel.instrument.modern)
		).toBe(true);

		state.addChannel("drum");
		state.addChannel("pitch");
		state = useChiptuneStore.getState();
		const [drum, pitch] = state.song.channels.slice(-2);
		expect(drum?.instrument.modern?.engine).toBe("breakKit");
		expect(pitch?.instrument.modern?.engine).toBe("grandPiano");
	});

	it("applies modern presets as deep copies and merges FX edits", () => {
		const store = useChiptuneStore.getState();
		store.setStudioMode("modern");
		useChiptuneStore.getState().applyInstrumentPreset(0, "modern-reese-bass");
		useChiptuneStore.getState().updateModernSettings(0, { cutoff: 432 });
		const channel = useChiptuneStore.getState().song.channels[0];
		expect(channel?.instrument.modern?.engine).toBe("reeseBass");
		expect(channel?.instrument.modern?.cutoff).toBe(432);
		expect(channel?.instrument.modern?.drive).toBe(
			getModernPresetById("modern-reese-bass")?.configuration.modern?.drive
		);
		// The preset constant itself is untouched
		expect(
			getModernPresetById("modern-reese-bass")?.configuration.modern?.cutoff
		).toBe(950);
	});

	it("keeps a loaded sample when swapping Sampler ↔ Break Slicer", () => {
		const store = useChiptuneStore.getState();
		store.setStudioMode("modern");
		useChiptuneStore.getState().applyInstrumentPreset(0, "modern-break-slicer");
		useChiptuneStore
			.getState()
			.updateModernSettings(0, { sampleId: "smp-test", sampleName: "Amen" });
		useChiptuneStore.getState().applyInstrumentPreset(0, "modern-sampler");
		const modern =
			useChiptuneStore.getState().song.channels[0]?.instrument.modern;
		expect(modern?.engine).toBe("sampler");
		expect(modern?.sampleId).toBe("smp-test");
		expect(modern?.sampleName).toBe("Amen");
	});
});

describe("modern presets and demo", () => {
	it("every modern preset is resolvable and has engine settings", () => {
		expect(MODERN_INSTRUMENT_PRESETS.length).toBeGreaterThanOrEqual(15);
		for (const preset of MODERN_INSTRUMENT_PRESETS) {
			expect(getPresetConfigurationById(preset.id).id).toBe(preset.id);
			expect(preset.configuration.presetId).toBe(preset.id);
			expect(preset.configuration.modern).toBeDefined();
			const isKit = preset.configuration.modern
				? isModernDrumEngine(preset.configuration.modern.engine)
				: false;
			expect(preset.category).toBe(isKit ? "drum" : "pitch");
		}
	});

	it("modern demos live apart from the chiptune demo list", () => {
		expect(MODERN_DEMO_SONGS).toContain(modernAfterglowSong);
		expect(DEMO_SONGS).not.toContain(modernAfterglowSong);
		expect(getDemoSongMetadata(modernAfterglowSong.id).category).toBe(
			"breakcore"
		);
	});

	it("Afterglow Circuit is a valid, clean-lead 32-bar loop", () => {
		const song = modernAfterglowSong;
		const stepsPerBar = song.beatsPerBar * song.stepsPerBeat;
		expect(song.totalBars).toBe(32);
		expect(song.sections?.map((section) => section.name)).toEqual([
			"Glow",
			"Surge",
		]);
		expect(songUsesModernRack(song)).toBe(true);
		for (const channel of song.channels) {
			expect(channel.instrument.modern).toBeDefined();
			expect(channel.barSequence).toHaveLength(song.totalBars);
			for (const patternIndex of channel.barSequence) {
				if (patternIndex > 0) {
					expect(channel.patterns[String(patternIndex)]).toBeDefined();
				}
			}
			for (const pattern of Object.values(channel.patterns)) {
				for (const note of pattern.notes) {
					expect(note.step + note.duration).toBeLessThanOrEqual(stepsPerBar);
					expect(note.pitchBend).toBe(0);
					expect(note.ratchet ?? 1).toBe(1);
					if (channel.type === "pitch") {
						expect(note.pitch).toBeGreaterThanOrEqual(36);
						expect(note.pitch).toBeLessThanOrEqual(84);
					} else {
						expect(note.pitch).toBeGreaterThanOrEqual(0);
						expect(note.pitch).toBeLessThanOrEqual(7);
					}
				}
			}
		}
		expect(getModernTailSeconds(song)).toBeGreaterThan(1);
		expect(renderSongToMidiBytes(song).length).toBeGreaterThan(100);
	});

	it("blank modern projects are modern and valid", () => {
		const project = createBlankModernProject();
		expect(project.engine).toBe("modern");
		expect(project.channels.map((channel) => channel.type)).toEqual([
			"pitch",
			"pitch",
			"pitch",
			"drum",
		]);
	});
});

describe("modern piano roll rows and samples", () => {
	it("shows modern kit names and one row per slice", () => {
		const drums = buildPianoRollRows("drum", "C", "minor", true, {
			drumPads: MODERN_DRUM_PAD_DEFINITIONS,
		});
		expect(drums.map((row) => row.label)).toContain("CYM");
		expect(drums).toHaveLength(8);

		const slices = buildPianoRollRows("pitch", "C", "minor", true, {
			sliceCount: 16,
		});
		expect(slices).toHaveLength(16);
		expect(slices[slices.length - 1]).toMatchObject({
			pitch: 48,
			label: "SL 1",
		});
		expect(slices[0]).toMatchObject({ pitch: 63, label: "SL 16" });
	});

	it("maps keys to break slices from C3", () => {
		expect(resolveSliceIndex(48, 16)).toBe(0);
		expect(resolveSliceIndex(63, 16)).toBe(15);
		expect(resolveSliceIndex(64, 16)).toBe(0);
		expect(resolveSliceIndex(47, 16)).toBe(15);
	});

	it("parses sample note names and covers the keyboard", () => {
		expect(sampleNoteNameToMidi("A0")).toBe(21);
		expect(sampleNoteNameToMidi("Ds3")).toBe(51);
		expect(sampleNoteNameToMidi("C8")).toBe(108);
		expect(BUILT_IN_SAMPLE_ZONES.piano).toHaveLength(30);
		const strings = BUILT_IN_SAMPLE_ZONES.strings.map((zone) => zone.rootMidi);
		expect(Math.min(...strings)).toBe(36);
		expect(Math.max(...strings)).toBe(96);
	});
});

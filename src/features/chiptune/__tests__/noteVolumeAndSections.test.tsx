import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { chiptuneAgentApi } from "../api/chiptuneAgentApi";
import { renderSongToMidiBytes } from "../audio/midiExporter";
import { VelocityLane } from "../components/VelocityLane";
import {
	computeLanePaintUpdates,
	laneYFromVelocity,
	velocityFromLaneY,
} from "../components/velocityLaneMath";
import { DEMO_SONGS } from "../constants/demoSongs";
import { MAX_CHANNELS, MAX_SONG_BARS } from "../constants/limits";
import { createSongNote } from "../constants/patternGenerator";
import {
	clampNoteVelocity,
	clampTimingOffset,
	getActivePatternForChannel,
	humanizeNotesInSong,
	normalizeSongSections,
	quantizeNotesInSong,
	updateNotePropertiesInSong,
} from "../store/songHelpers";
import { useChiptuneStore } from "../store/useChiptuneStore";
import type { NoteEvent, SongProject } from "../types/music";

const buildSongWithNotes = (notes: Array<NoteEvent>): SongProject => {
	useChiptuneStore.getState().createNewProject();
	useChiptuneStore.getState().setSelectedChannelIndex(0);
	useChiptuneStore.getState().setSelectedBarIndex(0);
	chiptuneAgentApi.setBarNotes(
		0,
		0,
		notes.map((note) => ({
			step: note.step,
			pitch: note.pitch,
			duration: note.duration,
			velocity: note.velocity,
		}))
	);
	return useChiptuneStore.getState().song;
};

const getBarNotes = (song: SongProject): Array<NoteEvent> => {
	const channel = song.channels[0];
	return channel ? (getActivePatternForChannel(channel, 0)?.notes ?? []) : [];
};

describe("per-note volume (velocity)", () => {
	beforeEach(() => {
		useChiptuneStore.getState().resetEverything();
	});

	it("clamps velocity and timing values", () => {
		expect(clampNoteVelocity(2)).toBe(1);
		expect(clampNoteVelocity(0)).toBe(0.1);
		expect(clampNoteVelocity(0.456)).toBe(0.46);
		expect(clampNoteVelocity(Number.NaN)).toBe(0.9);
		expect(clampTimingOffset(0.9)).toBe(0.5);
		expect(clampTimingOffset(-0.9)).toBe(-0.5);
		expect(clampTimingOffset(Number.NaN)).toBe(0);
	});

	it("updates velocity and timing of notes by id", () => {
		const song = buildSongWithNotes([
			createSongNote(0, 60, 2),
			createSongNote(4, 64, 2),
		]);
		const [first, second] = getBarNotes(song);
		const updated = updateNotePropertiesInSong(song, 0, 0, [
			{ id: first?.id ?? "", velocity: 0.3 },
			{ id: second?.id ?? "", timingOffset: -0.2 },
		]);
		const notes = getBarNotes(updated);
		expect(notes[0]?.velocity).toBe(0.3);
		expect(notes[0]?.timingOffset).toBeUndefined();
		expect(notes[1]?.timingOffset).toBe(-0.2);
		const reset = updateNotePropertiesInSong(updated, 0, 0, [
			{ id: second?.id ?? "", timingOffset: 0 },
		]);
		expect(getBarNotes(reset)[1]).not.toHaveProperty("timingOffset");
	});

	it("uses the default note volume for drawn notes and stores selection", () => {
		const store = useChiptuneStore.getState();
		store.setDefaultNoteVelocity(0.42);
		expect(useChiptuneStore.getState().defaultNoteVelocity).toBe(0.42);
		store.setSelectedNoteIds(["a", "a", "b"]);
		expect(useChiptuneStore.getState().selectedNoteIds).toEqual(["a", "b"]);
		store.setSelectedBarIndex(1);
		expect(useChiptuneStore.getState().selectedNoteIds).toEqual([]);
	});

	it("updateNoteProperties is undoable as one step while dragging", () => {
		buildSongWithNotes([createSongNote(0, 60, 2)]);
		const original = getBarNotes(useChiptuneStore.getState().song)[0];
		const noteId = original?.id ?? "";
		const store = useChiptuneStore.getState();
		const pastBefore = useChiptuneStore.getState().past.length;
		store.updateNoteProperties([{ id: noteId, velocity: 0.5 }], "drag");
		store.updateNoteProperties([{ id: noteId, velocity: 0.4 }], "drag");
		store.updateNoteProperties([{ id: noteId, velocity: 0.3 }], "drag");
		expect(useChiptuneStore.getState().past.length).toBe(pastBefore + 1);
		useChiptuneStore.getState().undo();
		expect(getBarNotes(useChiptuneStore.getState().song)[0]?.velocity).toBe(
			original?.velocity
		);
	});

	it("humanize is repeatable, keeps accents and never pulls a downbeat early", () => {
		const song = buildSongWithNotes([
			{ ...createSongNote(0, 60, 2), velocity: 1 },
			{ ...createSongNote(4, 62, 2), velocity: 0.5 },
			{ ...createSongNote(8, 64, 2), velocity: 1 },
		]);
		const first = humanizeNotesInSong(song, 0, 0, { seed: 7 });
		const second = humanizeNotesInSong(song, 0, 0, { seed: 7 });
		expect(getBarNotes(first)).toEqual(getBarNotes(second));
		const notes = getBarNotes(first);
		for (const note of notes) {
			expect(Math.abs(note.timingOffset ?? 0)).toBeLessThanOrEqual(0.08);
		}
		expect(notes[0]?.timingOffset ?? 0).toBeGreaterThanOrEqual(0);
		expect(notes[1]?.velocity ?? 1).toBeLessThan(notes[0]?.velocity ?? 0);
		expect(notes[1]?.velocity ?? 1).toBeLessThan(notes[2]?.velocity ?? 0);
		const quantized = quantizeNotesInSong(first, 0, 0);
		for (const note of getBarNotes(quantized)) {
			expect(note.timingOffset).toBeUndefined();
		}
	});

	it("humanizeCurrentPattern only touches selected notes when there is a selection", () => {
		buildSongWithNotes([createSongNote(0, 60, 2), createSongNote(4, 62, 2)]);
		const [first, second] = getBarNotes(useChiptuneStore.getState().song);
		useChiptuneStore.getState().setSelectedNoteIds([second?.id ?? ""]);
		useChiptuneStore
			.getState()
			.humanizeCurrentPattern({ seed: 3, velocityAmount: 0.3 });
		const notes = getBarNotes(useChiptuneStore.getState().song);
		expect(notes[0]).toEqual(first);
		expect(notes[1]).not.toEqual(second);
	});
});

describe("velocity lane", () => {
	it("maps lane positions to velocities", () => {
		expect(velocityFromLaneY(laneYFromVelocity(0.7, 64), 64)).toBe(0.7);
		expect(velocityFromLaneY(-50, 64)).toBe(1);
		expect(velocityFromLaneY(500, 64)).toBe(0.1);
	});

	it("paints a straight line of volumes across steps", () => {
		const notes = [0, 4, 8].map((step) => ({
			...createSongNote(step, 60, 2),
			id: `n${step}`,
		}));
		const updates = computeLanePaintUpdates({
			notes,
			from: { step: 0, velocity: 1 },
			to: { step: 8, velocity: 0.2 },
			editableIds: null,
		});
		expect(updates).toEqual([
			{ id: "n0", velocity: 1 },
			{ id: "n4", velocity: 0.6 },
			{ id: "n8", velocity: 0.2 },
		]);
		const selectedOnly = computeLanePaintUpdates({
			notes,
			from: { step: 0, velocity: 0.3 },
			to: { step: 8, velocity: 0.3 },
			editableIds: new Set(["n4"]),
		});
		expect(selectedOnly).toEqual([{ id: "n4", velocity: 0.3 }]);
	});

	it("sets a note volume when clicking its step in the lane", () => {
		const onUpdate = vi.fn();
		const notes = [{ ...createSongNote(4, 60, 2), id: "n4" }];
		const { getByRole } = render(
			<VelocityLane
				color="#f472b6"
				height={64}
				notes={notes}
				selectedNoteIds={[]}
				stepWidth={20}
				stepsPerBar={16}
				stepsPerBeat={4}
				onUpdate={onUpdate}
			/>
		);
		fireEvent.pointerDown(getByRole("application"), {
			clientX: 4 * 20 + 5,
			clientY: laneYFromVelocity(0.5, 64),
			pointerId: 1,
		});
		expect(onUpdate).toHaveBeenCalledWith([{ id: "n4", velocity: 0.5 }]);
	});
});

describe("micro-timing export", () => {
	it("shifts MIDI note starts by the timing offset", () => {
		const song = buildSongWithNotes([createSongNote(4, 60, 2)]);
		const noteId = getBarNotes(song)[0]?.id ?? "";
		const onGrid = renderSongToMidiBytes(song);
		const nudged = renderSongToMidiBytes(
			updateNotePropertiesInSong(song, 0, 0, [
				{ id: noteId, timingOffset: 0.25 },
			])
		);
		expect(Array.from(nudged)).not.toEqual(Array.from(onGrid));
		const reset = renderSongToMidiBytes(
			updateNotePropertiesInSong(song, 0, 0, [{ id: noteId, timingOffset: 0 }])
		);
		expect(Array.from(reset)).toEqual(Array.from(onGrid));
	});
});

describe("song limits", () => {
	beforeEach(() => {
		useChiptuneStore.getState().resetEverything();
	});

	it("allows songs longer than 32 bars and more than 8 channels", () => {
		useChiptuneStore.getState().setTotalBars(64);
		expect(useChiptuneStore.getState().song.totalBars).toBe(64);
		useChiptuneStore.getState().setTotalBars(999);
		expect(useChiptuneStore.getState().song.totalBars).toBe(MAX_SONG_BARS);
		for (let index = 0; index < 20; index += 1) {
			useChiptuneStore.getState().addChannel("pitch");
		}
		expect(useChiptuneStore.getState().song.channels).toHaveLength(
			MAX_CHANNELS
		);
	});
});

describe("song sections", () => {
	beforeEach(() => {
		useChiptuneStore.getState().resetEverything();
	});

	it("normalizes, sorts and names sections", () => {
		const sections = normalizeSongSections(
			[
				{ name: "B", startBar: 8, endBar: 99 },
				{ name: "  ", startBar: -3, endBar: 3 },
			],
			16
		);
		expect(
			sections.map((section) => [section.startBar, section.endBar])
		).toEqual([
			[0, 3],
			[8, 15],
		]);
		expect(sections[0]?.name).toBe("Section B");
	});

	it("saves the loop as a section and loops it again later", () => {
		const store = useChiptuneStore.getState();
		store.setTotalBars(16);
		store.setLoopRange(4, 7);
		store.addSectionFromLoop("Clash");
		store.addSectionFromLoop("Duplicate ignored");
		store.setLoopRange(0, 15);
		const sections = useChiptuneStore.getState().song.sections ?? [];
		expect(sections).toHaveLength(1);
		expect(sections[0]?.name).toBe("Clash");
		useChiptuneStore.getState().loopSection(sections[0]?.id ?? "");
		const song = useChiptuneStore.getState().song;
		expect([song.loopStartBar, song.loopEndBar]).toEqual([4, 7]);
		useChiptuneStore.getState().renameSection(sections[0]?.id ?? "", "Rush");
		expect(useChiptuneStore.getState().song.sections?.[0]?.name).toBe("Rush");
		useChiptuneStore.getState().setTotalBars(4);
		expect(useChiptuneStore.getState().song.sections).toEqual([]);
	});

	it("ships Breakcore Battle v1 with its three loop sections", () => {
		const demo = DEMO_SONGS.find(
			(song) => song.id === "demo-breakcore-battle-v1"
		);
		expect(demo?.totalBars).toBe(48);
		expect(demo?.sections?.map((section) => section.name)).toEqual([
			"Command",
			"Clash",
			"Rush",
		]);
	});

	it("exposes sections, velocity and timing through the agent API", () => {
		chiptuneAgentApi.composeSong({
			bpm: 174,
			totalBars: 8,
			sections: [
				{ name: "Calm", startBar: 0, endBar: 3 },
				{ name: "Hype", startBar: 4, endBar: 7 },
			],
			channels: [
				{
					name: "Lead",
					type: "pitch",
					barSequence: [1, 1, 1, 1, 1, 1, 1, 1],
					patterns: {
						"1": [
							{ step: 0, note: "A4", velocity: 0.6, timingOffset: 0.9 },
							{ step: 4, note: "C#5" },
						],
					},
				},
			],
		});
		expect(
			chiptuneAgentApi.listSections().map((section) => section.name)
		).toEqual(["Calm", "Hype"]);
		expect(chiptuneAgentApi.loopSection("hype")).toEqual({
			loopStartBar: 4,
			loopEndBar: 7,
		});
		const notes = getBarNotes(useChiptuneStore.getState().song);
		expect(notes[0]?.velocity).toBe(0.6);
		expect(notes[0]?.timingOffset).toBe(0.5);
		expect(
			chiptuneAgentApi.setNoteVelocity(5, "C#5", 0.33, 0, 0)?.velocity
		).toBe(0.33);
		expect(
			chiptuneAgentApi.setNoteTiming(4, "C#5", -0.1, 0, 0)?.timingOffset
		).toBe(-0.1);
		const scaled = chiptuneAgentApi.scalePatternVelocity(0.5, 0, 0);
		expect(scaled.map((note) => note.velocity)).toEqual([0.3, 0.17]);
		expect(chiptuneAgentApi.setNoteVelocity(15, "A4", 1, 0, 0)).toBeNull();
	});
});

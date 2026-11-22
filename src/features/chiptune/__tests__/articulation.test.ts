import { beforeEach, describe, expect, it } from "vitest";
import { chiptuneAgentApi } from "../api/chiptuneAgentApi";
import {
	buildNotePlaybackContext,
	buildOrnamentPitchEvents,
	findLegatoSource,
	getScaleNeighborInterval,
	resolveArticulationShape,
	resolveGateSteps,
} from "../audio/articulation";
import { renderSongToMidiBytes } from "../audio/midiExporter";
import { updateNotePropertiesInSong } from "../store/songHelpers";
import { useChiptuneStore } from "../store/useChiptuneStore";
import type { NoteEvent } from "../types/music";

const note = (overrides: Partial<NoteEvent> & { id: string }): NoteEvent => ({
	step: 0,
	pitch: 60,
	duration: 2,
	velocity: 0.8,
	pitchBend: 0,
	...overrides,
});

const C_MAJOR = { rootKey: "C" as const, scale: "major" as const };

describe("articulation shapes", () => {
	it("shortens staccato and marcato, keeps the rest at full length", () => {
		expect(resolveGateSteps({ duration: 4, articulation: "staccato" })).toBe(
			1.8
		);
		expect(
			resolveGateSteps({ duration: 4, articulation: "marcato" })
		).toBeCloseTo(2.88);
		expect(resolveGateSteps({ duration: 4, articulation: "tenuto" })).toBe(4);
		expect(resolveGateSteps({ duration: 4 })).toBe(4);
	});

	it("makes accents louder and brighter, marcato more so", () => {
		const accent = resolveArticulationShape("accent");
		const marcato = resolveArticulationShape("marcato");
		const normal = resolveArticulationShape(undefined);
		expect(accent.gainMultiplier).toBeGreaterThan(normal.gainMultiplier);
		expect(marcato.gainMultiplier).toBeGreaterThan(accent.gainMultiplier);
		expect(accent.filterBoost).toBeGreaterThan(1);
		expect(resolveArticulationShape("tenuto").minSustain).toBeGreaterThan(0.5);
	});
});

describe("scale neighbours for ornaments", () => {
	it("uses the scale step above and below", () => {
		// E4 in C major: F is a half step up, D a whole step down
		expect(getScaleNeighborInterval(64, "C", "major", 1)).toBe(1);
		expect(getScaleNeighborInterval(64, "C", "major", -1)).toBe(-2);
		// A minor: B -> C is a half step
		expect(getScaleNeighborInterval(71, "A", "minor", 1)).toBe(1);
	});

	it("keeps pentatonic ornaments to a whole tone at most", () => {
		// E in C major pentatonic: the next scale note G is 3 semitones away
		expect(getScaleNeighborInterval(64, "C", "pentatonicMajor", 1)).toBe(2);
	});
});

describe("legato context", () => {
	const first = note({ id: "a", step: 0, pitch: 60, duration: 4 });
	const slurred = note({
		id: "b",
		step: 4,
		pitch: 64,
		duration: 4,
		articulation: "legato",
	});
	const detached = note({ id: "c", step: 10, pitch: 67, duration: 2 });
	const notes = [first, slurred, detached];

	it("finds the touching note a legato note slurs from", () => {
		expect(findLegatoSource(notes, slurred)?.id).toBe("a");
		expect(
			findLegatoSource(notes, { ...detached, articulation: "legato" })
		).toBeUndefined();
	});

	it("gives the legato note a slide source and cuts the previous note", () => {
		expect(
			buildNotePlaybackContext(notes, slurred, C_MAJOR)?.slideFromPitch
		).toBe(60);
		expect(buildNotePlaybackContext(notes, first, C_MAJOR)?.cutAfterSteps).toBe(
			4
		);
		expect(
			buildNotePlaybackContext(notes, detached, C_MAJOR)?.cutAfterSteps
		).toBeUndefined();
	});

	it("does nothing on drum channels or plain patterns", () => {
		expect(
			buildNotePlaybackContext(notes, slurred, C_MAJOR, true)
		).toBeUndefined();
		expect(
			buildNotePlaybackContext([first, detached], first, C_MAJOR)
		).toBeUndefined();
	});
});

describe("ornament pitch events", () => {
	const neighbours = { upperNeighbor: 2, lowerNeighbor: -1 };

	it("flicks a grace note from below into the main note", () => {
		expect(buildOrnamentPitchEvents("grace", 0.5, 0.1, neighbours)).toEqual([
			{ time: 0, offset: -1 },
			{ time: 0.05, offset: 0 },
		]);
	});

	it("plays a mordent as note, upper neighbour, note", () => {
		const events = buildOrnamentPitchEvents("mordent", 0.5, 0.1, neighbours);
		expect(events.map((event) => event.offset)).toEqual([0, 2, 0]);
	});

	it("alternates a trill for the whole note and ends on the written pitch", () => {
		const events = buildOrnamentPitchEvents("trill", 0.4, 0.1, neighbours);
		expect(events.length).toBeGreaterThan(5);
		expect(events[0]?.offset).toBe(0);
		expect(events[1]?.offset).toBe(2);
		expect(events[events.length - 1]?.offset).toBe(0);
	});

	it("skips ornaments that do not fit in very short notes", () => {
		expect(buildOrnamentPitchEvents("mordent", 0.05, 0.1, neighbours)).toEqual(
			[]
		);
	});
});

describe("articulation editing", () => {
	beforeEach(() => {
		useChiptuneStore.getState().createNewProject();
	});

	it("sets and clears articulation / ornament through note property updates", () => {
		const api = chiptuneAgentApi;
		api.setBarNotes(0, 0, [
			{ step: 0, note: "C4", duration: 4 },
			{ step: 4, note: "E4", duration: 4 },
		]);
		const song = useChiptuneStore.getState().song;
		const [firstNote] = api.getSong().channels[0]?.patterns["1"]?.notes ?? [];
		expect(firstNote).toBeDefined();
		const withArticulation = updateNotePropertiesInSong(song, 0, 0, [
			{ id: firstNote?.id ?? "", articulation: "staccato", ornament: "trill" },
		]);
		const updated = withArticulation.channels[0]?.patterns["1"]?.notes.find(
			(candidate) => candidate.id === firstNote?.id
		);
		expect(updated?.articulation).toBe("staccato");
		expect(updated?.ornament).toBe("trill");

		const cleared = updateNotePropertiesInSong(withArticulation, 0, 0, [
			{ id: firstNote?.id ?? "", articulation: null, ornament: null },
		]);
		const clearedNote = cleared.channels[0]?.patterns["1"]?.notes.find(
			(candidate) => candidate.id === firstNote?.id
		);
		expect(clearedNote).not.toHaveProperty("articulation");
		expect(clearedNote).not.toHaveProperty("ornament");
	});

	it("accepts articulation and ornaments from the agent API", () => {
		const api = chiptuneAgentApi;
		const notes = api.setBarNotes(0, 0, [
			{ step: 0, note: "C4", duration: 2, articulation: "accent" },
			{ step: 2, note: "D4", duration: 2, articulation: "legato" },
			{ step: 4, note: "E4", duration: 4, ornament: "mordent" },
			{
				step: 8,
				note: "G4",
				duration: 2,
				articulation: "bogus" as "accent",
			},
		]);
		expect(notes.map((item) => item.articulation)).toEqual([
			"accent",
			"legato",
			undefined,
			undefined,
		]);
		expect(notes[2]?.ornament).toBe("mordent");

		expect(api.setNoteArticulation(8, "G4", "staccato")?.articulation).toBe(
			"staccato"
		);
		expect(api.setNoteOrnament(4, "E4", null)).not.toHaveProperty("ornament");
		const all = api.setPatternArticulation("tenuto");
		expect(all.every((item) => item.articulation === "tenuto")).toBe(true);
		expect(api.listArticulations().articulations).toHaveLength(5);
	});

	it("gives new notes the default articulation", () => {
		const state = useChiptuneStore.getState();
		state.setDefaultNoteArticulation("staccato");
		expect(useChiptuneStore.getState().defaultNoteArticulation).toBe(
			"staccato"
		);
		state.setDefaultNoteArticulation("nope" as "staccato");
		expect(useChiptuneStore.getState().defaultNoteArticulation).toBeNull();
	});

	it("writes staccato shorter and accents louder to MIDI", () => {
		const api = chiptuneAgentApi;
		api.setBarNotes(0, 0, [{ step: 0, note: "C4", duration: 4, velocity: 0.5 }]);
		const plainBytes = renderSongToMidiBytes(useChiptuneStore.getState().song);
		api.setNoteArticulation(0, "C4", "staccato");
		const staccatoBytes = renderSongToMidiBytes(
			useChiptuneStore.getState().song
		);
		api.setNoteArticulation(0, "C4", "accent");
		const accentBytes = renderSongToMidiBytes(useChiptuneStore.getState().song);

		const findNoteOnVelocity = (bytes: Uint8Array): number => {
			for (let index = 0; index < bytes.length - 2; index += 1) {
				if ((bytes[index] ?? 0) >> 4 === 0x9 && bytes[index + 1] === 60) {
					return bytes[index + 2] ?? 0;
				}
			}
			return -1;
		};
		expect(findNoteOnVelocity(accentBytes)).toBeGreaterThan(
			findNoteOnVelocity(plainBytes)
		);
		expect(staccatoBytes).not.toEqual(plainBytes);
	});
});

import { beforeEach, describe, expect, it } from "vitest";
import { chiptuneAgentApi } from "../api/chiptuneAgentApi";
import { expandRatchetedNotes } from "../audio/midiExporter";
import { resolveRatchetCount } from "../audio/noteRatchet";
import { DEMO_SONGS, getDemoSongMetadata } from "../constants/demoSongs";
import { INSTRUMENT_PRESETS } from "../constants/instrumentPresets";
import { createSongNote } from "../constants/patternGenerator";
import {
	cycleNoteRatchetInSong,
	getActivePatternForChannel,
} from "../store/songHelpers";
import { useChiptuneStore } from "../store/useChiptuneStore";

describe("breakcore toolkit", () => {
	beforeEach(() => {
		useChiptuneStore.getState().createNewProject();
	});

	it("registers the breakcore instrument presets with drive", () => {
		const presetsById = new Map(
			INSTRUMENT_PRESETS.map((preset) => [preset.id, preset])
		);
		for (const id of [
			"breakcore-rave-lead",
			"breakcore-glitch-arp",
			"breakcore-glass-pad",
			"breakcore-reese-bass",
			"breakcore-amen-kit",
			"breakcore-gabber-kick",
		]) {
			expect(presetsById.has(id)).toBe(true);
		}
		expect(
			presetsById.get("breakcore-gabber-kick")?.configuration.drive
		).toBeGreaterThan(0.7);
		expect(presetsById.get("breakcore-amen-kit")?.category).toBe("drum");
	});

	it("loads Amen Overdrive 180 as a 32-bar 180 BPM breakcore demo", () => {
		expect(DEMO_SONGS[0]?.id).toBe("demo-breakcore-battle-v1");
		expect(getDemoSongMetadata("demo-amen-overdrive-180").category).toBe(
			"breakcore"
		);

		useChiptuneStore.getState().loadDemoSong("demo-amen-overdrive-180");
		const { song } = useChiptuneStore.getState();
		expect(song.title).toBe("Amen Overdrive 180");
		expect(song.bpm).toBe(180);
		expect(song.rootKey).toBe("E");
		expect(song.scale).toBe("minor");
		expect(song.totalBars).toBe(32);
		expect(song.channels).toHaveLength(8);

		const presetIds = new Set(INSTRUMENT_PRESETS.map((preset) => preset.id));
		const stepsPerBar = song.beatsPerBar * song.stepsPerBeat;
		for (const channel of song.channels) {
			expect(presetIds.has(channel.instrument.presetId)).toBe(true);
			expect(channel.barSequence).toHaveLength(32);
			for (const patternIndex of channel.barSequence) {
				if (patternIndex > 0) {
					expect(channel.patterns[String(patternIndex)]).toBeDefined();
				}
			}
			for (const pattern of Object.values(channel.patterns)) {
				for (const note of pattern.notes) {
					expect(note.step).toBeGreaterThanOrEqual(0);
					expect(note.step + note.duration).toBeLessThanOrEqual(stepsPerBar);
					if (channel.type === "drum") {
						expect(note.pitch).toBeGreaterThanOrEqual(0);
						expect(note.pitch).toBeLessThanOrEqual(7);
					} else {
						expect(note.pitch).toBeGreaterThanOrEqual(36);
						expect(
							note.pitch + Math.max(0, note.pitchBend)
						).toBeLessThanOrEqual(84);
					}
				}
			}
		}

		const allNotes = song.channels.flatMap((channel) =>
			Object.values(channel.patterns).flatMap((pattern) => pattern.notes)
		);
		expect(allNotes.some((note) => (note.ratchet ?? 1) >= 8)).toBe(true);
		expect(
			song.channels.some(
				(channel) =>
					channel.type === "drum" &&
					Object.values(channel.patterns).some((pattern) =>
						pattern.notes.some((note) => note.pitchBend !== 0)
					)
			)
		).toBe(true);
	});

	it("cycles the stutter ratchet on a note: off → 2 → 3 → 4 → 6 → 8 → off", () => {
		let song = useChiptuneStore.getState().song;
		song = {
			...song,
			channels: song.channels.map((channel, index) =>
				index === 0
					? {
							...channel,
							barSequence: channel.barSequence.map((value, bar) =>
								bar === 0 ? 1 : value
							),
							patterns: {
								...channel.patterns,
								"1": { index: 1, notes: [createSongNote(0, 60, 4)] },
							},
						}
					: channel
			),
		};
		const seen: Array<number> = [];
		for (let index = 0; index < 6; index += 1) {
			song = cycleNoteRatchetInSong(song, 0, 0, 1, 60);
			const note = getActivePatternForChannel(song.channels[0], 0)?.notes[0];
			seen.push(note?.ratchet ?? 1);
		}
		expect(seen).toEqual([2, 3, 4, 6, 8, 1]);
	});

	it("normalizes ratchet through the agent API and the store tool", () => {
		const notes = chiptuneAgentApi.setBarNotes(0, 0, [
			{ step: 0, note: "C4", duration: 4, ratchet: 12 },
			{ step: 4, note: "D4", duration: 2, ratchet: 1 },
		]);
		expect(notes[0]?.ratchet).toBe(8);
		expect(notes[1]?.ratchet).toBeUndefined();

		chiptuneAgentApi.updateChannelInstrument(0, { drive: 0.6 });
		expect(chiptuneAgentApi.getSong().channels[0]?.instrument.drive).toBe(0.6);

		chiptuneAgentApi.setTool("stutter");
		expect(useChiptuneStore.getState().activeTool).toBe("stutter");
		chiptuneAgentApi.selectChannel(0);
		chiptuneAgentApi.selectBar(0);
		useChiptuneStore.getState().cycleNoteRatchetAt(4, 62);
		const pattern = getActivePatternForChannel(
			useChiptuneStore.getState().song.channels[0],
			0
		);
		expect(pattern?.notes.find((note) => note.pitch === 62)?.ratchet).toBe(2);
	});

	it("expands ratchets into individual retriggers for MIDI export", () => {
		expect(resolveRatchetCount(undefined)).toBe(1);
		expect(resolveRatchetCount(5.6)).toBe(6);
		expect(resolveRatchetCount(99)).toBe(8);

		const drumRoll = expandRatchetedNotes(
			[{ ...createSongNote(8, 1, 4, 7), ratchet: 4 }],
			true
		);
		expect(drumRoll.map((note) => note.step)).toEqual([8, 9, 10, 11]);
		expect(drumRoll.every((note) => note.pitch === 1)).toBe(true);

		const leadRiser = expandRatchetedNotes(
			[{ ...createSongNote(0, 60, 8, 12), ratchet: 3 }],
			false
		);
		expect(leadRiser.map((note) => note.pitch)).toEqual([60, 66, 72]);
		expect(leadRiser.every((note) => note.pitchBend === 0)).toBe(true);
	});
});

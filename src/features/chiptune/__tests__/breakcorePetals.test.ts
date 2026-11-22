import { beforeEach, describe, expect, it } from "vitest";
import {
	breakcorePetalsSong,
	PETALS_CHORD_CHART,
	PETALS_CHORDS,
	PETALS_SECTIONS,
} from "../constants/breakcorePetalsDemo";
import { DEMO_SONGS, getDemoSongMetadata } from "../constants/demoSongs";
import { INSTRUMENT_PRESETS } from "../constants/instrumentPresets";
import { useChiptuneStore } from "../store/useChiptuneStore";
import type { Channel, NoteEvent } from "../types/music";

const channelById = (id: string): Channel => {
	const channel = breakcorePetalsSong.channels.find(
		(candidate) => candidate.id === id
	);
	if (!channel) {
		throw new Error(`missing channel ${id}`);
	}
	return channel;
};

const notesInBar = (channel: Channel, bar: number): Array<NoteEvent> => {
	const patternIndex = channel.barSequence[bar] ?? 0;
	return patternIndex > 0
		? (channel.patterns[String(patternIndex)]?.notes ?? [])
		: [];
};

/** Lead of every bar: the piano hook, or the long string melody in "Static". */
const leadNotesInBar = (bar: number): Array<NoteEvent> => {
	const piano = notesInBar(channelById("pt-piano"), bar);
	return piano.length > 0
		? piano
		: notesInBar(channelById("pt-strings"), bar);
};

describe("Petals in the Static (breakcore battle demo)", () => {
	beforeEach(() => {
		useChiptuneStore.getState().createNewProject();
	});

	it("loads as a valid 48-bar, 172 BPM G-minor song with three loop sections", () => {
		expect(DEMO_SONGS.some((song) => song.id === breakcorePetalsSong.id)).toBe(
			true
		);
		expect(getDemoSongMetadata("demo-breakcore-petals-172").category).toBe(
			"breakcore"
		);
		useChiptuneStore.getState().loadDemoSong("demo-breakcore-petals-172");
		const { song } = useChiptuneStore.getState();
		expect(song.title).toBe("Petals in the Static");
		expect(song.bpm).toBe(172);
		expect(song.rootKey).toBe("G");
		expect(song.scale).toBe("minor");
		expect(song.totalBars).toBe(48);
		expect(song.sections?.map((section) => section.name)).toEqual(
			PETALS_SECTIONS.map((section) => section.name)
		);

		const presetIds = new Set(INSTRUMENT_PRESETS.map((preset) => preset.id));
		const ids = new Set<string>();
		for (const channel of song.channels) {
			expect(presetIds.has(channel.instrument.presetId)).toBe(true);
			expect(channel.barSequence).toHaveLength(48);
			for (const pattern of Object.values(channel.patterns)) {
				for (const note of pattern.notes) {
					expect(ids.has(note.id)).toBe(false);
					ids.add(note.id);
					expect(note.step + note.duration).toBeLessThanOrEqual(16);
					if (channel.type === "pitch") {
						expect(note.pitch).toBeGreaterThanOrEqual(36);
						expect(note.pitch).toBeLessThanOrEqual(84);
					}
				}
			}
		}
	});

	it("uses no stutters and no pitch bends anywhere", () => {
		for (const channel of breakcorePetalsSong.channels) {
			for (const pattern of Object.values(channel.patterns)) {
				for (const note of pattern.notes) {
					expect(note.ratchet ?? 1, channel.name).toBe(1);
					expect(note.pitchBend, channel.name).toBe(0);
				}
			}
		}
	});

	it("puts chord tones on every strong step of the lead", () => {
		for (let bar = 0; bar < 48; bar += 1) {
			const chord = PETALS_CHORDS[PETALS_CHORD_CHART[bar] ?? "Ebmaj7"];
			const lead = leadNotesInBar(bar);
			expect(lead.length, `bar ${bar + 1} has a lead`).toBeGreaterThan(0);
			for (const note of lead) {
				if (note.step % 4 === 0) {
					expect(
						chord.tones.includes(note.pitch % 12),
						`bar ${bar + 1} step ${note.step} pitch ${note.pitch}`
					).toBe(true);
				}
			}
		}
	});

	it("lets every 2-bar lead phrase breathe within a singable range", () => {
		let lowest = 127;
		let highest = 0;
		for (let bar = 0; bar < 48; bar += 1) {
			const notes = leadNotesInBar(bar);
			if (bar % 2 === 1) {
				const lastEnd = Math.max(...notes.map((n) => n.step + n.duration));
				expect(lastEnd, `bar ${bar + 1} needs a breath`).toBeLessThan(16);
			}
			for (const note of notes) {
				lowest = Math.min(lowest, note.pitch);
				highest = Math.max(highest, note.pitch);
			}
		}
		expect(highest - lowest).toBeLessThanOrEqual(16);
	});

	it("keeps accents sparse, slurs only touching notes and the counter-line below the lead", () => {
		for (const channel of breakcorePetalsSong.channels) {
			for (const pattern of Object.values(channel.patterns)) {
				const accents = pattern.notes.filter(
					(note) =>
						note.articulation === "accent" || note.articulation === "marcato"
				);
				expect(accents.length).toBeLessThanOrEqual(2);
				for (const note of pattern.notes) {
					if (note.articulation === "legato") {
						expect(
							pattern.notes.some(
								(other) =>
									other !== note && other.step + other.duration === note.step
							),
							`${channel.name} legato @${note.step}`
						).toBe(true);
					}
				}
			}
		}
		const strings = channelById("pt-strings");
		for (let bar = 32; bar < 48; bar += 1) {
			const lead = notesInBar(channelById("pt-piano"), bar);
			for (const counter of notesInBar(strings, bar)) {
				for (const leadNote of lead) {
					const overlaps =
						leadNote.step < counter.step + counter.duration &&
						leadNote.step + leadNote.duration > counter.step;
					if (overlaps) {
						expect(counter.pitch, `bar ${bar + 1}`).toBeLessThan(
							leadNote.pitch
						);
					}
				}
			}
		}
	});
});

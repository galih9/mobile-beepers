import { beforeEach, describe, expect, it } from "vitest";
import {
	breakcoreShatteredHaloSong,
	HALO_CHORD_CHART,
	HALO_CHORDS,
	HALO_SECTIONS,
} from "../constants/breakcoreShatteredHaloDemo";
import { DEMO_SONGS, getDemoSongMetadata } from "../constants/demoSongs";
import { INSTRUMENT_PRESETS } from "../constants/instrumentPresets";
import { useChiptuneStore } from "../store/useChiptuneStore";
import type { Channel, NoteEvent } from "../types/music";

const channelById = (id: string): Channel => {
	const channel = breakcoreShatteredHaloSong.channels.find(
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
	const piano = notesInBar(channelById("sh-lead"), bar);
	return piano.length > 0 ? piano : notesInBar(channelById("sh-lead"), bar);
};

describe("Shattered Halo (heavy breakcore battle demo)", () => {
	beforeEach(() => {
		useChiptuneStore.getState().createNewProject();
	});

	it("loads as a valid 48-bar, 175 BPM F#-minor song with three loop sections", () => {
		expect(
			DEMO_SONGS.some((song) => song.id === breakcoreShatteredHaloSong.id)
		).toBe(true);
		expect(
			getDemoSongMetadata("demo-breakcore-shattered-halo-175").category
		).toBe("breakcore");
		useChiptuneStore
			.getState()
			.loadDemoSong("demo-breakcore-shattered-halo-175");
		const { song } = useChiptuneStore.getState();
		expect(song.title).toBe("Shattered Halo");
		expect(song.bpm).toBe(175);
		expect(song.rootKey).toBe("F#");
		expect(song.scale).toBe("minor");
		expect(song.totalBars).toBe(48);
		expect(song.sections?.map((section) => section.name)).toEqual(
			HALO_SECTIONS.map((section) => section.name)
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

	it("never bends pitch, and stutters only as drum rolls in fills", () => {
		for (const channel of breakcoreShatteredHaloSong.channels) {
			channel.barSequence.forEach((patternIndex, bar) => {
				for (const note of channel.patterns[String(patternIndex)]?.notes ??
					[]) {
					expect(note.pitchBend, channel.name).toBe(0);
					if ((note.ratchet ?? 1) > 1) {
						expect(channel.type, `${channel.name} bar ${bar + 1}`).toBe("drum");
						// Fills live on the 8th and 16th bar of every section
						expect(bar % 8, `roll in bar ${bar + 1}`).toBe(7);
					}
				}
			});
		}
	});

	it("puts chord tones on every strong step of the lead", () => {
		for (let bar = 0; bar < 48; bar += 1) {
			const chord = HALO_CHORDS[HALO_CHORD_CHART[bar] ?? "F#m9"];
			const lead = leadNotesInBar(bar);
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

	it("gives the listener real breathing room (Kiki: the lead must not play all the time)", () => {
		let lowest = 127;
		let highest = 0;
		let silentBars = 0;
		let playedBars = 0;
		let playedNotes = 0;
		let soundingSteps = 0;
		for (let bar = 0; bar < 48; bar += 1) {
			const notes = leadNotesInBar(bar);
			if (notes.length === 0) {
				silentBars += 1;
				continue;
			}
			playedBars += 1;
			playedNotes += notes.length;
			soundingSteps += notes.reduce((sum, note) => sum + note.duration, 0);
			// Every 2-bar phrase ends with at least 6 steps (~half a bar) of silence
			if (bar % 2 === 1) {
				const lastEnd = Math.max(...notes.map((n) => n.step + n.duration));
				expect(lastEnd, `bar ${bar + 1} needs a real rest`).toBeLessThanOrEqual(
					10
				);
			}
			for (const note of notes) {
				lowest = Math.min(lowest, note.pitch);
				highest = Math.max(highest, note.pitch);
			}
		}
		// The lead is out for at least a quarter of the song …
		expect(silentBars).toBeGreaterThanOrEqual(12);
		// … plays few, long notes when it is in …
		expect(playedNotes / playedBars).toBeLessThanOrEqual(3.5);
		// … and is silent for at least a third of the bars it plays in
		expect(soundingSteps / (playedBars * 16)).toBeLessThanOrEqual(0.67);
		expect(highest - lowest).toBeLessThanOrEqual(12);
		// No echo / drive smearing the rests
		const leadInstrument = channelById("sh-lead").instrument;
		expect(leadInstrument.echoMix).toBeLessThanOrEqual(0.1);
		expect(leadInstrument.drive ?? 0).toBeLessThan(0.05);
	});

	it("repeats one motif: phrase 1 and phrase 2 share the same rhythm", () => {
		const rhythm = (bar: number): string =>
			leadNotesInBar(bar)
				.map((note) => `${note.step}:${note.duration}`)
				.join(",");
		for (const start of [8, 32, 40]) {
			expect(rhythm(start + 2)).toBe(rhythm(start));
			expect(rhythm(start + 4)).toBe(rhythm(start));
			expect(rhythm(start + 3)).toBe(rhythm(start + 1));
		}
	});

	it("vocal chops answer in the gaps and never sing over the lead", () => {
		const chops = channelById("sh-chops");
		for (let bar = 0; bar < 48; bar += 1) {
			const lead = leadNotesInBar(bar);
			for (const chop of notesInBar(chops, bar)) {
				for (const note of lead) {
					const overlaps =
						note.step < chop.step + chop.duration &&
						note.step + note.duration > chop.step;
					expect(overlaps, `bar ${bar + 1} step ${chop.step}`).toBe(false);
				}
			}
		}
	});

	it("keeps accents sparse, slurs only touching notes and keeps the accompaniment below the lead", () => {
		for (const channel of breakcoreShatteredHaloSong.channels) {
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
		// Piano, pad and vocal chops always sit below the lead's lowest note
		const lowestLead = Math.min(
			...Object.values(channelById("sh-lead").patterns).flatMap((pattern) =>
				pattern.notes.map((note) => note.pitch)
			)
		);
		for (const id of ["sh-piano", "sh-pad", "sh-chops"]) {
			for (const pattern of Object.values(channelById(id).patterns)) {
				for (const note of pattern.notes) {
					expect(note.pitch, id).toBeLessThan(lowestLead);
				}
			}
		}
	});
});

import { beforeEach, describe, expect, it } from "vitest";
import { renderSongToMidiBytes } from "../audio/midiExporter";
import { getSongTailSeconds } from "../audio/voiceSynthesizer";
import { DEMO_SONGS, getDemoSongMetadata } from "../constants/demoSongs";
import { INSTRUMENT_PRESETS } from "../constants/instrumentPresets";
import {
	MAIN_MENU_AMBIENCE_SECTIONS,
	MAIN_MENU_CHORD_CHART,
	MAIN_MENU_CHORDS,
	mainMenuAmbienceSong,
} from "../constants/mainMenuAmbienceDemo";
import type { Channel, NoteEvent } from "../types/music";
import { useChiptuneStore } from "../store/useChiptuneStore";

const notesInBar = (channel: Channel, bar: number): Array<NoteEvent> => {
	const patternIndex = channel.barSequence[bar] ?? 0;
	return patternIndex > 0
		? (channel.patterns[String(patternIndex)]?.notes ?? [])
		: [];
};

const channelById = (id: string): Channel => {
	const channel = mainMenuAmbienceSong.channels.find(
		(candidate) => candidate.id === id
	);
	if (!channel) {
		throw new Error(`missing channel ${id}`);
	}
	return channel;
};

/** Lead line of every bar: piano theme, or the violins where they carry it. */
const leadNotesInBar = (bar: number): Array<NoteEvent> => {
	const piano = notesInBar(channelById("mm-piano"), bar);
	if (piano.length > 0) {
		return piano;
	}
	return bar >= 8 && bar <= 23
		? notesInBar(channelById("mm-violins"), bar)
		: [];
};

describe("main menu ambience demo", () => {
	beforeEach(() => {
		useChiptuneStore.getState().createNewProject();
	});

	it("registers the cinematic palette", () => {
		const presets = new Map(INSTRUMENT_PRESETS.map((p) => [p.id, p]));
		expect(presets.get("cinematic-felt-piano")?.configuration.waveform).toBe(
			"piano"
		);
		expect(presets.get("cinematic-strings")?.configuration.waveform).toBe(
			"strings"
		);
		expect(presets.get("cinematic-airy-choir")?.configuration.waveform).toBe(
			"choir"
		);
		expect(presets.get("cinematic-perc-kit")?.category).toBe("drum");
		expect(
			presets.get("cinematic-felt-piano")?.configuration.reverbMix
		).toBeGreaterThan(0.2);
	});

	it("loads as a valid 32-bar, 66 BPM G-major song with four loop sections", () => {
		expect(DEMO_SONGS.some((song) => song.id === mainMenuAmbienceSong.id)).toBe(
			true
		);
		expect(getDemoSongMetadata("demo-main-menu-ambience").category).toBe(
			"ambient"
		);
		useChiptuneStore.getState().loadDemoSong("demo-main-menu-ambience");
		const { song } = useChiptuneStore.getState();
		expect(song.title).toBe("What the Wind Remembers");
		expect(song.bpm).toBe(66);
		expect(song.rootKey).toBe("G");
		expect(song.totalBars).toBe(32);
		expect(song.sections?.map((section) => section.name)).toEqual(
			MAIN_MENU_AMBIENCE_SECTIONS.map((section) => section.name)
		);

		const presetIds = new Set(INSTRUMENT_PRESETS.map((preset) => preset.id));
		const stepsPerBar = song.beatsPerBar * song.stepsPerBeat;
		const ids = new Set<string>();
		for (const channel of song.channels) {
			expect(presetIds.has(channel.instrument.presetId)).toBe(true);
			expect(channel.barSequence).toHaveLength(32);
			for (const pattern of Object.values(channel.patterns)) {
				for (const note of pattern.notes) {
					expect(ids.has(note.id)).toBe(false);
					ids.add(note.id);
					expect(note.step + note.duration).toBeLessThanOrEqual(stepsPerBar);
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
	});

	it("puts chord tones on every strong step of the lead", () => {
		for (let bar = 0; bar < 32; bar += 1) {
			const chord = MAIN_MENU_CHORDS[MAIN_MENU_CHORD_CHART[bar] ?? "Gmaj9"];
			for (const note of leadNotesInBar(bar)) {
				if (note.step % 4 === 0) {
					expect(
						chord.tones.includes(note.pitch % 12),
						`bar ${bar + 1} step ${note.step} pitch ${note.pitch}`
					).toBe(true);
				}
			}
		}
	});

	it("lets every 1-bar lead phrase breathe and keeps a singable range", () => {
		let lowest = 127;
		let highest = 0;
		for (let bar = 0; bar < 32; bar += 1) {
			const notes = leadNotesInBar(bar);
			if (notes.length === 0) {
				continue;
			}
			const lastEnd = Math.max(...notes.map((n) => n.step + n.duration));
			// Breath at the end of every 2-bar phrase (odd bars, 1-indexed even)
			if (bar % 2 === 1) {
				expect(lastEnd, `bar ${bar + 1} needs a breath`).toBeLessThan(16);
			}
			for (const note of notes) {
				lowest = Math.min(lowest, note.pitch);
				highest = Math.max(highest, note.pitch);
			}
		}
		expect(highest - lowest).toBeLessThanOrEqual(16);
	});

	it("only slurs touching notes and keeps the counter-line below the lead", () => {
		for (const channel of mainMenuAmbienceSong.channels) {
			for (const pattern of Object.values(channel.patterns)) {
				for (const note of pattern.notes) {
					if (note.articulation === "legato") {
						const touching = pattern.notes.some(
							(other) =>
								other !== note && other.step + other.duration === note.step
						);
						expect(touching, `${channel.name} legato @${note.step}`).toBe(true);
					}
				}
			}
		}
		const violins = channelById("mm-violins");
		for (let bar = 28; bar <= 31; bar += 1) {
			const lead = leadNotesInBar(bar);
			for (const counterNote of notesInBar(violins, bar)) {
				const sounding = lead.filter(
					(note) =>
						note.step < counterNote.step + counterNote.duration &&
						note.step + note.duration > counterNote.step
				);
				for (const leadNote of sounding) {
					expect(counterNote.pitch).toBeLessThan(leadNote.pitch);
				}
			}
		}
	});

	it("reports a long tail for reverb-heavy songs and exports MIDI", () => {
		expect(getSongTailSeconds(mainMenuAmbienceSong)).toBeGreaterThan(3);
		const bytes = renderSongToMidiBytes(mainMenuAmbienceSong);
		expect(bytes.length).toBeGreaterThan(500);
	});
});

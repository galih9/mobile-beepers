import type { SongProject } from "../types/music";
import { breakcoreBattleV1Song } from "./breakcoreBattleDemo";
import { amenOverdrive180Song } from "./breakcoreDemo";
import { breakcorePetalsSong } from "./breakcorePetalsDemo";
import { breakcoreShatteredHaloSong } from "./breakcoreShatteredHaloDemo";
import { mainMenuAmbienceSong } from "./mainMenuAmbienceDemo";
import { modernAfterglowSong } from "./modernBreakcoreDemo";
import {
	CHANNEL_COLOR_PALETTE,
	createBlankSongProject,
	generateProceduralPatternNotes,
} from "./patternGenerator";

export type DemoSongCategory =
	| "battle"
	| "breakcore"
	| "electronic"
	| "adventure"
	| "dungeon"
	| "ambient";

export interface DemoSongMetadata {
	category: DemoSongCategory;
	badge: string;
	description: string;
	accentColor: string;
	featured?: boolean;
}

export const DEMO_SONG_CATEGORIES: Array<{
	id: "all" | DemoSongCategory;
	label: string;
}> = [
	{ id: "all", label: "All Tracks" },
	{ id: "breakcore", label: "Breakcore & Rave" },
	{ id: "ambient", label: "Ambient & Menu" },
];

export const DEMO_SONG_METADATA: Record<string, DemoSongMetadata> = {
	"demo-modern-afterglow-174": {
		category: "breakcore",
		badge: "Modern · Battle Loop",
		description:
			"174 BPM D-minor breakcore in the modern engine (sewerslvt / hkmori mood): sampled grand-piano hook, pumping dream pad, glass bells, sampled string counter-line, sub → reese bass and programmed jungle / crushed amen breaks. Sections: Glow 1-16, Surge 17-32. No stutters or pitch bends.",
		accentColor: "#a78bfa",
		featured: true,
	},
	"demo-breakcore-battle-v1": {
		category: "breakcore",
		badge: "New · Battle Loop",
		description:
			"Charming 174 BPM A-major breakcore battle loop in three swappable sections (Command 1-16, Clash 17-32, Rush 33-48) over one D-E-C#m-F#m groove: clean singable pulse hook, offbeat stabs, bouncy bass and amen breaks.",
		accentColor: "#f472b6",
		featured: true,
	},
	"demo-breakcore-shattered-halo-175": {
		category: "breakcore",
		badge: "New · Heavy Battle Loop",
		description:
			"Drum-first 175 BPM F#-minor breakcore (sewerslvt / hkmori): crushed heavy breaks with glue compression, a distorted 808 that plays the kicks on the chord roots, chopped slices and 32nd snare rolls, dream-saw melody, bold piano chords, vocal chops and reese. Sections: Halo 1-16, Shatter 17-32, Rapture 33-48.",
		accentColor: "#ef4444",
	},
	"demo-breakcore-petals-172": {
		category: "breakcore",
		badge: "New · Battle Loop",
		description:
			"Emotional 172 BPM G-minor breakcore battle loop (sewerslvt / hkmori vibe) — bold felt-piano hook, long soothing string melody, dream pad and choir over amen breaks and reese bass. No stutters or pitch bends. Three swappable sections: Petals 1-16, Static 17-32, Bloom 33-48.",
		accentColor: "#f9a8d4",
	},
	"demo-main-menu-ambience": {
		category: "ambient",
		badge: "New · Main Menu",
		description:
			"Calm, nostalgic 66 BPM G-major title-screen ambience (Hans Zimmer × open-world dawn): felt piano theme, ensemble strings, airy choir and music box in a hall reverb. Four loopable sections — Dawn 1-8, Memory 9-16, Horizon 17-24 (low-string ostinato + timpani), Homeward 25-32.",
		accentColor: "#fde68a",
	},
	"demo-amen-overdrive-180": {
		category: "breakcore",
		badge: "New · Breakcore",
		description:
			"Frantic 180 BPM E-minor breakcore: chopped amen breaks with stutter rolls and pitched snare risers, distorted reese bass, gabber kicks, glitch arps and an emotional rave-lead hook over a glass pad.",
		accentColor: "#f472b6",
	},
};

const DEFAULT_DEMO_METADATA: DemoSongMetadata = {
	category: "breakcore",
	badge: "Demo Track",
	description: "Built-in offline chiptune demonstration track.",
	accentColor: "#00c7ff",
};

export const getDemoSongMetadata = (demoId: string): DemoSongMetadata => {
	return DEMO_SONG_METADATA[demoId] ?? DEFAULT_DEMO_METADATA;
};

/** Built-in demos. The first one is loaded on a fresh start. */
export const DEMO_SONGS: Array<SongProject> = [
	breakcoreBattleV1Song,
	amenOverdrive180Song,
	breakcorePetalsSong,
	breakcoreShatteredHaloSong,
	mainMenuAmbienceSong,
];

/** Demos for the modern music maker (Settings → Mode → Modern). */
export const MODERN_DEMO_SONGS: Array<SongProject> = [modernAfterglowSong];

/** Every built-in demo, both engines (used to look demos up by id). */
export const ALL_DEMO_SONGS: Array<SongProject> = [
	...MODERN_DEMO_SONGS,
	...DEMO_SONGS,
];

export {
	CHANNEL_COLOR_PALETTE,
	createBlankSongProject,
	generateProceduralPatternNotes,
};

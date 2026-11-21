import type { SongProject } from "../types/music";
import { breakcoreBattleV1Song } from "./breakcoreBattleDemo";
import { amenOverdrive180Song } from "./breakcoreDemo";
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
	| "dungeon";

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
];

export const DEMO_SONG_METADATA: Record<string, DemoSongMetadata> = {
	"demo-breakcore-battle-v1": {
		category: "breakcore",
		badge: "New · Battle Loop",
		description:
			"Charming 174 BPM A-major breakcore battle loop in three swappable sections (Command 1-16, Clash 17-32, Rush 33-48) over one D-E-C#m-F#m groove: clean singable pulse hook, offbeat stabs, bouncy bass and amen breaks.",
		accentColor: "#f472b6",
		featured: true,
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

/** Built-in demos — breakcore only. The first one is loaded on a fresh start. */
export const DEMO_SONGS: Array<SongProject> = [
	breakcoreBattleV1Song,
	amenOverdrive180Song,
];

export {
	CHANNEL_COLOR_PALETTE,
	createBlankSongProject,
	generateProceduralPatternNotes,
};

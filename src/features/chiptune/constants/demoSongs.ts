import type { SongProject } from "../types/music";
import {
	cozyPixelTownSong,
	cyberChaseSong,
	hauntedCryptSong,
	neonHouse125Song,
	overworldQuestSong,
	starlightBossSong,
	sunkenRuinsSong,
} from "./demoTracksExtra";
import { getPresetConfigurationById } from "./instrumentPresets";
import {
	minimalBitHouse124Song,
	pulseFloor132Song,
} from "./minimalHouseDemo";
import {
	CHANNEL_COLOR_PALETTE,
	createBlankSongProject,
	createSongNote,
	generateProceduralPatternNotes,
} from "./patternGenerator";
import { pocketBattle1996Song } from "./pokemonBattleDemo";

export type DemoSongCategory = "battle" | "electronic" | "adventure" | "dungeon";

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
	{ id: "battle", label: "Battle & Action" },
	{ id: "electronic", label: "House & Club" },
	{ id: "adventure", label: "Adventure & Town" },
	{ id: "dungeon", label: "Dungeon & Spooky" },
];

export const DEMO_SONG_METADATA: Record<string, DemoSongMetadata> = {
	"demo-pocket-battle-1996": {
		category: "battle",
		badge: "New · RPG Battle",
		description:
			"Cohesive 168 BPM handheld RPG battle theme built around one singable E-minor melody, warm parallel-3rd harmony, steady 4-chord bass, and a unified 8-bit backbeat.",
		accentColor: "#f43f5e",
		featured: true,
	},
	"demo-minimal-house-124": {
		category: "electronic",
		badge: "Minimal House",
		description:
			"Hypnotic 124 BPM D Dorian 2-chord pulse stab groove with sweeping filters, deep triangle sub-bass, and crisp off-beat noise hats.",
		accentColor: "#00c7ff",
	},
	"demo-pulse-floor-132": {
		category: "electronic",
		badge: "Dance Floor",
		description:
			"High-energy 132 BPM chiptune dance track driven by snappy 12.5% pulse stabs and pumping octave triangle basslines.",
		accentColor: "#38bdf8",
	},
	"demo-house-125": {
		category: "electronic",
		badge: "Club House",
		description:
			"Full 32-bar 90s club house jam featuring supersaw chord stabs, acid 303 arpeggios, and a 909-inspired 8-bit drum kit.",
		accentColor: "#a78bfa",
	},
	"demo-neon-dungeon": {
		category: "dungeon",
		badge: "8-Bit Dungeon",
		description:
			"Classic NES C-minor adventure riff pairing 25% hero pulse melody with rapid 12.5% dungeon arpeggios and punchy triangle bass.",
		accentColor: "#22d3ee",
	},
	"demo-starlight-boss": {
		category: "battle",
		badge: "Boss Rush",
		description:
			"Fierce 158 BPM E Harmonic Minor boss showdown driven by aggressive VRC6 sawtooth leads and relentless octave synth bass.",
		accentColor: "#fb7185",
	},
	"demo-cyber-chase": {
		category: "battle",
		badge: "High-Speed",
		description:
			"Blistering 164 BPM sci-fi pursuit theme with rapid 16th-note cyber arps, hyper sawtooth leads, and arcade drum fills.",
		accentColor: "#f59e0b",
	},
	"demo-cozy-town": {
		category: "adventure",
		badge: "Cozy Town",
		description:
			"Warm 112 BPM swung G-major village theme blending shimmering 16-bit FM chimes with hollow Game Boy square harmony.",
		accentColor: "#34d399",
	},
	"demo-overworld-quest": {
		category: "adventure",
		badge: "Overworld",
		description:
			"Upbeat 148 BPM 1985-era overworld march with heroic leaping pulse melodies, bouncing basslines, and playful coin fills.",
		accentColor: "#4ade80",
	},
	"demo-sunken-ruins": {
		category: "adventure",
		badge: "Underwater",
		description:
			"Dreamy 108 BPM aquatic exploration theme with crystal FM bells, echoed square pads, and deep ocean triangle bass.",
		accentColor: "#60a5fa",
	},
	"demo-haunted-crypt": {
		category: "dungeon",
		badge: "Gothic Crypt",
		description:
			"Dramatic 132 BPM A Harmonic Minor castle theme with gothic sawtooth leads, eerie arpeggios, and creeping bass.",
		accentColor: "#c084fc",
	},
};

const DEFAULT_DEMO_METADATA: DemoSongMetadata = {
	category: "adventure",
	badge: "Demo Track",
	description: "Built-in offline chiptune demonstration track.",
	accentColor: "#00c7ff",
};

export const getDemoSongMetadata = (demoId: string): DemoSongMetadata => {
	return DEMO_SONG_METADATA[demoId] ?? DEFAULT_DEMO_METADATA;
};

const neonDungeonSong: SongProject = {
	id: "demo-neon-dungeon",
	title: "Neon Dungeon 1989",
	author: "UltraBeep Demo",
	bpm: 138,
	beatsPerBar: 4,
	stepsPerBeat: 4,
	totalBars: 12,
	loopStartBar: 0,
	loopEndBar: 7,
	swing: 0.08,
	rootKey: "C",
	scale: "minor",
	masterVolume: 0.85,
	updatedAt: 1700000000000,
	channels: [
		{
			id: "nd-lead",
			name: "Hero Pulse",
			type: "pitch",
			color: "#00c7ff",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("nes-pulse-25").configuration,
			},
			barSequence: [1, 2, 1, 3, 1, 2, 3, 4, 0, 0, 0, 0],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSongNote(0, 60, 2),
						createSongNote(3, 63, 2),
						createSongNote(6, 67, 2),
						createSongNote(8, 72, 2),
						createSongNote(11, 70, 2),
						createSongNote(14, 67, 2),
					],
				},
				"2": {
					index: 2,
					notes: [
						createSongNote(0, 68, 2),
						createSongNote(2, 67, 2),
						createSongNote(4, 63, 2),
						createSongNote(6, 65, 2),
						createSongNote(8, 67, 4),
						createSongNote(12, 63, 2),
						createSongNote(14, 62, 2),
					],
				},
				"3": {
					index: 3,
					notes: [
						createSongNote(0, 72, 2),
						createSongNote(2, 74, 2),
						createSongNote(4, 75, 2, 2),
						createSongNote(8, 72, 2),
						createSongNote(10, 70, 2),
						createSongNote(12, 67, 4),
					],
				},
				"4": {
					index: 4,
					notes: [
						createSongNote(0, 75, 2),
						createSongNote(2, 74, 2),
						createSongNote(4, 72, 2),
						createSongNote(6, 70, 2),
						createSongNote(8, 67, 2),
						createSongNote(10, 63, 2),
						createSongNote(12, 60, 4, -12),
					],
				},
			},
		},
		{
			id: "nd-arp",
			name: "Dungeon Arp",
			type: "pitch",
			color: "#ffd93d",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("nes-pulse-12").configuration,
			},
			barSequence: [1, 2, 1, 2, 3, 2, 3, 1, 0, 0, 0, 0],
			patterns: {
				"1": {
					index: 1,
					notes: [createSongNote(0, 60, 8), createSongNote(8, 63, 8)],
				},
				"2": {
					index: 2,
					notes: [createSongNote(0, 56, 8), createSongNote(8, 58, 8)],
				},
				"3": {
					index: 3,
					notes: [createSongNote(0, 65, 8), createSongNote(8, 67, 8)],
				},
			},
		},
		{
			id: "nd-bass",
			name: "Triangle Bass",
			type: "pitch",
			color: "#ff9233",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("nes-triangle-bass").configuration,
			},
			barSequence: [1, 2, 1, 2, 1, 2, 3, 1, 0, 0, 0, 0],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSongNote(0, 36, 2),
						createSongNote(4, 36, 2),
						createSongNote(6, 48, 1),
						createSongNote(8, 36, 2),
						createSongNote(12, 39, 2),
						createSongNote(14, 43, 2),
					],
				},
				"2": {
					index: 2,
					notes: [
						createSongNote(0, 44, 2),
						createSongNote(4, 44, 2),
						createSongNote(8, 46, 2),
						createSongNote(12, 43, 2),
						createSongNote(14, 39, 2),
					],
				},
				"3": {
					index: 3,
					notes: [
						createSongNote(0, 41, 2),
						createSongNote(4, 41, 2),
						createSongNote(8, 43, 2),
						createSongNote(12, 43, 2),
						createSongNote(14, 47, 2),
					],
				},
			},
		},
		{
			id: "nd-drums",
			name: "8-Bit Kit",
			type: "drum",
			color: "#b366ff",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("retro-8bit-kit").configuration,
			},
			barSequence: [1, 1, 1, 2, 1, 1, 1, 2, 0, 0, 0, 0],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSongNote(0, 0, 1),
						createSongNote(2, 2, 1),
						createSongNote(4, 1, 1),
						createSongNote(6, 2, 1),
						createSongNote(8, 0, 1),
						createSongNote(10, 0, 1),
						createSongNote(12, 1, 1),
						createSongNote(14, 3, 1),
					],
				},
				"2": {
					index: 2,
					notes: [
						createSongNote(0, 0, 1),
						createSongNote(2, 2, 1),
						createSongNote(4, 1, 1),
						createSongNote(6, 2, 1),
						createSongNote(8, 0, 1),
						createSongNote(10, 5, 1),
						createSongNote(12, 1, 1),
						createSongNote(13, 1, 1),
						createSongNote(14, 4, 1),
						createSongNote(15, 7, 1),
					],
				},
			},
		},
	],
};

export const DEMO_SONGS: Array<SongProject> = [
	pocketBattle1996Song,
	minimalBitHouse124Song,
	pulseFloor132Song,
	neonHouse125Song,
	neonDungeonSong,
	starlightBossSong,
	cozyPixelTownSong,
	overworldQuestSong,
	cyberChaseSong,
	sunkenRuinsSong,
	hauntedCryptSong,
];

export {
	CHANNEL_COLOR_PALETTE,
	createBlankSongProject,
	generateProceduralPatternNotes,
};

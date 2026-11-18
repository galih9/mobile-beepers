import type { SongProject } from "../types/music";
import {
	cozyPixelTownSong,
	neonHouse125Song,
	starlightBossSong,
} from "./demoTracksExtra";
import { getPresetConfigurationById } from "./instrumentPresets";
import {
	CHANNEL_COLOR_PALETTE,
	createBlankSongProject,
	createSongNote,
	generateProceduralPatternNotes,
} from "./patternGenerator";

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
	neonHouse125Song,
	neonDungeonSong,
	starlightBossSong,
	cozyPixelTownSong,
];

export {
	CHANNEL_COLOR_PALETTE,
	createBlankSongProject,
	generateProceduralPatternNotes,
};

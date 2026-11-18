import type { SongProject } from "../types/music";
import { getPresetConfigurationById } from "./instrumentPresets";
import { createSongNote } from "./patternGenerator";

export const starlightBossSong: SongProject = {
	id: "demo-starlight-boss",
	title: "Starlight Boss Rush",
	author: "UltraBeep Demo",
	bpm: 158,
	beatsPerBar: 4,
	stepsPerBeat: 4,
	totalBars: 12,
	loopStartBar: 0,
	loopEndBar: 7,
	swing: 0,
	rootKey: "E",
	scale: "harmonicMinor",
	masterVolume: 0.85,
	updatedAt: 1700000001000,
	channels: [
		{
			id: "sb-lead",
			name: "VRC6 Lead",
			type: "pitch",
			color: "#00c7ff",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("vrc6-saw-lead").configuration,
			},
			barSequence: [1, 2, 1, 3, 1, 2, 3, 2, 0, 0, 0, 0],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSongNote(0, 64, 2),
						createSongNote(2, 71, 2),
						createSongNote(4, 72, 2),
						createSongNote(6, 71, 2),
						createSongNote(8, 69, 2),
						createSongNote(10, 67, 2),
						createSongNote(12, 66, 2),
						createSongNote(14, 63, 2),
					],
				},
				"2": {
					index: 2,
					notes: [
						createSongNote(0, 64, 3),
						createSongNote(3, 67, 1),
						createSongNote(4, 71, 4),
						createSongNote(8, 76, 2),
						createSongNote(10, 75, 2),
						createSongNote(12, 72, 2),
						createSongNote(14, 71, 2),
					],
				},
				"3": {
					index: 3,
					notes: [
						createSongNote(0, 76, 2),
						createSongNote(2, 74, 2),
						createSongNote(4, 72, 2),
						createSongNote(6, 71, 2),
						createSongNote(8, 69, 2),
						createSongNote(10, 67, 2),
						createSongNote(12, 75, 4, 5),
					],
				},
			},
		},
		{
			id: "sb-bass",
			name: "Octave Bass",
			type: "pitch",
			color: "#ff9233",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("arcade-octave-bass").configuration,
			},
			barSequence: [1, 1, 2, 2, 1, 1, 2, 2, 0, 0, 0, 0],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSongNote(0, 40, 2),
						createSongNote(4, 40, 2),
						createSongNote(8, 43, 2),
						createSongNote(12, 47, 2),
					],
				},
				"2": {
					index: 2,
					notes: [
						createSongNote(0, 48, 2),
						createSongNote(4, 47, 2),
						createSongNote(8, 45, 2),
						createSongNote(12, 39, 2),
					],
				},
			},
		},
		{
			id: "sb-drums",
			name: "Rush Kit",
			type: "drum",
			color: "#b366ff",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("retro-8bit-kit").configuration,
			},
			barSequence: [1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSongNote(0, 0, 1),
						createSongNote(2, 2, 1),
						createSongNote(4, 1, 1),
						createSongNote(6, 0, 1),
						createSongNote(8, 0, 1),
						createSongNote(10, 2, 1),
						createSongNote(12, 1, 1),
						createSongNote(14, 6, 1),
					],
				},
			},
		},
	],
};

export const cozyPixelTownSong: SongProject = {
	id: "demo-cozy-town",
	title: "Cozy Pixel Town",
	author: "UltraBeep Demo",
	bpm: 112,
	beatsPerBar: 4,
	stepsPerBeat: 4,
	totalBars: 12,
	loopStartBar: 0,
	loopEndBar: 7,
	swing: 0.14,
	rootKey: "G",
	scale: "pentatonicMajor",
	masterVolume: 0.85,
	updatedAt: 1700000002000,
	channels: [
		{
			id: "ct-bell",
			name: "FM Chime",
			type: "pitch",
			color: "#00c7ff",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("genesis-fm-bell").configuration,
			},
			barSequence: [1, 2, 1, 2, 1, 2, 1, 2, 0, 0, 0, 0],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSongNote(0, 67, 2),
						createSongNote(4, 71, 2),
						createSongNote(8, 74, 4),
						createSongNote(12, 71, 2),
						createSongNote(14, 69, 2),
					],
				},
				"2": {
					index: 2,
					notes: [
						createSongNote(0, 67, 2),
						createSongNote(4, 69, 2),
						createSongNote(8, 71, 4),
						createSongNote(12, 67, 4),
					],
				},
			},
		},
		{
			id: "ct-pad",
			name: "GameBoy Square",
			type: "pitch",
			color: "#ffd93d",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("gb-square-50").configuration,
			},
			barSequence: [1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
			patterns: {
				"1": {
					index: 1,
					notes: [createSongNote(0, 55, 6), createSongNote(8, 59, 6)],
				},
			},
		},
		{
			id: "ct-bass",
			name: "Warm Bass",
			type: "pitch",
			color: "#ff9233",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("nes-triangle-bass").configuration,
			},
			barSequence: [1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSongNote(0, 43, 4),
						createSongNote(8, 40, 4),
						createSongNote(12, 42, 4),
					],
				},
			},
		},
		{
			id: "ct-drums",
			name: "Soft Kit",
			type: "drum",
			color: "#b366ff",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("retro-8bit-kit").configuration,
			},
			barSequence: [1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSongNote(0, 0, 1, 0, 0.7),
						createSongNote(4, 2, 1, 0, 0.45),
						createSongNote(8, 0, 1, 0, 0.65),
						createSongNote(12, 6, 1, 0, 0.5),
					],
				},
			},
		},
	],
};

import type { NoteEvent, NoteFadeMode, SongProject } from "../types/music";
import { getPresetConfigurationById } from "./instrumentPresets";
import { createSongNote } from "./patternGenerator";

const CHORD_DM9: Array<number> = [57, 60, 64]; // A3, C4, E4 (Dm9 upper voicing)
const CHORD_EM7: Array<number> = [55, 59, 62]; // G3, B3, D4 (Em7 / G6 voicing)
const CHORD_FM: Array<number> = [56, 60, 65]; // Ab3, C4, F4 (Fm 1st inversion)
const CHORD_EB: Array<number> = [55, 58, 63]; // G3, Bb3, Eb4 (Eb 1st inversion)

const createFilteredNote = (
	step: number,
	pitch: number,
	duration: number,
	velocity: number,
	filterCutoff?: number,
	filterSweepTo?: number,
	fadeMode?: NoteFadeMode
): NoteEvent => ({
	...createSongNote(step, pitch, duration, 0, velocity),
	...(filterCutoff !== undefined ? { filterCutoff } : {}),
	...(filterSweepTo !== undefined ? { filterSweepTo } : {}),
	...(fadeMode ? { fadeMode } : {}),
});

const createChordStab = (
	step: number,
	pitches: Array<number>,
	duration: number,
	velocity: number,
	filterCutoff: number,
	filterSweepTo: number,
	fadeMode?: NoteFadeMode
): Array<NoteEvent> =>
	pitches.map((pitch) =>
		createFilteredNote(
			step,
			pitch,
			duration,
			velocity,
			filterCutoff,
			filterSweepTo,
			fadeMode
		)
	);

export const minimalBitHouse124Song: SongProject = {
	id: "demo-minimal-house-124",
	title: "Minimal Bit House 124",
	author: "UltraBeep Demo",
	bpm: 124,
	beatsPerBar: 4,
	stepsPerBeat: 4,
	totalBars: 32,
	loopStartBar: 0,
	loopEndBar: 31,
	swing: 0.1,
	rootKey: "D",
	scale: "dorian",
	masterVolume: 0.86,
	updatedAt: 1700000010000,
	channels: [
		{
			id: "mbh-stab",
			name: "2-Chord Pulse Stab",
			type: "pitch",
			color: "#00c7ff",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("minimal-house-stab").configuration,
			},
			// Sparse opening hit -> negative space -> gradual filter opening -> breakdown -> sweep -> drop -> strip-back
			barSequence: [
				1, 0, 0, 0, 1, 2, 1, 2, 3, 4, 3, 4, 5, 6, 5, 6, 1, 2, 3, 4, 7, 7, 5, 6,
				5, 6, 3, 4, 1, 2, 0, 0,
			],
			patterns: {
				"1": {
					index: 1,
					notes: [
						...createChordStab(3, CHORD_DM9, 2, 0.68, 1150, 720),
						...createChordStab(10, CHORD_DM9, 1, 0.6, 1050, 680),
					],
				},
				"2": {
					index: 2,
					notes: [...createChordStab(6, CHORD_EM7, 2, 0.66, 1100, 700)],
				},
				"3": {
					index: 3,
					notes: [
						...createChordStab(3, CHORD_DM9, 2, 0.78, 2200, 1300),
						...createChordStab(10, CHORD_DM9, 1, 0.7, 2000, 1200),
					],
				},
				"4": {
					index: 4,
					notes: [...createChordStab(6, CHORD_EM7, 2, 0.76, 2050, 1250)],
				},
				"5": {
					index: 5,
					notes: [
						...createChordStab(3, CHORD_DM9, 2, 0.86, 4200, 2100),
						...createChordStab(10, CHORD_DM9, 1, 0.78, 3900, 1950),
						...createChordStab(14, CHORD_DM9, 1, 0.5, 2800, 1500),
					],
				},
				"6": {
					index: 6,
					notes: [
						...createChordStab(6, CHORD_EM7, 2, 0.84, 3900, 1950),
						...createChordStab(14, CHORD_DM9, 1, 0.52, 2600, 1400),
					],
				},
				"7": {
					index: 7,
					notes: [
						...createChordStab(0, CHORD_DM9, 6, 0.72, 620, 2600, "fadeIn"),
						...createChordStab(8, CHORD_EM7, 8, 0.84, 1200, 4800, "fadeIn"),
					],
				},
			},
		},
		{
			id: "mbh-bass",
			name: "Triangle Sub Bass",
			type: "pitch",
			color: "#ff9233",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("minimal-house-bass").configuration,
			},
			barSequence: [
				0, 0, 0, 0, 3, 3, 1, 2, 1, 2, 1, 2, 4, 2, 4, 2, 0, 0, 3, 3, 1, 2, 4, 2,
				4, 2, 1, 2, 3, 3, 0, 0,
			],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createFilteredNote(0, 38, 2, 0.86, 1350),
						createFilteredNote(3, 38, 2, 0.78, 1300),
						createFilteredNote(6, 41, 2, 0.88, 1450),
						createFilteredNote(10, 45, 2, 0.84, 1500),
						createFilteredNote(14, 48, 2, 0.82, 1550),
					],
				},
				"2": {
					index: 2,
					notes: [
						createFilteredNote(0, 38, 2, 0.86, 1350),
						createFilteredNote(6, 43, 2, 0.86, 1450),
						createFilteredNote(10, 40, 2, 0.82, 1400),
						createFilteredNote(12, 43, 1, 0.74, 1450),
						createFilteredNote(14, 45, 2, 0.86, 1500),
					],
				},
				"3": {
					index: 3,
					notes: [
						createFilteredNote(0, 38, 2, 0.82, 680),
						createFilteredNote(6, 41, 2, 0.78, 700),
						createFilteredNote(10, 45, 2, 0.76, 740),
					],
				},
				"4": {
					index: 4,
					notes: [
						createFilteredNote(0, 38, 2, 0.88, 1750),
						createFilteredNote(3, 50, 1, 0.76, 1950),
						createFilteredNote(6, 41, 2, 0.9, 1750),
						createFilteredNote(10, 45, 2, 0.86, 1800),
						createFilteredNote(14, 48, 1, 0.84, 1950),
						createFilteredNote(15, 45, 1, 0.72, 1750),
					],
				},
			},
		},
		{
			id: "mbh-kick",
			name: "Pulse/Noise Kick",
			type: "drum",
			color: "#b366ff",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("minimal-house-kick").configuration,
			},
			barSequence: [
				2, 2, 1, 1, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 1, 3, 0, 0, 0, 0, 2, 3, 1, 1,
				1, 4, 1, 1, 1, 1, 2, 3,
			],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSongNote(0, 0, 1, 0, 0.98),
						createSongNote(4, 0, 1, 0, 0.92),
						createSongNote(8, 0, 1, 0, 0.96),
						createSongNote(12, 0, 1, 0, 0.93),
					],
				},
				"2": {
					index: 2,
					notes: [
						createFilteredNote(0, 0, 1, 0.9, 320),
						createFilteredNote(4, 0, 1, 0.86, 340),
						createFilteredNote(8, 0, 1, 0.9, 360),
						createFilteredNote(12, 0, 1, 0.88, 390),
					],
				},
				"3": {
					index: 3,
					notes: [
						createSongNote(0, 0, 1, 0, 0.98),
						createSongNote(4, 0, 1, 0, 0.92),
						createSongNote(8, 0, 1, 0, 0.95),
					],
				},
				"4": {
					index: 4,
					notes: [
						createSongNote(0, 0, 1, 0, 0.98),
						createSongNote(4, 0, 1, 0, 0.92),
						createSongNote(8, 0, 1, 0, 0.96),
						createSongNote(12, 0, 1, 0, 0.94),
						createSongNote(15, 0, 1, 0, 0.56),
					],
				},
			},
		},
		{
			id: "mbh-hats",
			name: "Off-Beat Noise Hats",
			type: "drum",
			color: "#34d399",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("minimal-house-hats").configuration,
			},
			barSequence: [
				0, 0, 1, 1, 1, 1, 4, 4, 2, 2, 2, 2, 3, 3, 3, 2, 0, 0, 1, 4, 4, 0, 3, 3,
				3, 3, 2, 2, 1, 1, 1, 0,
			],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createFilteredNote(2, 2, 1, 0.68, 5400),
						createFilteredNote(6, 2, 1, 0.64, 5400),
						createFilteredNote(10, 2, 1, 0.7, 5600),
						createFilteredNote(14, 2, 1, 0.66, 5600),
					],
				},
				"2": {
					index: 2,
					notes: [
						createSongNote(2, 3, 1, 0, 0.8),
						createSongNote(6, 3, 1, 0, 0.76),
						createSongNote(10, 3, 1, 0, 0.82),
						createSongNote(14, 3, 1, 0, 0.78),
					],
				},
				"3": {
					index: 3,
					notes: [
						createSongNote(2, 3, 1, 0, 0.82),
						createSongNote(6, 3, 1, 0, 0.78),
						createSongNote(7, 2, 1, 0, 0.34),
						createSongNote(10, 3, 1, 0, 0.84),
						createSongNote(14, 3, 1, 0, 0.8),
						createSongNote(15, 2, 1, 0, 0.36),
					],
				},
				"4": {
					index: 4,
					notes: [
						createFilteredNote(2, 2, 1, 0.62, 4200),
						createFilteredNote(6, 2, 1, 0.7, 5800),
						createFilteredNote(10, 2, 1, 0.78, 7600),
						createFilteredNote(14, 3, 1, 0.82, 9800),
					],
				},
			},
		},
	],
};

export const pulseFloor132Song: SongProject = {
	id: "demo-pulse-floor-132",
	title: "Pulse Floor 132",
	author: "UltraBeep Demo",
	bpm: 132,
	beatsPerBar: 4,
	stepsPerBeat: 4,
	totalBars: 32,
	loopStartBar: 0,
	loopEndBar: 31,
	swing: 0.06,
	rootKey: "F",
	scale: "minor",
	masterVolume: 0.86,
	updatedAt: 1700000011000,
	channels: [
		{
			id: "pf-stab",
			name: "2-Chord Dance Stab",
			type: "pitch",
			color: "#00c7ff",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("retro-dance-stab").configuration,
			},
			barSequence: [
				1, 0, 0, 0, 1, 2, 3, 4, 3, 4, 3, 4, 5, 6, 5, 6, 1, 2, 3, 4, 7, 7, 5, 6,
				5, 6, 5, 6, 3, 4, 1, 0,
			],
			patterns: {
				"1": {
					index: 1,
					notes: [
						...createChordStab(0, CHORD_FM, 1, 0.72, 1250, 780),
						...createChordStab(3, CHORD_FM, 2, 0.74, 1300, 800),
						...createChordStab(6, CHORD_FM, 1, 0.66, 1180, 740),
						...createChordStab(14, CHORD_EB, 2, 0.7, 1220, 760),
					],
				},
				"2": {
					index: 2,
					notes: [
						...createChordStab(2, CHORD_EB, 2, 0.72, 1240, 780),
						...createChordStab(10, CHORD_FM, 1, 0.66, 1180, 740),
						...createChordStab(12, CHORD_EB, 2, 0.7, 1260, 780),
					],
				},
				"3": {
					index: 3,
					notes: [
						...createChordStab(0, CHORD_FM, 1, 0.82, 2800, 1500),
						...createChordStab(3, CHORD_FM, 2, 0.84, 3000, 1550),
						...createChordStab(6, CHORD_FM, 1, 0.76, 2650, 1400),
						...createChordStab(14, CHORD_EB, 2, 0.8, 2850, 1500),
					],
				},
				"4": {
					index: 4,
					notes: [
						...createChordStab(2, CHORD_EB, 2, 0.82, 2800, 1500),
						...createChordStab(10, CHORD_FM, 1, 0.76, 2600, 1400),
						...createChordStab(12, CHORD_EB, 2, 0.8, 2900, 1550),
					],
				},
				"5": {
					index: 5,
					notes: [
						...createChordStab(0, CHORD_FM, 1, 0.9, 6200, 2600),
						...createChordStab(3, CHORD_FM, 2, 0.92, 6600, 2800),
						...createChordStab(6, CHORD_FM, 1, 0.84, 5600, 2400),
						...createChordStab(14, CHORD_EB, 2, 0.88, 6000, 2500),
					],
				},
				"6": {
					index: 6,
					notes: [
						...createChordStab(2, CHORD_EB, 2, 0.9, 6200, 2600),
						...createChordStab(10, CHORD_FM, 1, 0.84, 5600, 2400),
						...createChordStab(12, CHORD_EB, 2, 0.88, 6400, 2700),
					],
				},
				"7": {
					index: 7,
					notes: [
						...createChordStab(0, CHORD_FM, 1, 0.66, 680, 920),
						...createChordStab(2, CHORD_FM, 1, 0.7, 1100, 1450),
						...createChordStab(4, CHORD_FM, 1, 0.74, 1650, 2100),
						...createChordStab(6, CHORD_FM, 1, 0.78, 2300, 2850),
						...createChordStab(8, CHORD_EB, 1, 0.82, 3100, 3800),
						...createChordStab(10, CHORD_EB, 1, 0.86, 4100, 4900),
						...createChordStab(12, CHORD_EB, 1, 0.9, 5200, 6200),
						...createChordStab(14, CHORD_EB, 2, 0.94, 6000, 7400, "fadeIn"),
					],
				},
			},
		},
		{
			id: "pf-bass",
			name: "Octave Triangle Bass",
			type: "pitch",
			color: "#ff9233",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("dance-triangle-bass").configuration,
			},
			barSequence: [
				0, 0, 0, 0, 3, 3, 1, 2, 1, 2, 1, 2, 4, 2, 4, 2, 0, 0, 3, 3, 1, 2, 4, 2,
				4, 2, 4, 2, 1, 2, 0, 0,
			],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createFilteredNote(2, 41, 2, 0.9, 1750),
						createFilteredNote(6, 53, 2, 0.86, 1950),
						createFilteredNote(10, 41, 2, 0.9, 1750),
						createFilteredNote(14, 44, 1, 0.84, 1850),
						createFilteredNote(15, 48, 1, 0.82, 1950),
					],
				},
				"2": {
					index: 2,
					notes: [
						createFilteredNote(2, 39, 2, 0.9, 1750),
						createFilteredNote(6, 51, 2, 0.86, 1950),
						createFilteredNote(10, 36, 2, 0.88, 1700),
						createFilteredNote(14, 39, 2, 0.86, 1850),
					],
				},
				"3": {
					index: 3,
					notes: [
						createFilteredNote(2, 41, 2, 0.82, 740),
						createFilteredNote(10, 48, 2, 0.78, 820),
					],
				},
				"4": {
					index: 4,
					notes: [
						createFilteredNote(2, 41, 1, 0.92, 2200),
						createFilteredNote(3, 53, 1, 0.78, 2400),
						createFilteredNote(6, 41, 2, 0.92, 2200),
						createFilteredNote(10, 44, 1, 0.9, 2300),
						createFilteredNote(11, 48, 1, 0.8, 2400),
						createFilteredNote(14, 51, 2, 0.88, 2500),
					],
				},
			},
		},
		{
			id: "pf-kick",
			name: "Pulse/Noise Kick",
			type: "drum",
			color: "#b366ff",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("minimal-house-kick").configuration,
			},
			barSequence: [
				2, 2, 1, 4, 1, 1, 1, 4, 1, 1, 1, 4, 1, 1, 1, 3, 0, 0, 0, 0, 2, 5, 1, 1,
				1, 4, 1, 1, 1, 1, 2, 3,
			],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSongNote(0, 0, 1, 0, 0.98),
						createSongNote(4, 0, 1, 0, 0.94),
						createSongNote(8, 0, 1, 0, 0.98),
						createSongNote(12, 0, 1, 0, 0.95),
					],
				},
				"2": {
					index: 2,
					notes: [
						createFilteredNote(0, 0, 1, 0.9, 340),
						createFilteredNote(4, 0, 1, 0.88, 370),
						createFilteredNote(8, 0, 1, 0.92, 410),
						createFilteredNote(12, 0, 1, 0.9, 460),
					],
				},
				"3": {
					index: 3,
					notes: [
						createSongNote(0, 0, 1, 0, 0.98),
						createSongNote(4, 0, 1, 0, 0.94),
						createSongNote(8, 0, 1, 0, 0.96),
					],
				},
				"4": {
					index: 4,
					notes: [
						createSongNote(0, 0, 1, 0, 0.98),
						createSongNote(4, 0, 1, 0, 0.94),
						createSongNote(8, 0, 1, 0, 0.98),
						createSongNote(12, 0, 1, 0, 0.95),
						createSongNote(14, 0, 1, 0, 0.62),
					],
				},
				"5": {
					index: 5,
					notes: [
						createFilteredNote(0, 0, 1, 0.88, 420),
						createFilteredNote(2, 0, 1, 0.82, 520),
						createFilteredNote(4, 0, 1, 0.9, 680),
						createFilteredNote(6, 0, 1, 0.84, 860),
						createFilteredNote(8, 0, 1, 0.94, 1100),
						createFilteredNote(10, 0, 1, 0.88, 1400),
						createFilteredNote(12, 0, 1, 0.96, 1800),
					],
				},
			},
		},
		{
			id: "pf-hats",
			name: "Off-Beat Noise Hats",
			type: "drum",
			color: "#34d399",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("minimal-house-hats").configuration,
			},
			barSequence: [
				0, 0, 1, 4, 1, 1, 4, 4, 2, 2, 2, 2, 3, 3, 3, 2, 0, 0, 1, 4, 4, 0, 3, 3,
				3, 3, 3, 3, 2, 2, 1, 0,
			],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createFilteredNote(2, 2, 1, 0.72, 5200),
						createFilteredNote(6, 2, 1, 0.68, 5200),
						createFilteredNote(10, 2, 1, 0.74, 5600),
						createFilteredNote(14, 2, 1, 0.7, 5600),
					],
				},
				"2": {
					index: 2,
					notes: [
						createSongNote(2, 3, 1, 0, 0.84),
						createSongNote(6, 3, 1, 0, 0.8),
						createSongNote(10, 3, 1, 0, 0.86),
						createSongNote(14, 3, 1, 0, 0.82),
					],
				},
				"3": {
					index: 3,
					notes: [
						createSongNote(2, 3, 1, 0, 0.86),
						createSongNote(3, 2, 1, 0, 0.4),
						createSongNote(6, 3, 1, 0, 0.82),
						createSongNote(7, 2, 1, 0, 0.38),
						createSongNote(10, 3, 1, 0, 0.88),
						createSongNote(11, 2, 1, 0, 0.4),
						createSongNote(14, 3, 1, 0, 0.84),
						createSongNote(15, 2, 1, 0, 0.42),
					],
				},
				"4": {
					index: 4,
					notes: [
						createFilteredNote(2, 2, 1, 0.66, 4000),
						createFilteredNote(6, 2, 1, 0.74, 5800),
						createFilteredNote(10, 2, 1, 0.82, 7800),
						createFilteredNote(14, 3, 1, 0.88, 10500),
					],
				},
			},
		},
	],
};

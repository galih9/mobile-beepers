import type { NoteEvent, SongProject } from "../types/music";
import { getPresetConfigurationById } from "./instrumentPresets";
import { createSongNote } from "./patternGenerator";

// MIDI pitches in E Natural Minor (E, F#, G, A, B, C, D) — all within [36, 84]
const N = {
	E2: 40,
	Fs2: 42,
	G2: 43,
	A2: 45,
	B2: 47,
	C3: 48,
	D3: 50,
	E3: 52,
	Fs3: 54,
	G3: 55,
	A3: 57,
	B3: 59,
	C4: 60,
	D4: 62,
	E4: 64,
	Fs4: 66,
	G4: 67,
	A4: 69,
	B4: 71,
	C5: 72,
	D5: 74,
	E5: 76,
	Fs5: 78,
	G5: 79,
	A5: 81,
	B5: 83,
} as const;

/**
 * Steady quarter-note bassline (Root - Root - Root - Fifth).
 * At 168 BPM this locks cleanly with the kick/snare backbeat with zero low-end mud.
 */
const createSteadyBassBar = (
	root: number,
	fifth: number
): Array<NoteEvent> => [
	createSongNote(0, root, 4, 0, 0.92),
	createSongNote(4, root, 4, 0, 0.84),
	createSongNote(8, root, 4, 0, 0.9),
	createSongNote(12, fifth, 4, 0, 0.82),
];

/**
 * Gentle quarter-note broken triad (Root - 3rd - 5th - 3rd) sitting softly
 * in the midrange underneath the melody and harmony.
 */
const createQuarterTriadBar = (
	root: number,
	third: number,
	fifth: number,
	velocity = 0.62
): Array<NoteEvent> => [
	createSongNote(0, root, 2, 0, velocity * 0.95),
	createSongNote(4, third, 2, 0, velocity * 0.9),
	createSongNote(8, fifth, 2, 0, velocity),
	createSongNote(12, third, 2, 0, velocity * 0.9),
];

/**
 * Pocket Battle 1996 — 168 BPM cohesive handheld RPG battle theme built around
 * ONE singable 8-bar melody and ONE unified 4-chord palette (Em - C - G - D).
 *
 * Song form (A - A' - B - A'', 4 x 8 bars = 32 bars, ~45.7s loop):
 * - Bars  1-8:  Theme A (Solo)       Em | C | G | D  ->  Em | C | D | Em
 *               Pure trio (Lead + Bass + Beat) so the main melody locks in immediately.
 * - Bars  9-16: Theme A' (Full)      EXACT same 8-bar melody, now harmonized in warm
 *               parallel 3rds with a gentle quarter-note triad pulse underneath.
 * - Bars 17-24: Section B (Lift)     C | D | Em | Em  ->  C | D | Em | D
 *               One simple climbing motif built from the same rhythmic cell, played twice.
 * - Bars 25-32: Theme A'' (Return)   EXACT same 8-bar melody returns, stripping back for
 *               two intimate bars (25-26) before blooming back to full harmony.
 */
export const pocketBattle1996Song: SongProject = {
	id: "demo-pocket-battle-1996",
	title: "Pocket Battle 1996",
	author: "UltraBeep Demo",
	bpm: 168,
	beatsPerBar: 4,
	stepsPerBeat: 4,
	totalBars: 32,
	loopStartBar: 0,
	loopEndBar: 31,
	swing: 0,
	rootKey: "E",
	scale: "minor",
	masterVolume: 0.85,
	updatedAt: 1700000012000,
	channels: [
		// 1. Primary 25% Pulse Lead — ONE memorable melody with real rhyme & repetition
		{
			id: "pb-lead",
			name: "Battle Pulse 1",
			type: "pitch",
			color: "#00c7ff",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("nes-pulse-25").configuration,
				volume: 0.72,
				pan: -0.04,
				attack: 0.006,
				decay: 0.14,
				sustain: 0.72,
				release: 0.065,
				filterCutoff: 5200,
				vibratoDepth: 6,
				vibratoSpeed: 5.4,
				arpMode: "none",
				echoMix: 0.06,
				echoTimeSeconds: 0.357,
				detuneCents: 0,
			},
			// A (1..6) -> A' (1..6) -> B (7..10, ends on 4) -> A'' (1..6)
			barSequence: [
				1, 2, 3, 4, 1, 2, 5, 6, 1, 2, 3, 4, 1, 2, 5, 6, 7, 8, 9, 6, 7, 8, 10, 4,
				1, 2, 3, 4, 1, 2, 5, 6,
			],
			patterns: {
				// Core 2-bar Motif (Bars 1-2, 5-6, 9-10, 13-14, 25-26, 29-30)
				"1": {
					index: 1,
					notes: [
						createSongNote(0, N.B4, 6, 0, 0.94),
						createSongNote(6, N.E5, 2, 0, 0.88),
						createSongNote(8, N.G5, 4, 0, 0.96),
						createSongNote(12, N.Fs5, 4, 0, 0.92),
					],
				},
				"2": {
					index: 2,
					notes: [
						createSongNote(0, N.E5, 8, 0, 0.96),
						createSongNote(8, N.G5, 4, 0, 0.92),
					],
				},

				// Question Cadence (Bars 3-4, 11-12, 27-28; Bar 4 also closes Section B)
				"3": {
					index: 3,
					notes: [
						createSongNote(0, N.D5, 6, 0, 0.94),
						createSongNote(6, N.E5, 2, 0, 0.88),
						createSongNote(8, N.G5, 4, 0, 0.96),
						createSongNote(12, N.D5, 4, 0, 0.9),
					],
				},
				"4": {
					index: 4,
					notes: [
						createSongNote(0, N.Fs5, 8, 0, 0.96),
						createSongNote(8, N.D5, 4, 0, 0.9),
					],
				},

				// Home Resolution Cadence (Bars 7-8, 15-16, 31-32; Bar 6 also lands B1)
				"5": {
					index: 5,
					notes: [
						createSongNote(0, N.Fs5, 6, 0, 0.94),
						createSongNote(6, N.G5, 2, 0, 0.9),
						createSongNote(8, N.A5, 4, 0, 0.98),
						createSongNote(12, N.Fs5, 4, 0, 0.92),
					],
				},
				"6": {
					index: 6,
					notes: [createSongNote(0, N.E5, 10, 0, 0.96)],
				},

				// Section B Lift (Bars 17-24): climbing C -> D -> Em motif, repeated twice
				"7": {
					index: 7,
					notes: [
						createSongNote(0, N.G5, 6, 0, 0.96),
						createSongNote(6, N.E5, 2, 0, 0.9),
						createSongNote(8, N.G5, 8, 0, 0.96),
					],
				},
				"8": {
					index: 8,
					notes: [
						createSongNote(0, N.A5, 6, 0, 0.98),
						createSongNote(6, N.Fs5, 2, 0, 0.92),
						createSongNote(8, N.A5, 8, 0, 0.98),
					],
				},
				"9": {
					index: 9,
					notes: [
						createSongNote(0, N.B5, 6, 0, 1.0),
						createSongNote(6, N.A5, 2, 0, 0.94),
						createSongNote(8, N.G5, 4, 0, 0.96),
						createSongNote(12, N.Fs5, 4, 0, 0.92),
					],
				},
				"10": {
					index: 10,
					notes: [
						createSongNote(0, N.G5, 8, 0, 0.96),
						createSongNote(8, N.E5, 4, 0, 0.92),
					],
				},
			},
		},

		// 2. Warm 50% Square Harmony — pure lower 3rds/triads locking onto the melody
		{
			id: "pb-harmony",
			name: "Rival Square 2",
			type: "pitch",
			color: "#ffd93d",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("gb-square-50").configuration,
				volume: 0.44,
				pan: 0.14,
				attack: 0.008,
				decay: 0.14,
				sustain: 0.66,
				release: 0.065,
				filterCutoff: 3800,
				vibratoDepth: 4,
				vibratoSpeed: 5.2,
				arpMode: "none",
				echoMix: 0,
				echoTimeSeconds: 0.357,
				detuneCents: 0,
			},
			// Silent during Theme A (1-8) and brief breath (25-26); sings warm 3rds elsewhere
			barSequence: [
				0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4, 1, 2, 5, 6, 7, 8, 9, 6, 7, 8, 10, 4,
				0, 0, 3, 4, 1, 2, 5, 6,
			],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSongNote(0, N.G4, 6, 0, 0.84),
						createSongNote(6, N.B4, 2, 0, 0.8),
						createSongNote(8, N.E5, 4, 0, 0.86),
						createSongNote(12, N.D5, 4, 0, 0.82),
					],
				},
				"2": {
					index: 2,
					notes: [
						createSongNote(0, N.C5, 8, 0, 0.86),
						createSongNote(8, N.E5, 4, 0, 0.84),
					],
				},
				"3": {
					index: 3,
					notes: [
						createSongNote(0, N.B4, 6, 0, 0.84),
						createSongNote(6, N.C5, 2, 0, 0.8),
						createSongNote(8, N.D5, 4, 0, 0.86),
						createSongNote(12, N.B4, 4, 0, 0.82),
					],
				},
				"4": {
					index: 4,
					notes: [
						createSongNote(0, N.D5, 8, 0, 0.86),
						createSongNote(8, N.A4, 4, 0, 0.82),
					],
				},
				"5": {
					index: 5,
					notes: [
						createSongNote(0, N.D5, 6, 0, 0.84),
						createSongNote(6, N.E5, 2, 0, 0.82),
						createSongNote(8, N.Fs5, 4, 0, 0.88),
						createSongNote(12, N.D5, 4, 0, 0.84),
					],
				},
				"6": {
					index: 6,
					notes: [createSongNote(0, N.B4, 10, 0, 0.86)],
				},
				"7": {
					index: 7,
					notes: [
						createSongNote(0, N.E5, 6, 0, 0.86),
						createSongNote(6, N.C5, 2, 0, 0.82),
						createSongNote(8, N.E5, 8, 0, 0.86),
					],
				},
				"8": {
					index: 8,
					notes: [
						createSongNote(0, N.Fs5, 6, 0, 0.88),
						createSongNote(6, N.D5, 2, 0, 0.82),
						createSongNote(8, N.Fs5, 8, 0, 0.88),
					],
				},
				"9": {
					index: 9,
					notes: [
						createSongNote(0, N.G5, 6, 0, 0.9),
						createSongNote(6, N.Fs5, 2, 0, 0.84),
						createSongNote(8, N.E5, 4, 0, 0.86),
						createSongNote(12, N.D5, 4, 0, 0.82),
					],
				},
				"10": {
					index: 10,
					notes: [
						createSongNote(0, N.E5, 8, 0, 0.86),
						createSongNote(8, N.B4, 4, 0, 0.82),
					],
				},
			},
		},

		// 3. Steady 4-Bit Triangle Bass — 4 chords, one clean driving pulse
		{
			id: "pb-bass",
			name: "Pocket Wave Bass",
			type: "pitch",
			color: "#ff9233",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("nes-triangle-bass").configuration,
				volume: 0.88,
				pan: 0,
				attack: 0.004,
				decay: 0.1,
				sustain: 0.78,
				release: 0.035,
				filterCutoff: 2100,
				echoMix: 0,
			},
			// Follows Em - C - G - D / Em - C - D - Em and C - D - Em cleanly
			barSequence: [
				1, 2, 3, 4, 1, 2, 4, 5, 1, 2, 3, 4, 1, 2, 4, 5, 2, 4, 1, 5, 2, 4, 1, 4,
				5, 2, 3, 4, 1, 2, 4, 5,
			],
			patterns: {
				// 1: Em (E2 - E2 - E2 - B2)
				"1": {
					index: 1,
					notes: createSteadyBassBar(N.E2, N.B2),
				},
				// 2: C (C3 - C3 - C3 - G2)
				"2": {
					index: 2,
					notes: createSteadyBassBar(N.C3, N.G2),
				},
				// 3: G (G2 - G2 - G2 - D3)
				"3": {
					index: 3,
					notes: createSteadyBassBar(N.G2, N.D3),
				},
				// 4: D (D3 - D3 - D3 - A2)
				"4": {
					index: 4,
					notes: createSteadyBassBar(N.D3, N.A2),
				},
				// 5: Em Warm Hold (resolution bars & breakdown start)
				"5": {
					index: 5,
					notes: [
						createSongNote(0, N.E2, 8, 0, 0.92),
						createSongNote(8, N.E2, 6, 0, 0.86),
					],
				},
			},
		},

		// 4. Soft 12.5% Quarter-Note Chord Pulse — warm background triad glue
		{
			id: "pb-arp",
			name: "12% Chord Pulse",
			type: "pitch",
			color: "#34d399",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("nes-pulse-12").configuration,
				volume: 0.28,
				pan: -0.18,
				attack: 0.005,
				decay: 0.09,
				sustain: 0.2,
				release: 0.045,
				filterCutoff: 3600,
				vibratoDepth: 0,
				arpMode: "none",
				echoMix: 0,
				echoTimeSeconds: 0.357,
				detuneCents: 0,
			},
			// Silent for Bars 1-8 so Theme A shines cleanly; enters smoothly on Bar 9
			barSequence: [
				0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4, 1, 2, 4, 1, 2, 4, 1, 1, 2, 4, 1, 4,
				1, 2, 3, 4, 1, 2, 4, 1,
			],
			patterns: {
				// 1: Em Triad
				"1": {
					index: 1,
					notes: createQuarterTriadBar(N.E4, N.G4, N.B4),
				},
				// 2: C Triad
				"2": {
					index: 2,
					notes: createQuarterTriadBar(N.C4, N.E4, N.G4),
				},
				// 3: G Triad
				"3": {
					index: 3,
					notes: createQuarterTriadBar(N.G3, N.B3, N.D4),
				},
				// 4: D Triad
				"4": {
					index: 4,
					notes: createQuarterTriadBar(N.D4, N.Fs4, N.A4),
				},
			},
		},

		// 5. Tight, Unified DMG 8-Bit Kit — ONE rock-solid heartbeat across the whole song
		{
			id: "pb-drums",
			name: "DMG Battle Kit",
			type: "drum",
			color: "#b366ff",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("retro-8bit-kit").configuration,
				volume: 0.76,
				attack: 0.002,
				decay: 0.14,
				sustain: 0.14,
				release: 0.04,
				filterCutoff: 7800,
				echoMix: 0,
				echoTimeSeconds: 0.12,
			},
			// Same steady beat almost everywhere; 2-bar breath on 25-26; 1-hit pickup every 8 bars
			barSequence: [
				1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 3,
				2, 2, 1, 1, 1, 1, 1, 3,
			],
			patterns: {
				// 1: Core Steady Backbeat (Kick 1 & 3, Snare 2 & 4, soft 8th hats)
				"1": {
					index: 1,
					notes: [
						createSongNote(0, 0, 1, 0, 0.94),
						createSongNote(0, 2, 1, 0, 0.42),
						createSongNote(2, 2, 1, 0, 0.28),
						createSongNote(4, 1, 1, 0, 0.88),
						createSongNote(4, 2, 1, 0, 0.4),
						createSongNote(6, 2, 1, 0, 0.28),
						createSongNote(8, 0, 1, 0, 0.92),
						createSongNote(8, 2, 1, 0, 0.42),
						createSongNote(10, 2, 1, 0, 0.28),
						createSongNote(12, 1, 1, 0, 0.9),
						createSongNote(12, 2, 1, 0, 0.4),
						createSongNote(14, 2, 1, 0, 0.3),
					],
				},
				// 2: Intimate Breakdown Pulse (Bars 25-26 breath — kick + soft hats only)
				"2": {
					index: 2,
					notes: [
						createSongNote(0, 0, 1, 0, 0.9),
						createSongNote(4, 2, 1, 0, 0.38),
						createSongNote(8, 0, 1, 0, 0.88),
						createSongNote(12, 2, 1, 0, 0.38),
					],
				},
				// 3: Subtle 8-Bar Section Turnaround (same beat + single snare pickup on step 14)
				"3": {
					index: 3,
					notes: [
						createSongNote(0, 0, 1, 0, 0.94),
						createSongNote(0, 2, 1, 0, 0.42),
						createSongNote(2, 2, 1, 0, 0.28),
						createSongNote(4, 1, 1, 0, 0.88),
						createSongNote(4, 2, 1, 0, 0.4),
						createSongNote(6, 2, 1, 0, 0.28),
						createSongNote(8, 0, 1, 0, 0.92),
						createSongNote(8, 2, 1, 0, 0.42),
						createSongNote(10, 2, 1, 0, 0.28),
						createSongNote(12, 1, 1, 0, 0.9),
						createSongNote(14, 1, 1, 0, 0.78),
					],
				},
			},
		},
	],
};

import type { Channel, NoteEvent, Pattern, SongProject } from "../types/music";
import { getPresetConfigurationById } from "./instrumentPresets";

/**
 * "Amen Overdrive 180" — a 32-bar, 180 BPM E-minor breakcore demo.
 *
 * Showcases the breakcore toolkit:
 *  - `ratchet` stutter notes (snare rolls, hat stutters, lead/bass glitches)
 *  - pitch-bent drum notes and ratchet + bend "riser" rolls
 *  - per-channel `drive` bit-crush overdrive (reese bass, gabber kick)
 *  - the Amen Break Kit and Gabber Kick drum voices
 *
 * Arrangement (bars are 0-indexed):
 *  0-3   Intro      glass pad swells, filter-opening arp, filtered amen, first riser
 *  4-11  Drop A     chopped amen, reese bass, rave lead hook A → B
 *  12-15 Break      half-time breaks, emotional long-note lead, arp riser, huge roll
 *  16-23 Drop B     gabber four-on-the-floor under the amen, lead B → A
 *  24-27 Chaos      hyper-chopped pitched breaks, stuttering lead + reese
 *  28-31 Finale     full-force hook B, last roll loops back to the intro
 */

// Drum pad aliases (pad numbers are shared by every kit)
const KICK = 0;
const SNARE = 1;
const RIDE = 2;
const CRASH = 3;
const ZAP = 7;

interface NoteOptions {
	velocity?: number;
	bend?: number;
	ratchet?: number;
	cutoff?: number;
	sweepTo?: number;
	fadeIn?: boolean;
	bendStyle?: NoteEvent["bendStyle"];
}

let noteCounter = 0;

const n = (
	step: number,
	pitch: number,
	duration = 1,
	options: NoteOptions = {}
): NoteEvent => {
	noteCounter += 1;
	return {
		id: `bc-${noteCounter}-${step}-${pitch}`,
		step,
		pitch,
		duration,
		velocity: options.velocity ?? 0.9,
		pitchBend: options.bend ?? 0,
		...(options.bendStyle ? { bendStyle: options.bendStyle } : {}),
		...(options.ratchet && options.ratchet > 1
			? { ratchet: options.ratchet }
			: {}),
		...(options.cutoff !== undefined ? { filterCutoff: options.cutoff } : {}),
		...(options.sweepTo !== undefined
			? { filterSweepTo: options.sweepTo }
			: {}),
		...(options.fadeIn ? { fadeMode: "fadeIn" as const } : {}),
	};
};

const toPatterns = (
	patternList: Array<Array<NoteEvent>>
): Record<string, Pattern> => {
	const patterns: Record<string, Pattern> = {};
	patternList.forEach((notes, index) => {
		patterns[String(index + 1)] = { index: index + 1, notes };
	});
	return patterns;
};

/** Repeats a four-pattern cycle across `count` bars. */
const cycle = (patterns: Array<number>, count: number): Array<number> =>
	Array.from(
		{ length: count },
		(_, index) => patterns[index % patterns.length] ?? 0
	);

// ─── Harmony: Em – C – G – D (i – VI – III – VII) ────────────────────────────
interface ChordShape {
	bass: number;
	tones: [number, number, number];
}

const CHORDS: Array<ChordShape> = [
	{ bass: 40, tones: [64, 67, 71] }, // E minor
	{ bass: 36, tones: [60, 64, 67] }, // C major
	{ bass: 43, tones: [62, 67, 71] }, // G major (2nd inversion)
	{ bass: 38, tones: [62, 66, 69] }, // D major
];

// ─── Rave lead ───────────────────────────────────────────────────────────────
const leadPatterns: Array<Array<NoteEvent>> = [
	// 1-4: Hook A
	[
		n(0, 76, 3),
		n(3, 79, 3),
		n(6, 83, 2),
		n(8, 81, 2),
		n(10, 79, 2),
		n(12, 78, 2),
		n(14, 79, 2),
	],
	[n(0, 76, 6), n(6, 74, 2), n(8, 76, 2), n(10, 79, 4), n(14, 76, 2)],
	[
		n(0, 74, 3),
		n(3, 71, 3),
		n(6, 74, 2),
		n(8, 79, 4),
		n(12, 78, 2),
		n(14, 76, 2),
	],
	[
		n(0, 78, 4),
		n(4, 81, 4),
		n(8, 78, 2),
		n(10, 74, 2),
		n(12, 74, 4, { bend: 2 }),
	],
	// 5-8: Hook B (climbing answer)
	[
		n(0, 83, 2),
		n(2, 81, 2),
		n(4, 79, 2),
		n(6, 81, 2),
		n(8, 83, 4),
		n(12, 76, 2),
		n(14, 79, 2),
	],
	[
		n(0, 79, 3),
		n(3, 76, 3),
		n(6, 72, 2),
		n(8, 76, 4),
		n(12, 79, 2),
		n(14, 81, 2),
	],
	[
		n(0, 83, 3),
		n(3, 79, 3),
		n(6, 74, 2),
		n(8, 79, 2),
		n(10, 81, 2),
		n(12, 83, 4),
	],
	[n(0, 81, 6), n(6, 78, 2), n(8, 74, 4), n(12, 78, 4, { bend: -2 })],
	// 9-12: Chaos stutter hook
	[
		n(0, 76, 2, { ratchet: 4 }),
		n(2, 79, 2),
		n(4, 83, 2, { ratchet: 3 }),
		n(6, 81, 2),
		n(8, 76, 4, { ratchet: 8, bend: 7 }),
		n(12, 79, 4, { ratchet: 4 }),
	],
	[
		n(0, 76, 4, { ratchet: 4 }),
		n(4, 72, 2),
		n(6, 76, 2),
		n(8, 79, 4, { ratchet: 6 }),
		n(12, 76, 2),
		n(14, 74, 2),
	],
	[
		n(0, 74, 2, { ratchet: 3 }),
		n(2, 79, 2),
		n(4, 74, 2, { ratchet: 3 }),
		n(6, 79, 2),
		n(8, 83, 4, { ratchet: 8, bend: -12 }),
		n(12, 79, 4, { ratchet: 2 }),
	],
	[
		n(0, 78, 4, { ratchet: 4 }),
		n(4, 81, 4, { ratchet: 4 }),
		n(8, 74, 8, { ratchet: 8, bend: 10 }),
	],
	// 13-16: Half-time break melody (long, vibrato-heavy notes)
	[n(0, 83, 6), n(6, 81, 2), n(8, 79, 8)],
	[n(0, 76, 8), n(8, 79, 4), n(12, 81, 4)],
	[n(0, 83, 8), n(8, 79, 8)],
	[n(0, 78, 8), n(8, 81, 8, { bend: 2 })],
];

// ─── Glitch arp ──────────────────────────────────────────────────────────────
const ARP_SHAPE: Array<[number, number]> = [
	// [chord tone index, octave]
	[0, 0],
	[1, 0],
	[2, 0],
	[0, 1],
	[2, 0],
	[1, 0],
	[0, 0],
	[1, 0],
	[2, 0],
	[0, 1],
	[1, 1],
	[0, 1],
	[2, 0],
	[1, 0],
	[2, 0],
	[0, 1],
];

const arpBar = (
	chord: ChordShape,
	octaveShift: number,
	cutoffFrom?: number,
	cutoffTo?: number
): Array<NoteEvent> =>
	ARP_SHAPE.map(([toneIndex, octave], step) => {
		const pitch = Math.min(
			84,
			chord.tones[toneIndex]! + (octave + octaveShift) * 12
		);
		const cutoff =
			cutoffFrom !== undefined && cutoffTo !== undefined
				? Math.round(cutoffFrom + ((cutoffTo - cutoffFrom) * step) / 15)
				: undefined;
		return n(step, pitch, 1, {
			velocity: step % 4 === 0 ? 0.9 : 0.62,
			...(cutoff !== undefined ? { cutoff } : {}),
		});
	});

const arpPatterns: Array<Array<NoteEvent>> = [
	// 1-4: normal arps
	...CHORDS.map((chord) => arpBar(chord, 0)),
	// 5-8: octave-up hyper arps
	...CHORDS.map((chord) => arpBar(chord, 1)),
	// 9-12: filter-opening intro / riser arps
	arpBar(CHORDS[0]!, 0, 380, 1400),
	arpBar(CHORDS[1]!, 0, 1400, 2500),
	arpBar(CHORDS[2]!, 0, 2500, 3800),
	arpBar(CHORDS[3]!, 0, 3800, 6200),
];

// ─── Glass pad ───────────────────────────────────────────────────────────────
const padBar = (chord: ChordShape, fadeIn = false): Array<NoteEvent> =>
	chord.tones.map((tone) => n(0, tone, 16, { velocity: 0.55, fadeIn }));

const padPatterns: Array<Array<NoteEvent>> = [
	...CHORDS.map((chord) => padBar(chord)),
	padBar(CHORDS[0]!, true), // 5: intro swell
];

// ─── Reese bass ──────────────────────────────────────────────────────────────
const reeseBar = (root: number): Array<NoteEvent> => [
	n(0, root, 3, { cutoff: 420, sweepTo: 2600 }),
	n(3, root, 2, { velocity: 0.75 }),
	n(6, root + 12, 2, { cutoff: 1800, sweepTo: 500 }),
	n(8, root, 2),
	n(10, root, 1, { velocity: 0.7 }),
	n(11, root + 12, 1, { velocity: 0.8 }),
	n(12, root, 2, { cutoff: 600, sweepTo: 3200 }),
	n(14, root + 7, 2, { velocity: 0.8 }),
];

const reeseChaosBar = (root: number): Array<NoteEvent> => [
	n(0, root, 4, { ratchet: 4, cutoff: 500, sweepTo: 3000 }),
	n(4, root + 12, 2, { ratchet: 2 }),
	n(6, root, 2),
	n(8, root, 4, { ratchet: 8, bend: 12, cutoff: 700, sweepTo: 4000 }),
	n(12, root, 4, { ratchet: 3, cutoff: 2600, sweepTo: 400 }),
];

const reesePatterns: Array<Array<NoteEvent>> = [
	...CHORDS.map((chord) => reeseBar(chord.bass)),
	...CHORDS.map((chord) => reeseChaosBar(chord.bass)),
];

// ─── Triangle sub ────────────────────────────────────────────────────────────
const subPatterns: Array<Array<NoteEvent>> = CHORDS.map((chord) => [
	n(0, chord.bass, 6, { velocity: 0.85 }),
	n(8, chord.bass, 6, { velocity: 0.8 }),
]);

// ─── Amen break ──────────────────────────────────────────────────────────────
const ridesEvery8th = (velocity = 0.45): Array<NoteEvent> =>
	[0, 2, 4, 6, 8, 10, 12, 14].map((step) => n(step, RIDE, 1, { velocity }));

const amenA = (): Array<NoteEvent> => [
	n(0, KICK, 1, { velocity: 1 }),
	n(2, KICK, 1, { velocity: 0.85 }),
	n(4, SNARE, 1, { velocity: 1 }),
	n(7, SNARE, 1, { velocity: 0.5 }),
	n(9, SNARE, 1, { velocity: 0.6 }),
	n(10, KICK, 1, { velocity: 0.9 }),
	n(11, KICK, 1, { velocity: 0.75 }),
	n(12, SNARE, 1, { velocity: 1 }),
	n(15, SNARE, 1, { velocity: 0.5 }),
	...ridesEvery8th(),
];

const amenFiltered = (cutoffFrom: number, cutoffTo: number): Array<NoteEvent> =>
	amenA().map((note) => ({
		...note,
		filterCutoff: Math.round(
			cutoffFrom + ((cutoffTo - cutoffFrom) * note.step) / 15
		),
	}));

const amenPatterns: Array<Array<NoteEvent>> = [
	// 1: classic amen A
	amenA(),
	// 2: amen B (second half of the break, with a flam)
	[
		n(0, KICK, 1, { velocity: 1 }),
		n(2, KICK, 1, { velocity: 0.85 }),
		n(4, SNARE, 1, { velocity: 1 }),
		n(7, SNARE, 1, { velocity: 0.5 }),
		n(9, SNARE, 1, { velocity: 0.6 }),
		n(10, KICK, 1, { velocity: 0.9 }),
		n(12, SNARE, 1, { velocity: 0.95 }),
		n(14, SNARE, 2, { velocity: 0.75, ratchet: 2 }),
		...ridesEvery8th(),
	],
	// 3: chopped / rearranged amen
	[
		n(0, KICK, 1, { velocity: 1 }),
		n(2, SNARE, 1, { velocity: 0.8 }),
		n(3, KICK, 1, { velocity: 0.85 }),
		n(4, SNARE, 1, { velocity: 1 }),
		n(6, KICK, 1, { velocity: 0.9 }),
		n(7, SNARE, 1, { velocity: 0.7, ratchet: 2 }),
		n(8, KICK, 1, { velocity: 0.95 }),
		n(10, SNARE, 1, { velocity: 0.9 }),
		n(11, KICK, 1, { velocity: 0.8 }),
		n(12, SNARE, 2, { velocity: 1, ratchet: 4 }),
		n(14, SNARE, 1, { velocity: 0.6 }),
		n(15, SNARE, 1, { velocity: 0.8, bend: 3 }),
		n(0, RIDE, 1, { velocity: 0.45 }),
		n(4, RIDE, 1, { velocity: 0.45 }),
		n(8, RIDE, 1, { velocity: 0.45 }),
	],
	// 4: fill with stepped snare riser
	[
		n(0, KICK, 1, { velocity: 1 }),
		n(0, SNARE, 1, { velocity: 0.8 }),
		n(2, SNARE, 1, { velocity: 0.7 }),
		n(3, KICK, 1, { velocity: 0.85 }),
		n(4, SNARE, 2, { velocity: 0.9, ratchet: 2 }),
		n(6, KICK, 1, { velocity: 0.9 }),
		n(7, SNARE, 1, { velocity: 0.65 }),
		n(8, SNARE, 4, { velocity: 0.85, ratchet: 6, bend: 3 }),
		n(12, SNARE, 4, { velocity: 0.95, ratchet: 8, bend: 7 }),
	],
	// 5: intro amen, filter opening
	amenFiltered(500, 2200),
	// 6: intro amen into first riser
	[
		...amenFiltered(2200, 4200).filter((note) => note.step < 8),
		n(8, SNARE, 4, { velocity: 0.8, ratchet: 6, bend: 2, cutoff: 6000 }),
		n(12, SNARE, 4, { velocity: 0.95, ratchet: 8, bend: 5 }),
	],
	// 7: half-time break groove
	[
		n(0, KICK, 1, { velocity: 1 }),
		n(8, SNARE, 1, { velocity: 1 }),
		n(11, KICK, 1, { velocity: 0.7 }),
		n(14, SNARE, 1, { velocity: 0.45 }),
		...ridesEvery8th(0.35),
	],
	// 8: huge break-ending roll
	[
		n(0, KICK, 1, { velocity: 1 }),
		n(0, SNARE, 4, { velocity: 0.7, ratchet: 4 }),
		n(4, SNARE, 4, { velocity: 0.78, ratchet: 6, bend: 2 }),
		n(8, SNARE, 4, { velocity: 0.86, ratchet: 8, bend: 4 }),
		n(12, SNARE, 4, { velocity: 1, ratchet: 8, bend: 9 }),
	],
	// 9: chaos chop 1 (pitched resampled hits)
	[
		n(0, KICK, 1, { velocity: 1, bend: -3 }),
		n(1, SNARE, 1, { velocity: 0.55 }),
		n(2, SNARE, 1, { velocity: 0.85 }),
		n(3, KICK, 1, { velocity: 0.9 }),
		n(4, SNARE, 2, { velocity: 1, ratchet: 3, bend: 5 }),
		n(6, KICK, 1, { velocity: 0.9 }),
		n(7, SNARE, 1, { velocity: 0.7 }),
		n(8, SNARE, 1, { velocity: 0.95, bend: 12 }),
		n(9, KICK, 1, { velocity: 0.85 }),
		n(10, SNARE, 2, { velocity: 0.9, ratchet: 4, bend: -5 }),
		n(12, KICK, 1, { velocity: 1 }),
		n(13, SNARE, 3, { velocity: 1, ratchet: 6, bend: 7 }),
	],
	// 10: chaos chop 2 (falling roll)
	[
		n(0, KICK, 1, { velocity: 1 }),
		n(1, KICK, 1, { velocity: 0.7 }),
		n(2, SNARE, 2, { velocity: 0.9, ratchet: 3 }),
		n(4, SNARE, 1, { velocity: 1 }),
		n(5, KICK, 1, { velocity: 0.85 }),
		n(6, SNARE, 1, { velocity: 0.8, bend: 5 }),
		n(7, SNARE, 1, { velocity: 0.85, bend: 7 }),
		n(8, KICK, 2, { velocity: 0.95, ratchet: 2, bend: -5 }),
		n(10, SNARE, 2, { velocity: 0.9, ratchet: 4 }),
		n(12, SNARE, 4, { velocity: 1, ratchet: 8, bend: -12 }),
	],
	// 11: amen A with every hit stuttered
	amenA().map((note) =>
		note.pitch === SNARE || note.pitch === RIDE ? { ...note, ratchet: 2 } : note
	),
	// 12: double rising roll into the finale
	[
		n(0, KICK, 1, { velocity: 1 }),
		n(0, SNARE, 8, { velocity: 0.75, ratchet: 8, bend: 5 }),
		n(8, KICK, 1, { velocity: 1 }),
		n(8, SNARE, 8, { velocity: 1, ratchet: 8, bend: 12 }),
	],
];

// ─── Gabber kick ─────────────────────────────────────────────────────────────
const gabberPatterns: Array<Array<NoteEvent>> = [
	// 1: sparse reinforcement under the amen
	[n(0, KICK, 1, { velocity: 1 }), n(10, KICK, 1, { velocity: 0.8 })],
	// 2: four-on-the-floor
	[0, 4, 8, 12].map((step) => n(step, KICK, 1, { velocity: 1 })),
	// 3: four-on-the-floor with stutter turnaround
	[
		...[0, 4, 8, 10, 12].map((step) => n(step, KICK, 1, { velocity: 1 })),
		n(14, KICK, 2, { velocity: 0.9, ratchet: 2 }),
	],
	// 4: chaos kicks
	[
		n(0, KICK, 1, { velocity: 1 }),
		n(3, KICK, 1, { velocity: 0.85 }),
		n(6, KICK, 1, { velocity: 0.9 }),
		n(8, KICK, 1, { velocity: 1 }),
		n(11, KICK, 1, { velocity: 0.85 }),
		n(12, KICK, 2, { velocity: 0.95, ratchet: 2 }),
		n(14, KICK, 2, { velocity: 0.9, ratchet: 3, bend: 5 }),
	],
];

// ─── Glitch FX ───────────────────────────────────────────────────────────────
const glitchPatterns: Array<Array<NoteEvent>> = [
	// 1: crash
	[n(0, CRASH, 1, { velocity: 1 })],
	// 2: stutter hats into a rising tick roll
	[
		n(0, RIDE, 2, { velocity: 0.5, ratchet: 4 }),
		n(4, RIDE, 2, { velocity: 0.55, ratchet: 2 }),
		n(8, RIDE, 2, { velocity: 0.6, ratchet: 6 }),
		n(12, RIDE, 4, { velocity: 0.7, ratchet: 8, bend: 12 }),
	],
	// 3: glitch zaps
	[
		n(2, RIDE, 1, { velocity: 0.45 }),
		n(6, ZAP, 1, { velocity: 0.75, bend: -5 }),
		n(10, RIDE, 1, { velocity: 0.45 }),
		n(14, ZAP, 1, { velocity: 0.8, bend: 5 }),
	],
	// 4: crash + zaps
	[
		n(0, CRASH, 1, { velocity: 1 }),
		n(7, ZAP, 1, { velocity: 0.75 }),
		n(15, ZAP, 1, { velocity: 0.8, bend: 7 }),
	],
];

// ─── Channels ────────────────────────────────────────────────────────────────
const makeChannel = (
	id: string,
	name: string,
	type: Channel["type"],
	color: string,
	presetId: string,
	barSequence: Array<number>,
	patterns: Array<Array<NoteEvent>>,
	instrumentOverrides: Partial<Channel["instrument"]> = {}
): Channel => ({
	id,
	name,
	type,
	color,
	muted: false,
	solo: false,
	instrument: {
		...getPresetConfigurationById(presetId).configuration,
		...instrumentOverrides,
	},
	barSequence,
	patterns: toPatterns(patterns),
});

const intro = 4;

export const amenOverdrive180Song: SongProject = {
	id: "demo-amen-overdrive-180",
	title: "Amen Overdrive 180",
	author: "UltraBeep Demo",
	bpm: 180,
	beatsPerBar: 4,
	stepsPerBeat: 4,
	totalBars: 32,
	loopStartBar: 0,
	loopEndBar: 31,
	swing: 0,
	rootKey: "E",
	scale: "minor",
	masterVolume: 0.72,
	updatedAt: 1763700000000,
	channels: [
		makeChannel(
			"bc-lead",
			"Rave Lead",
			"pitch",
			"#f472b6",
			"breakcore-rave-lead",
			[
				...cycle([0], intro),
				...cycle([1, 2, 3, 4], 4),
				...cycle([5, 6, 7, 8], 4),
				...cycle([13, 14, 15, 16], 4),
				...cycle([5, 6, 7, 8], 4),
				...cycle([1, 2, 3, 4], 4),
				...cycle([9, 10, 11, 12], 4),
				...cycle([5, 6, 7, 8], 4),
			],
			leadPatterns
		),
		makeChannel(
			"bc-arp",
			"Glitch Arp",
			"pitch",
			"#22d3ee",
			"breakcore-glitch-arp",
			[
				9,
				10,
				11,
				12,
				...cycle([1, 2, 3, 4], 8),
				0,
				0,
				11,
				12,
				...cycle([1, 2, 3, 4], 8),
				...cycle([5, 6, 7, 8], 8),
			],
			arpPatterns
		),
		makeChannel(
			"bc-pad",
			"Glass Pad",
			"pitch",
			"#a78bfa",
			"breakcore-glass-pad",
			[
				5,
				2,
				3,
				4,
				...cycle([1, 2, 3, 4], 12),
				...cycle([1, 2, 3, 4], 8),
				...cycle([0], 4),
				...cycle([1, 2, 3, 4], 4),
			],
			padPatterns
		),
		makeChannel(
			"bc-reese",
			"Reese Bass",
			"pitch",
			"#fb7185",
			"breakcore-reese-bass",
			[
				...cycle([0], intro),
				...cycle([1, 2, 3, 4], 8),
				...cycle([0], 4),
				...cycle([1, 2, 3, 4], 8),
				...cycle([5, 6, 7, 8], 4),
				...cycle([1, 2, 3, 4], 4),
			],
			reesePatterns
		),
		makeChannel(
			"bc-sub",
			"Triangle Sub",
			"pitch",
			"#ff9233",
			"nes-triangle-bass",
			[...cycle([0], intro), ...cycle([1, 2, 3, 4], 28)],
			subPatterns,
			{ volume: 0.78 }
		),
		makeChannel(
			"bc-amen",
			"Amen Break",
			"drum",
			"#facc15",
			"breakcore-amen-kit",
			[
				0, 0, 5, 6, 1, 2, 1, 3, 1, 2, 3, 4, 7, 7, 7, 8, 1, 3, 2, 3, 1, 3, 11, 4,
				9, 10, 9, 12, 1, 3, 2, 4,
			],
			amenPatterns
		),
		makeChannel(
			"bc-gabber",
			"Gabber Kick",
			"drum",
			"#ef4444",
			"breakcore-gabber-kick",
			[
				...cycle([0], intro),
				...cycle([1], 8),
				...cycle([0], 4),
				2,
				2,
				2,
				3,
				2,
				2,
				2,
				3,
				4,
				4,
				4,
				0,
				2,
				2,
				2,
				3,
			],
			gabberPatterns
		),
		makeChannel(
			"bc-glitch",
			"Glitch FX",
			"drum",
			"#34d399",
			"breakcore-amen-kit",
			[
				1, 0, 0, 2, 4, 0, 3, 0, 1, 0, 3, 2, 1, 3, 0, 2, 4, 3, 0, 3, 1, 3, 0, 2,
				2, 3, 2, 2, 4, 3, 3, 2,
			],
			glitchPatterns,
			{ drive: 0.35, volume: 0.7, pan: 0.15 }
		),
	],
};

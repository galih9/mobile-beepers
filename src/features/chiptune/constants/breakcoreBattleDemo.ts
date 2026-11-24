import type { Channel, NoteEvent, Pattern, SongProject } from "../types/music";
import { getPresetConfigurationById } from "./instrumentPresets";

/**
 * "Breakcore Battle v1" — 48-bar, 174 BPM A-major breakcore battle loop
 * (~66s) for a turn-based fantasy RPG.
 *
 * Built like a Balatro-style soundtrack: ONE chord loop, ONE tempo, ONE groove,
 * split into three sections that each loop seamlessly on their own and also
 * flow into each other. Swap sections in-game without the vibe changing.
 *
 * Harmony (every section): D – E – C#m – F#m  (IV – V – iii – vi, "royal road")
 *
 * Sections (bars 0-indexed, 16 bars / ~22s each):
 *  0-15   Section 1 "Command"   Hook A on a clean pulse lead, bouncy triangle
 *                                bass, offbeat stabs, amen breaks. Lightest.
 *  16-31  Section 2 "Clash"     Hook B (bouncier answer), reese + sub bass,
 *                                glitch arp, harmony enters on the repeat.
 *  32-47  Section 3 "Rush"      Hook A then Hook B, both harmonised, light
 *                                four-on-the-floor + offbeat open hats.
 *
 * Design rules: the lead only plays scale tones that sit on the chord, every
 * phrase repeats so it's easy to follow, and the chaos (ratchets, rolls) lives
 * in the drums — never in the melody.
 */

// Drum pad aliases (pad numbers are shared by every kit)
const KICK = 0;
const SNARE = 1;
const HAT = 2;
const OPEN_HAT = 3;
const ZAP = 7;

interface NoteOptions {
	velocity?: number;
	bend?: number;
	ratchet?: number;
	cutoff?: number;
	sweepTo?: number;
	fadeIn?: boolean;
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
		id: `bb-${noteCounter}-${step}-${pitch}`,
		step,
		pitch,
		duration,
		velocity: options.velocity ?? 0.9,
		pitchBend: options.bend ?? 0,
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

/** Repeats a pattern cycle across `count` bars. */
const cycle = (patterns: Array<number>, count: number): Array<number> =>
	Array.from(
		{ length: count },
		(_, index) => patterns[index % patterns.length] ?? 0
	);

// ─── Pitches (A major: A B C# D E F# G#) ─────────────────────────────────────
const Cs2 = 37;
const D2 = 38;
const E2 = 40;
const Fs2 = 42;
const Cs4 = 61;
const D4 = 62;
const E4 = 64;
const Fs4 = 66;
const Gs4 = 68;
const A4 = 69;
const B4 = 71;
const Cs5 = 73;
const D5 = 74;
const E5 = 76;
const Fs5 = 78;
const Gs5 = 80;
const A5 = 81;
const B5 = 83;

// ─── Harmony: D – E – C#m – F#m ──────────────────────────────────────────────
interface ChordShape {
	bass: number;
	tones: [number, number, number];
	color: number; // 7th / extension for the pad
}

const CHORDS: Array<ChordShape> = [
	{ bass: D2, tones: [D4, Fs4, A4], color: Cs5 }, // Dmaj7
	{ bass: E2, tones: [E4, Gs4, B4], color: D5 }, // E7
	{ bass: Cs2, tones: [Cs4, E4, Gs4], color: B4 }, // C#m7
	{ bass: Fs2, tones: [Cs4, Fs4, A4], color: E5 }, // F#m7
];

// ─── Melody ──────────────────────────────────────────────────────────────────
type Phrase = Array<[step: number, pitch: number, duration: number]>;

/** Hook A — singable 3+3+2 bounce, two 4-bar halves (call / answer). */
const HOOK_A: Array<Phrase> = [
	[
		[0, Fs5, 3],
		[3, E5, 3],
		[6, Fs5, 2],
		[8, A5, 4],
		[12, Fs5, 2],
		[14, E5, 2],
	],
	[
		[0, Gs5, 3],
		[3, Fs5, 3],
		[6, E5, 2],
		[8, B4, 4],
		[12, E5, 2],
		[14, Gs5, 2],
	],
	[
		[0, Gs5, 3],
		[3, Fs5, 3],
		[6, Gs5, 2],
		[8, B5, 4],
		[12, Gs5, 2],
		[14, E5, 2],
	],
	[
		[0, A5, 6],
		[6, Gs5, 2],
		[8, Fs5, 4],
		[12, Cs5, 2],
		[14, E5, 2],
	],
	[
		[0, Fs5, 3],
		[3, E5, 3],
		[6, Fs5, 2],
		[8, A5, 4],
		[12, B5, 4],
	],
	[
		[0, B5, 6],
		[6, Gs5, 2],
		[8, E5, 4],
		[12, Fs5, 2],
		[14, Gs5, 2],
	],
	[
		[0, E5, 3],
		[3, Gs5, 3],
		[6, B5, 2],
		[8, Gs5, 2],
		[10, B5, 2],
		[12, Gs5, 2],
		[14, E5, 2],
	],
	[
		[0, Fs5, 6],
		[6, Gs5, 2],
		[8, A5, 2],
		[10, Gs5, 2],
		[12, Fs5, 4],
	],
];

/** Hook B — the "dance" answer: same chords, skippier 16th pickup rhythm. */
const HOOK_B: Array<Phrase> = [
	[
		[0, Fs5, 2],
		[2, D5, 1],
		[3, Fs5, 3],
		[6, A5, 2],
		[8, B5, 2],
		[10, A5, 2],
		[12, Fs5, 4],
	],
	[
		[0, Gs5, 2],
		[2, E5, 1],
		[3, Gs5, 3],
		[6, B5, 2],
		[8, B5, 2],
		[10, A5, 2],
		[12, Gs5, 4],
	],
	[
		[0, Gs5, 2],
		[2, E5, 1],
		[3, Gs5, 3],
		[6, B5, 2],
		[8, B5, 2],
		[10, Gs5, 2],
		[12, E5, 2],
		[14, Gs5, 2],
	],
	[
		[0, A5, 6],
		[6, Gs5, 2],
		[8, Fs5, 4],
		[12, E5, 2],
		[14, Cs5, 2],
	],
	[
		[0, Fs5, 2],
		[2, D5, 1],
		[3, Fs5, 3],
		[6, A5, 2],
		[8, B5, 2],
		[10, A5, 2],
		[12, Fs5, 4],
	],
	[
		[0, Gs5, 2],
		[2, E5, 1],
		[3, Gs5, 3],
		[6, B5, 2],
		[8, B5, 2],
		[10, A5, 2],
		[12, Gs5, 4],
	],
	[
		[0, E5, 2],
		[2, Gs5, 1],
		[3, B5, 3],
		[6, Gs5, 2],
		[8, E5, 2],
		[10, Gs5, 2],
		[12, B5, 4],
	],
	[
		[0, A5, 4],
		[4, Gs5, 2],
		[6, Fs5, 6],
		[14, E5, 2],
	],
];

const ACCENT_STEPS = new Set([0, 3, 6, 8, 12]);

const leadBar = (phrase: Phrase): Array<NoteEvent> =>
	phrase.map(([step, pitch, duration]) =>
		n(step, pitch, duration, { velocity: ACCENT_STEPS.has(step) ? 0.9 : 0.78 })
	);

/**
 * Harmony voice: the nearest chord tone at least a minor 3rd under the lead,
 * so it always lands on the chord (no tritones or rubs against the bass).
 */
const chordToneBelow = (pitch: number, chord: ChordShape): number => {
	const pitchClasses = chord.tones.map((tone) => tone % 12);
	let result = pitch - 3;
	while (!pitchClasses.includes(result % 12)) result -= 1;
	return result;
};

const harmonyBar = (phrase: Phrase, barIndex: number): Array<NoteEvent> =>
	phrase.map(([step, pitch, duration]) =>
		n(step, chordToneBelow(pitch, CHORDS[barIndex % 4]!), duration, {
			velocity: 0.7,
		})
	);

// Lead patterns: 1-8 Hook A, 9-16 Hook B
const leadPatterns = [...HOOK_A.map(leadBar), ...HOOK_B.map(leadBar)];
// Harmony patterns: 1-8 Hook A in 3rds, 9-16 Hook B in 3rds
const harmonyPatterns = [...HOOK_A.map(harmonyBar), ...HOOK_B.map(harmonyBar)];

const HOOK_A_SEQ = [1, 2, 3, 4, 5, 6, 7, 8];
const HOOK_B_SEQ = [9, 10, 11, 12, 13, 14, 15, 16];

// ─── Offbeat chord stabs (the "dance" skank) ─────────────────────────────────
const stabBar = (chord: ChordShape, busy: boolean): Array<NoteEvent> => {
	const steps = busy ? [2, 6, 7, 10, 14, 15] : [2, 6, 10, 14];
	return steps.flatMap((step) =>
		chord.tones.map((tone) =>
			n(step, tone, 1, { velocity: step % 4 === 2 ? 0.75 : 0.5 })
		)
	);
};

const stabPatterns = [
	...CHORDS.map((chord) => stabBar(chord, false)), // 1-4
	...CHORDS.map((chord) => stabBar(chord, true)), // 5-8
];

// ─── Glitch arp (soft 16ths, tucked under the lead) ──────────────────────────
const ARP_SHAPE: Array<[number, number]> = [
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

const arpBar = (chord: ChordShape): Array<NoteEvent> =>
	ARP_SHAPE.map(([toneIndex, octave], step) =>
		n(step, chord.tones[toneIndex]! + octave * 12, 1, {
			velocity: step % 4 === 0 ? 0.75 : 0.5,
		})
	);

const arpPatterns = CHORDS.map(arpBar);

// ─── Glass pad ───────────────────────────────────────────────────────────────
const padBar = (chord: ChordShape): Array<NoteEvent> => [
	...chord.tones.map((tone) => n(0, tone, 16, { velocity: 0.5 })),
	n(0, chord.color, 16, { velocity: 0.38 }),
];

const padPatterns = CHORDS.map(padBar);

// ─── Bass ────────────────────────────────────────────────────────────────────
/** Bouncy octave bass for section 1 (triangle). */
const bounceBar = (root: number): Array<NoteEvent> => [
	n(0, root, 2, { velocity: 0.95 }),
	n(3, root, 1, { velocity: 0.7 }),
	n(4, root + 12, 2, { velocity: 0.8 }),
	n(6, root, 2, { velocity: 0.85 }),
	n(8, root, 2, { velocity: 0.9 }),
	n(10, root + 12, 1, { velocity: 0.75 }),
	n(11, root, 1, { velocity: 0.7 }),
	n(12, root + 12, 2, { velocity: 0.85 }),
	n(14, root + 7, 2, { velocity: 0.8 }),
];

/** Plain sub under the reese (triangle). */
const subBar = (root: number): Array<NoteEvent> => [
	n(0, root, 6, { velocity: 0.85 }),
	n(8, root, 6, { velocity: 0.8 }),
];

const triPatterns = [
	...CHORDS.map((chord) => bounceBar(chord.bass)), // 1-4
	...CHORDS.map((chord) => subBar(chord.bass)), // 5-8
];

/** Reese groove (same rhythm as Amen Overdrive), sweeps kept gentle. */
const reeseBar = (root: number): Array<NoteEvent> => [
	n(0, root, 3, { cutoff: 500, sweepTo: 2000 }),
	n(3, root, 2, { velocity: 0.75 }),
	n(6, root + 12, 2, { cutoff: 1500, sweepTo: 600 }),
	n(8, root, 2),
	n(10, root, 1, { velocity: 0.7 }),
	n(11, root + 12, 1, { velocity: 0.8 }),
	n(12, root, 2, { cutoff: 600, sweepTo: 2400 }),
	n(14, root + 7, 2, { velocity: 0.8 }),
];

const reesePatterns = CHORDS.map((chord) => reeseBar(chord.bass));

// ─── Amen break ──────────────────────────────────────────────────────────────
const hats8ths = (velocity = 0.42): Array<NoteEvent> =>
	[0, 2, 4, 6, 8, 10, 12, 14].map((step) => n(step, HAT, 1, { velocity }));

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
	...hats8ths(),
];

const amenB = (): Array<NoteEvent> => [
	n(0, KICK, 1, { velocity: 1 }),
	n(2, KICK, 1, { velocity: 0.85 }),
	n(4, SNARE, 1, { velocity: 1 }),
	n(7, SNARE, 1, { velocity: 0.5 }),
	n(9, SNARE, 1, { velocity: 0.6 }),
	n(10, KICK, 1, { velocity: 0.9 }),
	n(12, SNARE, 1, { velocity: 0.95 }),
	n(14, SNARE, 2, { velocity: 0.7, ratchet: 2 }),
	...hats8ths(),
];

const amenPatterns: Array<Array<NoteEvent>> = [
	// 1: classic amen A
	amenA(),
	// 2: amen B (flam ending)
	amenB(),
	// 3: chopped amen — busier but still on the grid
	[
		n(0, KICK, 1, { velocity: 1 }),
		n(2, SNARE, 1, { velocity: 0.7 }),
		n(3, KICK, 1, { velocity: 0.85 }),
		n(4, SNARE, 1, { velocity: 1 }),
		n(6, KICK, 1, { velocity: 0.85 }),
		n(7, SNARE, 1, { velocity: 0.55 }),
		n(8, KICK, 1, { velocity: 0.9 }),
		n(10, SNARE, 1, { velocity: 0.8 }),
		n(11, KICK, 1, { velocity: 0.8 }),
		n(12, SNARE, 1, { velocity: 1 }),
		n(14, SNARE, 2, { velocity: 0.7, ratchet: 2 }),
		...hats8ths(0.38),
	],
	// 4: small 4th-bar fill (kick + snare run)
	[
		n(0, KICK, 1, { velocity: 1 }),
		n(2, KICK, 1, { velocity: 0.85 }),
		n(4, SNARE, 1, { velocity: 1 }),
		n(7, SNARE, 1, { velocity: 0.5 }),
		n(8, KICK, 1, { velocity: 0.9 }),
		n(10, SNARE, 1, { velocity: 0.8 }),
		n(12, SNARE, 1, { velocity: 0.82 }),
		n(13, KICK, 1, { velocity: 0.82 }),
		n(14, SNARE, 1, { velocity: 0.88 }),
		n(15, SNARE, 1, { velocity: 0.9 }),
		...[0, 2, 4, 6, 8, 10].map((step) => n(step, HAT, 1, { velocity: 0.4 })),
	],
	// 5: section-end roll — short, rising, lands back on bar 1 of any section
	[
		n(0, KICK, 1, { velocity: 1 }),
		n(2, KICK, 1, { velocity: 0.85 }),
		n(4, SNARE, 1, { velocity: 1 }),
		n(6, KICK, 1, { velocity: 0.9 }),
		n(7, SNARE, 1, { velocity: 0.6 }),
		n(8, SNARE, 4, { velocity: 0.75, ratchet: 4, bend: 2 }),
		n(12, SNARE, 4, { velocity: 0.9, ratchet: 6, bend: 5 }),
		...[0, 2, 4, 6].map((step) => n(step, HAT, 1, { velocity: 0.4 })),
	],
	// 6: amen A with ghost-snare shuffle (section 3 groove)
	[
		...amenA(),
		n(1, SNARE, 1, { velocity: 0.3 }),
		n(13, SNARE, 1, { velocity: 0.35 }),
	],
];

// ─── Kick reinforcement (gabber, tamed) ──────────────────────────────────────
const kickPatterns: Array<Array<NoteEvent>> = [
	// 1: sparse — downbeat + push
	[n(0, KICK, 1, { velocity: 1 }), n(10, KICK, 1, { velocity: 0.75 })],
	// 2: light four-on-the-floor
	[0, 4, 8, 12].map((step) =>
		n(step, KICK, 1, { velocity: step === 0 ? 1 : 0.85 })
	),
	// 3: four-on-the-floor, drops out for the fill
	[n(0, KICK, 1, { velocity: 1 }), n(4, KICK, 1, { velocity: 0.85 })],
];

// ─── Hats & FX ───────────────────────────────────────────────────────────────
const fxPatterns: Array<Array<NoteEvent>> = [
	// 1: crash on the downbeat (section start)
	[n(0, OPEN_HAT, 2, { velocity: 0.9 })],
	// 2: offbeat open hats (dance lift)
	[2, 6, 10, 14].map((step) => n(step, OPEN_HAT, 1, { velocity: 0.55 })),
	// 3: crash + offbeat open hats
	[
		n(0, OPEN_HAT, 2, { velocity: 0.9 }),
		...[6, 10, 14].map((step) => n(step, OPEN_HAT, 1, { velocity: 0.55 })),
	],
	// 4: tiny zap pickup into the next phrase
	[n(14, ZAP, 1, { velocity: 0.55, bend: 5 })],
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

const SECTION = 16;
const silent = (count: number): Array<number> => cycle([0], count);

// Section 1 "Command" (0-15) · Section 2 "Clash" (16-31) · Section 3 "Rush" (32-47)
const leadSeq = [
	...HOOK_A_SEQ,
	...HOOK_A_SEQ,
	...HOOK_B_SEQ,
	...HOOK_B_SEQ,
	...HOOK_A_SEQ,
	...HOOK_B_SEQ,
];

const harmonySeq = [
	...silent(SECTION),
	...silent(8),
	...HOOK_B_SEQ,
	...HOOK_A_SEQ,
	...HOOK_B_SEQ,
];

const amenSeq = [
	// Section 1
	...cycle([1, 2, 1, 4], 12),
	1,
	2,
	1,
	5,
	// Section 2
	...cycle([1, 3, 2, 4], 12),
	1,
	3,
	2,
	5,
	// Section 3
	...cycle([6, 3, 6, 4], 12),
	6,
	3,
	6,
	5,
];

const kickSeq = [
	...silent(SECTION),
	...cycle([1], SECTION),
	...cycle([2, 2, 2, 3], SECTION),
];

const fxSeq = [
	// Section 1: crash on each 8-bar phrase, zap pickups
	1, 0, 0, 4, 0, 0, 0, 4, 1, 0, 0, 4, 0, 0, 0, 0,
	// Section 2
	1, 0, 0, 4, 0, 0, 0, 4, 1, 0, 0, 4, 0, 0, 0, 0,
	// Section 3: offbeat open hats all the way
	3, 2, 2, 2, 2, 2, 2, 2, 3, 2, 2, 2, 2, 2, 2, 0,
];

/** Section loop ranges (0-indexed, inclusive) for in-game section switching. */
export const BREAKCORE_BATTLE_V1_SECTIONS = [
	{ name: "Command", startBar: 0, endBar: 15 },
	{ name: "Clash", startBar: 16, endBar: 31 },
	{ name: "Rush", startBar: 32, endBar: 47 },
] as const;

export const breakcoreBattleV1Song: SongProject = {
	id: "demo-breakcore-battle-v1",
	title: "Breakcore Battle v1",
	author: "UltraBeep Demo",
	bpm: 174,
	beatsPerBar: 4,
	stepsPerBeat: 4,
	totalBars: SECTION * 3,
	loopStartBar: 0,
	loopEndBar: SECTION * 3 - 1,
	swing: 0,
	rootKey: "A",
	scale: "major",
	masterVolume: 0.72,
	sections: BREAKCORE_BATTLE_V1_SECTIONS.map((section) => ({
		id: `bb-section-${section.name.toLowerCase()}`,
		name: section.name,
		startBar: section.startBar,
		endBar: section.endBar,
	})),
	updatedAt: 1763740000000,
	channels: [
		makeChannel(
			"bb-lead",
			"Candy Lead",
			"pitch",
			"#f472b6",
			"nes-pulse-25",
			leadSeq,
			leadPatterns,
			{
				volume: 0.5,
				pan: 0,
				attack: 0.004,
				decay: 0.14,
				sustain: 0.62,
				release: 0.07,
				filterCutoff: 4600,
				vibratoDepth: 6,
				vibratoSpeed: 5.5,
				echoMix: 0.16,
				echoTimeSeconds: 0.259,
				detuneCents: 0,
			}
		),
		makeChannel(
			"bb-harmony",
			"Harmony",
			"pitch",
			"#fbcfe8",
			"gb-square-50",
			harmonySeq,
			harmonyPatterns,
			{ volume: 0.3, pan: 0.25, filterCutoff: 3600, echoMix: 0.1 }
		),
		makeChannel(
			"bb-stab",
			"Offbeat Stab",
			"pitch",
			"#38bdf8",
			"retro-dance-stab",
			[
				...cycle([1, 2, 3, 4], SECTION),
				...cycle([1, 2, 3, 4], SECTION),
				...cycle([5, 6, 7, 8], SECTION),
			],
			stabPatterns,
			{ volume: 0.3, pan: -0.22, echoMix: 0.18, echoTimeSeconds: 0.259 }
		),
		makeChannel(
			"bb-arp",
			"Glitch Arp",
			"pitch",
			"#22d3ee",
			"breakcore-glitch-arp",
			[
				...silent(8),
				...cycle([1, 2, 3, 4], 8),
				...cycle([1, 2, 3, 4], SECTION),
				...cycle([1, 2, 3, 4], SECTION),
			],
			arpPatterns,
			{ volume: 0.24, pan: 0.32 }
		),
		makeChannel(
			"bb-pad",
			"Glass Pad",
			"pitch",
			"#a78bfa",
			"breakcore-glass-pad",
			cycle([1, 2, 3, 4], SECTION * 3),
			padPatterns,
			{ volume: 0.24 }
		),
		makeChannel(
			"bb-reese",
			"Reese Bass",
			"pitch",
			"#fb7185",
			"breakcore-reese-bass",
			[...silent(SECTION), ...cycle([1, 2, 3, 4], SECTION * 2)],
			reesePatterns,
			{ volume: 0.42, drive: 0.4, filterCutoff: 1200 }
		),
		makeChannel(
			"bb-tri",
			"Triangle Bass",
			"pitch",
			"#ff9233",
			"dance-triangle-bass",
			[...cycle([1, 2, 3, 4], SECTION), ...cycle([5, 6, 7, 8], SECTION * 2)],
			triPatterns,
			{ volume: 0.82 }
		),
		makeChannel(
			"bb-amen",
			"Amen Break",
			"drum",
			"#facc15",
			"breakcore-amen-kit",
			amenSeq,
			amenPatterns,
			{ volume: 0.86 }
		),
		makeChannel(
			"bb-kick",
			"Gabber Kick",
			"drum",
			"#ef4444",
			"breakcore-gabber-kick",
			kickSeq,
			kickPatterns,
			{ volume: 0.5, drive: 0.5 }
		),
		makeChannel(
			"bb-fx",
			"Hats & FX",
			"drum",
			"#34d399",
			"breakcore-amen-kit",
			fxSeq,
			fxPatterns,
			{ volume: 0.55, drive: 0.1, pan: 0.15 }
		),
	],
};

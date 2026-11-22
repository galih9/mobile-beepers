import type {
	Channel,
	NoteArticulation,
	NoteEvent,
	Pattern,
	SongProject,
} from "../types/music";
import { getPresetConfigurationById } from "./instrumentPresets";

/**
 * "Shattered Halo" — 48-bar, 175 BPM F#-minor breakcore battle loop (~66 s),
 * drum-first, in the spirit of sewerslvt / hkmori: crushed, glued breaks and a
 * distorted 808 that IS the kick (it plays the chord roots on the kick hits),
 * under ONE simple, repeated piano motif with real silence after every
 * phrase, soft piano chords, call-and-response vocal chops and a lush pad.
 *
 * Drums lead the mix (breaks + 808 louder than the melody, like the genre).
 * Stutters are used ONLY as drum rolls in fills; no pitch bends anywhere and
 * nothing stutters in the melodic parts.
 *
 * Harmony — one 8-bar cycle for every section (sections swap seamlessly):
 *   F#m9 – Dmaj7 – A – E | Bm7 – Dmaj7 – C#m7 – C#7
 *   i – VI – III – VII | iv – VI – v – V7  (C#7's E# pulls home to F#m)
 *
 * Sections (bars 0-indexed, 16 bars ≈ 22 s each, each loops on its own)
 *  0-15   "Halo"     Half-time heavy break + long 808s, NO lead (bars 1-8),
 *                     then the full amen with 808 kicks and the piano motif.
 *  16-31  "Shatter"  Chopped breaks, 808 with octave jumps, reese; the lead
 *                     plays only phrases 1 & 3, the vocal chops answer.
 *  32-47  "Rapture"  808 four-on-the-floor under ghost-note amen, open hats,
 *                     the full motif with a tiny chop echo in its rests.
 */

// Drum pads (Heavy Break Kit)
const KICK = 0;
const SNARE = 1;
const HAT = 2;
const CRASH = 3;
const LOW_TOM = 4;
const HIGH_TOM = 5;
const OPEN_HAT = 6;
const CHOP = 7;

interface NoteOptions {
	velocity?: number;
	articulation?: NoteArticulation;
	ratchet?: number;
	cutoff?: number;
	sweepTo?: number;
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
		id: `sh-${noteCounter}-${step}-${pitch}`,
		step,
		pitch,
		duration,
		velocity: options.velocity ?? 0.9,
		pitchBend: 0,
		...(options.articulation ? { articulation: options.articulation } : {}),
		...(options.ratchet && options.ratchet > 1
			? { ratchet: options.ratchet }
			: {}),
		...(options.cutoff !== undefined ? { filterCutoff: options.cutoff } : {}),
		...(options.sweepTo !== undefined
			? { filterSweepTo: options.sweepTo }
			: {}),
	};
};

/** Bars (null = silent) → pattern dictionary + bar sequence, reusing identical bars. */
const buildTrack = (
	bars: Array<Array<NoteEvent> | null>
): { patterns: Record<string, Pattern>; barSequence: Array<number> } => {
	const patterns: Record<string, Pattern> = {};
	const signatures: Array<string> = [];
	const barSequence = bars.map((notes) => {
		if (!notes || notes.length === 0) {
			return 0;
		}
		const signature = JSON.stringify(
			notes.map((note) => ({ ...note, id: undefined }))
		);
		const existing = signatures.indexOf(signature);
		if (existing >= 0) {
			return existing + 1;
		}
		signatures.push(signature);
		const index = signatures.length;
		patterns[String(index)] = { index, notes };
		return index;
	});
	return { patterns, barSequence };
};

// ─── Pitches (F# minor: F# G# A B C# D E, borrowed E# in C#7) ────────────────
const Cs2 = 37;
const D2 = 38;
const E2 = 40;
const Fs2 = 42;
const A2 = 45;
const B2 = 47;
const Fs3 = 54;
const Gs3 = 56;
const A3 = 57;
const B3 = 59;
const Cs4 = 61;
const D4 = 62;
const E4 = 64;
const Es4 = 65;
const Fs4 = 66;
const Gs4 = 68;
const Cs5 = 73;
const D5 = 74;
const E5 = 76;
const Es5 = 77;
const Fs5 = 78;
const Gs5 = 80;
const A5 = 81;
const B5 = 83;

// ─── Harmony ─────────────────────────────────────────────────────────────────
type ChordName = "F#m9" | "Dmaj7" | "A" | "E" | "Bm7" | "C#m7" | "C#7";

interface ChordShape {
	/** Pitch classes allowed on strong steps (incl. 7ths / 9ths) */
	tones: Array<number>;
	/** 808 / bass root */
	root: number;
	/** Mid-register voicing (piano, pad, vocal chops) — always below the lead */
	voicing: Array<number>;
}

export const HALO_CHORDS: Record<ChordName, ChordShape> = {
	"F#m9": { tones: [6, 9, 1, 4, 8], root: Fs2, voicing: [A3, Cs4, E4, Gs4] },
	Dmaj7: { tones: [2, 6, 9, 1, 4], root: D2, voicing: [A3, Cs4, Fs4] },
	A: { tones: [9, 1, 4, 11], root: A2, voicing: [A3, Cs4, E4] },
	E: { tones: [4, 8, 11, 6], root: E2, voicing: [Gs3, B3, E4] },
	Bm7: { tones: [11, 2, 6, 9, 1], root: B2, voicing: [Fs3, A3, D4] },
	"C#m7": { tones: [1, 4, 8, 11], root: Cs2, voicing: [Gs3, B3, E4] },
	"C#7": { tones: [1, 5, 8, 11], root: Cs2, voicing: [Gs3, B3, Es4] },
};

const CYCLE: Array<ChordName> = [
	"F#m9",
	"Dmaj7",
	"A",
	"E",
	"Bm7",
	"Dmaj7",
	"C#m7",
	"C#7",
];

const TOTAL_BARS = 48;

/** Chord of every bar (exported for the music-theory test) */
export const HALO_CHORD_CHART: Array<ChordName> = Array.from(
	{ length: TOTAL_BARS },
	(_, bar) => CYCLE[bar % 8] ?? "F#m9"
);

const chordAt = (bar: number): ChordShape =>
	HALO_CHORDS[HALO_CHORD_CHART[bar] ?? "F#m9"];

// ─── Melody (clean piano lead) ───────────────────────────────────────────────
type Phrase = Array<
	[step: number, pitch: number, duration: number, options?: NoteOptions]
>;

const HOLD = (velocity: number): NoteOptions => ({
	articulation: "tenuto",
	velocity,
});

/**
 * ONE motif, repeated so the ear can hold on to it ("rhyme"):
 *   "da-da DAAA … DAAA" — two 8th pickups leaping up to a held note, then a
 *   held answer note, then SILENCE (half a bar) before the next phrase.
 * Bars 1 and 3 are identical (only the chord changes underneath), bar 5
 * moves the same cell up a step, bar 7 a step higher again (the B5 peak) and
 * walks down. Every 2-bar phrase ends with 8 steps (~0.7 s) of rest.
 */
const MOTIF: Array<Phrase> = [
	// F#m9 — call
	[
		[0, Cs5, 2, { velocity: 0.78 }],
		[2, E5, 2, { velocity: 0.82 }],
		[4, A5, 8, HOLD(0.9)],
	],
	// Dmaj7 — answer note, then rest
	[[0, Fs5, 8, HOLD(0.84)]],
	// A — the call again, exactly
	[
		[0, Cs5, 2, { velocity: 0.78 }],
		[2, E5, 2, { velocity: 0.82 }],
		[4, A5, 8, HOLD(0.9)],
	],
	// E — answer, then rest
	[[0, Gs5, 8, HOLD(0.84)]],
	// Bm7 — same cell, a step higher
	[
		[0, D5, 2, { velocity: 0.8 }],
		[2, Fs5, 2, { velocity: 0.84 }],
		[4, A5, 8, HOLD(0.9)],
	],
	// Dmaj7 — same answer as bar 2 (rhyme)
	[[0, Fs5, 8, HOLD(0.84)]],
	// C#m7 — cell a step higher again: the peak, then it walks down
	[
		[0, E5, 2, { velocity: 0.82 }],
		[2, Gs5, 2, { velocity: 0.86 }],
		[4, B5, 6, { articulation: "accent", velocity: 0.94 }],
		[10, A5, 2, { velocity: 0.76 }],
		[12, Gs5, 4, HOLD(0.82)],
	],
	// C#7 — leading tone E#, then rest; pulls back to F#m at the loop
	[[0, Es5, 8, HOLD(0.84)]],
];

const phraseNotes = (phrase: Phrase | undefined): Array<NoteEvent> =>
	(phrase ?? []).map(([step, pitch, duration, options]) =>
		n(step, pitch, duration, { velocity: 0.8, ...options })
	);

// ─── Section helpers ─────────────────────────────────────────────────────────
const bars = (
	build: (bar: number) => Array<NoteEvent> | null
): Array<Array<NoteEvent> | null> =>
	Array.from({ length: TOTAL_BARS }, (_, bar) => build(bar));
const inRange = (bar: number, start: number, end: number): boolean =>
	bar >= start && bar <= end;
const HALO = [0, 15] as const;
const SHATTER = [16, 31] as const;
const RAPTURE = [32, 47] as const;
const inHalo = (bar: number): boolean => inRange(bar, ...HALO);
const inShatter = (bar: number): boolean => inRange(bar, ...SHATTER);
const inRapture = (bar: number): boolean => inRange(bar, ...RAPTURE);

/** In Shatter the lead only plays the 1st and 3rd phrase of each 8 bars; the vocal chops answer the rest. */
const isShatterAnswerBar = (bar: number): boolean =>
	inShatter(bar) && (bar % 8 === 2 || bar % 8 === 3 || bar % 8 >= 6);

// ─── Melodic parts ───────────────────────────────────────────────────────────
/**
 * Lead: silent for the first 8 bars (the breaks + chords breathe), motif in
 * Halo 9-16, only phrases 1 & 3 in Shatter (chops answer), full motif in Rapture.
 */
const lead = buildTrack(
	bars((bar) => {
		if (inRange(bar, 0, 7) || isShatterAnswerBar(bar)) {
			return null;
		}
		return phraseNotes(MOTIF[bar % 8]);
	})
);

/** Piano chords: a low, soft left hand on beats 1 and 3 — never in the lead's register */
const piano = buildTrack(
	bars((bar) => {
		const { voicing } = chordAt(bar);
		return [0, 8].flatMap((step) =>
			voicing.map((pitch) =>
				n(step, pitch, 8, {
					velocity: step === 0 ? 0.7 : 0.54,
					articulation: "tenuto",
				})
			)
		);
	})
);

const pad = buildTrack(
	bars((bar) =>
		chordAt(bar).voicing.map((pitch) =>
			n(0, pitch, 16, { velocity: inHalo(bar) ? 0.5 : 0.44 })
		)
	)
);

/**
 * Vocal chops — call and response, never on top of the lead:
 *  · Shatter answer bars: they sing the motif's rhythm back on chord tones.
 *  · Rapture: one small two-hit echo in the lead's rest (2nd bar of a phrase).
 */
const chops = buildTrack(
	bars((bar) => {
		const { voicing } = chordAt(bar);
		const top = voicing[voicing.length - 1] ?? E4;
		const middle = voicing[voicing.length - 2] ?? Cs4;
		if (isShatterAnswerBar(bar)) {
			return bar % 2 === 0
				? [
						n(0, middle, 2, { velocity: 0.7 }),
						n(2, top, 2, { velocity: 0.76 }),
						n(4, top, 6, { velocity: 0.82 }),
					]
				: [n(0, middle, 6, { velocity: 0.74 })];
		}
		if (inRapture(bar) && bar % 2 === 1) {
			return [
				n(10, top, 2, { velocity: 0.7 }),
				n(12, middle, 3, { velocity: 0.62 }),
			];
		}
		return null;
	})
);

// ─── 808 (kick + bass in one, on the chord roots) ────────────────────────────
const halfTime808 = (root: number): Array<NoteEvent> => [
	n(0, root, 7, { velocity: 1 }),
	n(10, root, 1, { velocity: 0.85 }),
	n(11, root, 5, { velocity: 0.9 }),
];
const amen808 = (root: number): Array<NoteEvent> => [
	n(0, root, 2, { velocity: 1 }),
	n(2, root, 7, { velocity: 0.88 }),
	n(10, root, 1, { velocity: 0.85 }),
	n(11, root, 5, { velocity: 0.9 }),
];
const chop808 = (root: number): Array<NoteEvent> => [
	n(0, root, 3, { velocity: 1 }),
	n(3, root, 3, { velocity: 0.86 }),
	n(6, root + 12, 4, { velocity: 0.82 }),
	n(10, root, 6, { velocity: 0.92 }),
];
const floor808 = (root: number): Array<NoteEvent> =>
	[0, 4, 8, 12].map((step) =>
		n(step, root, 3, { velocity: step === 0 ? 1 : 0.88 })
	);
const sub808 = buildTrack(
	bars((bar) => {
		const { root } = chordAt(bar);
		if (inRange(bar, 0, 7)) return halfTime808(root);
		if (inRange(bar, 8, 15)) return amen808(root);
		if (inShatter(bar)) return chop808(root);
		// Rapture: four-on-the-floor, drops out under the end-of-section roll
		return bar === 47 ? [n(0, root, 3, { velocity: 1 })] : floor808(root);
	})
);

// Reese an octave above the 808 (Shatter, Rapture) — filter sweeps only
const reese = buildTrack(
	bars((bar) => {
		if (!(inShatter(bar) || inRapture(bar))) {
			return null;
		}
		const root = chordAt(bar).root + 12;
		return [
			n(0, root, 3, { velocity: 0.85, cutoff: 500, sweepTo: 2200 }),
			n(3, root, 2, { velocity: 0.7 }),
			n(6, root, 2, { velocity: 0.78, cutoff: 1600, sweepTo: 600 }),
			n(8, root, 3, { velocity: 0.82 }),
			n(11, root, 1, { velocity: 0.7 }),
			n(12, root, 4, { velocity: 0.8, cutoff: 600, sweepTo: 2600 }),
		];
	})
);

// ─── Breaks (Heavy Break Kit) ────────────────────────────────────────────────
const hats8 = (velocity = 0.5): Array<NoteEvent> =>
	[0, 2, 4, 6, 8, 10, 12, 14].map((step) => n(step, HAT, 1, { velocity }));
const hats16 = (): Array<NoteEvent> =>
	Array.from({ length: 16 }, (_, step) =>
		n(step, HAT, 1, { velocity: step % 2 === 0 ? 0.5 : 0.3 })
	);

/** Half-time: big snare on beat 3 */
const halfTime = (): Array<NoteEvent> => [
	n(0, KICK, 1, { velocity: 1 }),
	n(8, SNARE, 1, { velocity: 1 }),
	n(10, KICK, 1, { velocity: 0.85 }),
	n(11, KICK, 1, { velocity: 0.7 }),
	n(13, SNARE, 1, { velocity: 0.32 }),
	n(15, SNARE, 1, { velocity: 0.42 }),
	...hats8(0.48),
];

const amenA = (): Array<NoteEvent> => [
	n(0, KICK, 1, { velocity: 1 }),
	n(2, KICK, 1, { velocity: 0.85 }),
	n(4, SNARE, 1, { velocity: 1 }),
	n(7, SNARE, 1, { velocity: 0.45 }),
	n(9, SNARE, 1, { velocity: 0.55 }),
	n(10, KICK, 1, { velocity: 0.9 }),
	n(11, KICK, 1, { velocity: 0.75 }),
	n(12, SNARE, 1, { velocity: 1 }),
	n(15, SNARE, 1, { velocity: 0.45 }),
	...hats8(),
];

const amenB = (): Array<NoteEvent> => [
	n(0, KICK, 1, { velocity: 1 }),
	n(2, KICK, 1, { velocity: 0.85 }),
	n(4, SNARE, 1, { velocity: 1 }),
	n(7, SNARE, 1, { velocity: 0.45 }),
	n(9, SNARE, 1, { velocity: 0.55 }),
	n(10, KICK, 1, { velocity: 0.9 }),
	n(12, SNARE, 1, { velocity: 0.95 }),
	n(14, SNARE, 1, { velocity: 0.7 }),
	n(15, SNARE, 1, { velocity: 0.55 }),
	...hats8(),
];

/** Chopped slices — the snare jumps around, kick+snare "chop" hits */
const chopA = (): Array<NoteEvent> => [
	n(0, KICK, 1, { velocity: 1 }),
	n(2, SNARE, 1, { velocity: 0.6 }),
	n(3, KICK, 1, { velocity: 0.85 }),
	n(4, SNARE, 1, { velocity: 1 }),
	n(6, KICK, 1, { velocity: 0.85 }),
	n(7, SNARE, 1, { velocity: 0.45 }),
	n(10, SNARE, 1, { velocity: 0.85 }),
	n(11, KICK, 1, { velocity: 0.8 }),
	n(12, SNARE, 1, { velocity: 1 }),
	n(14, CHOP, 1, { velocity: 0.85 }),
	n(15, SNARE, 1, { velocity: 0.55 }),
	...hats16(),
];

const chopB = (): Array<NoteEvent> => [
	n(0, KICK, 1, { velocity: 1 }),
	n(1, SNARE, 1, { velocity: 0.3 }),
	n(4, SNARE, 1, { velocity: 1 }),
	n(5, KICK, 1, { velocity: 0.75 }),
	n(6, SNARE, 1, { velocity: 0.6 }),
	n(7, KICK, 1, { velocity: 0.8 }),
	n(8, SNARE, 1, { velocity: 0.9 }),
	n(10, KICK, 1, { velocity: 0.9 }),
	n(12, SNARE, 1, { velocity: 1 }),
	n(13, SNARE, 1, { velocity: 0.4 }),
	n(14, SNARE, 1, { velocity: 0.75 }),
	n(15, KICK, 1, { velocity: 0.65 }),
	...hats16(),
];

/** Rapture groove: amen with ghost notes and offbeat open hats */
const raptureGroove = (): Array<NoteEvent> => [
	...amenA(),
	n(1, SNARE, 1, { velocity: 0.3 }),
	n(5, SNARE, 1, { velocity: 0.28 }),
	n(13, SNARE, 1, { velocity: 0.35 }),
	...[6, 14].map((step) => n(step, OPEN_HAT, 1, { velocity: 0.5 })),
];

/** 8th-bar fill: toms then a 32nd snare roll (drum-only stutter) */
const fill = (): Array<NoteEvent> => [
	n(0, KICK, 1, { velocity: 1 }),
	n(2, KICK, 1, { velocity: 0.85 }),
	n(4, SNARE, 1, { velocity: 1 }),
	n(6, KICK, 1, { velocity: 0.85 }),
	n(7, SNARE, 1, { velocity: 0.5 }),
	n(8, HIGH_TOM, 1, { velocity: 0.85 }),
	n(9, HIGH_TOM, 1, { velocity: 0.7 }),
	n(10, LOW_TOM, 1, { velocity: 0.9 }),
	n(11, LOW_TOM, 1, { velocity: 0.75 }),
	n(12, SNARE, 4, { velocity: 0.78, ratchet: 6 }),
	...[0, 2, 4, 6].map((step) => n(step, HAT, 1, { velocity: 0.5 })),
];

/** Section-end roll: 16ths then 32nds, lands on bar 1 of any section */
const sectionRoll = (): Array<NoteEvent> => [
	n(0, KICK, 1, { velocity: 1 }),
	n(2, KICK, 1, { velocity: 0.85 }),
	n(4, SNARE, 1, { velocity: 1 }),
	n(6, KICK, 1, { velocity: 0.9 }),
	n(7, SNARE, 1, { velocity: 0.6 }),
	n(8, SNARE, 4, { velocity: 0.72, ratchet: 4 }),
	n(12, SNARE, 4, { velocity: 0.9, ratchet: 8 }),
	...[0, 2, 4, 6].map((step) => n(step, HAT, 1, { velocity: 0.5 })),
];

const breaks = buildTrack(
	bars((bar) => {
		const local = bar % 16;
		if (local === 15) return sectionRoll();
		if (local === 7) return fill();
		if (inRange(bar, 0, 7)) return halfTime();
		if (inRange(bar, 8, 15)) return [amenA, amenB, amenA, amenB][local % 4]!();
		if (inShatter(bar)) return [chopA, chopB, chopA, amenB][local % 4]!();
		return [raptureGroove, chopA, raptureGroove, chopB][local % 4]!();
	})
);

// Crashes on each 8-bar phrase, ride-crash on the Rapture backbeats
const cymbals = buildTrack(
	bars((bar) => {
		const notes: Array<NoteEvent> = [];
		if (bar % 8 === 0) notes.push(n(0, CRASH, 2, { velocity: 0.95 }));
		if (inRapture(bar) && bar % 16 !== 15) {
			notes.push(n(4, CRASH, 1, { velocity: 0.32 }));
			notes.push(n(12, CRASH, 1, { velocity: 0.32 }));
		}
		return notes.length > 0 ? notes : null;
	})
);

// ─── Channels ────────────────────────────────────────────────────────────────
const makeChannel = (
	id: string,
	name: string,
	type: Channel["type"],
	color: string,
	presetId: string,
	track: { patterns: Record<string, Pattern>; barSequence: Array<number> },
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
	barSequence: track.barSequence,
	patterns: track.patterns,
});

/** Section loop ranges (0-indexed, inclusive) for in-game section switching. */
export const HALO_SECTIONS = [
	{ name: "Halo", startBar: HALO[0], endBar: HALO[1] },
	{ name: "Shatter", startBar: SHATTER[0], endBar: SHATTER[1] },
	{ name: "Rapture", startBar: RAPTURE[0], endBar: RAPTURE[1] },
] as const;

export const breakcoreShatteredHaloSong: SongProject = {
	id: "demo-breakcore-shattered-halo-175",
	title: "Shattered Halo",
	author: "UltraBeep Demo",
	bpm: 175,
	beatsPerBar: 4,
	stepsPerBeat: 4,
	totalBars: TOTAL_BARS,
	loopStartBar: 0,
	loopEndBar: TOTAL_BARS - 1,
	swing: 0,
	rootKey: "F#",
	scale: "minor",
	masterVolume: 0.6,
	sections: HALO_SECTIONS.map((section) => ({
		id: `sh-section-${section.name.toLowerCase()}`,
		name: section.name,
		startBar: section.startBar,
		endBar: section.endBar,
	})),
	updatedAt: 1763820000000,
	channels: [
		makeChannel(
			"sh-breaks",
			"Heavy Breaks",
			"drum",
			"#facc15",
			"breakcore-heavy-break-kit",
			breaks,
			{ volume: 0.8 }
		),
		makeChannel(
			"sh-808",
			"Distorted 808",
			"pitch",
			"#ef4444",
			"breakcore-808",
			sub808,
			{ volume: 0.38 }
		),
		makeChannel(
			"sh-cymbals",
			"Cymbals",
			"drum",
			"#34d399",
			"breakcore-heavy-break-kit",
			cymbals,
			{ volume: 0.5, punch: 0.3, pan: 0.18, reverbMix: 0.2 }
		),
		makeChannel(
			"sh-lead",
			"Piano Lead",
			"pitch",
			"#f9a8d4",
			"cinematic-felt-piano",
			lead,
			{
				volume: 0.9,
				pan: 0,
				filterCutoff: 9000,
				release: 0.45,
				echoMix: 0,
				reverbMix: 0.28,
			}
		),
		makeChannel(
			"sh-piano",
			"Piano Chords",
			"pitch",
			"#fde68a",
			"cinematic-felt-piano",
			piano,
			{
				volume: 0.2,
				pan: -0.12,
				filterCutoff: 9000,
				release: 0.3,
				echoMix: 0,
				reverbMix: 0.3,
			}
		),
		makeChannel(
			"sh-chops",
			"Vocal Chops",
			"pitch",
			"#a5f3fc",
			"breakcore-vocal-chop",
			chops,
			{ volume: 1, echoMix: 0.12 }
		),
		makeChannel(
			"sh-pad",
			"Dream Pad",
			"pitch",
			"#c4b5fd",
			"cinematic-strings",
			pad,
			{
				volume: 0.3,
				pan: 0.1,
				attack: 0.3,
				release: 1.0,
				filterCutoff: 3000,
				reverbMix: 0.55,
			}
		),
		makeChannel(
			"sh-reese",
			"Reese",
			"pitch",
			"#fb7185",
			"breakcore-reese-bass",
			reese,
			{ volume: 0.38, drive: 0.45, filterCutoff: 1400 }
		),
	],
};

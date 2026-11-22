import type {
	Channel,
	NoteArticulation,
	NoteEvent,
	NoteOrnament,
	Pattern,
	SongProject,
} from "../types/music";
import { getPresetConfigurationById } from "./instrumentPresets";

/**
 * "Petals in the Static" — 48-bar, 172 BPM G-minor breakcore battle loop (~67 s)
 * in the emotional, dreamy style of modern breakcore (sewerslvt / hkmori):
 * fast amen breaks and a heavy reese under a bold felt-piano hook, a long,
 * soothing string melody, a lush pad and a choir, all in a hall reverb.
 *
 * No stutters (ratchets) and no pitch bends anywhere — the energy comes from
 * the breaks, the bass and the arrangement, so the melody stays clean over
 * long turn-based fights.
 *
 * Harmony — one 8-bar cycle for every section, so sections swap seamlessly:
 *   E♭maj7 – F – Dm7 – Gm(add9) | Cm7 – F – B♭maj7 – D7
 *   VI – VII – v – i | iv – VII – III – V7
 * D7 (with the borrowed F#) pulls back into E♭maj7 at the loop: a deceptive
 * V → VI cadence, so the loop feels like it "almost" resolves — melancholic,
 * and it keeps the fight moving.
 *
 * Sections (bars 0-indexed, 16 bars ≈ 22 s each, each loops on its own)
 *  0-15   "Petals"  Bold piano hook (octave-doubled on the repeat), offbeat
 *                    piano chords, bouncy triangle bass, classic amen breaks.
 *  16-31  "Static"  Long soothing string melody; the piano turns to rolling
 *                    8th arpeggios under it; reese + sub bass, jungle break;
 *                    choir joins for the second half.
 *  32-47  "Bloom"   Everything: piano hook with a long string counter-line
 *                    below it, choir, gabber four-on-the-floor, ride hats.
 *
 * Music rules applied (see the project's fundamentals guide): chord tones on
 * steps 0/4/8/12 of the lead, a breath at the end of every 2-bar phrase, one
 * peak per 8 bars (B♭5 in the hook, B♭5 / C6 in the long melody), the same
 * 3+3+2 hook rhythm throughout, staccato pickups / tenuto targets on the piano,
 * legato only on touching stepwise string notes, the counter-line stays below
 * the lead and moves in long notes.
 */

// Drum pad aliases (pad numbers are shared by every kit)
const KICK = 0;
const SNARE = 1;
const HAT = 2;
const CRASH = 3;
const LOW_TOM = 4;
const HIGH_TOM = 5;

interface NoteOptions {
	velocity?: number;
	articulation?: NoteArticulation;
	ornament?: NoteOrnament;
	cutoff?: number;
	sweepTo?: number;
	timing?: number;
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
		id: `pt-${noteCounter}-${step}-${pitch}`,
		step,
		pitch,
		duration,
		velocity: options.velocity ?? 0.9,
		pitchBend: 0,
		...(options.articulation ? { articulation: options.articulation } : {}),
		...(options.ornament ? { ornament: options.ornament } : {}),
		...(options.cutoff !== undefined ? { filterCutoff: options.cutoff } : {}),
		...(options.sweepTo !== undefined
			? { filterSweepTo: options.sweepTo }
			: {}),
		...(options.timing ? { timingOffset: options.timing } : {}),
	};
};

/**
 * Turns a list of bars (null = silent bar) into a pattern dictionary plus a
 * bar sequence, re-using identical bars as the same pattern.
 */
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

// ─── Pitches (G minor: G A B♭ C D E♭ F, borrowed F# in D7) ───────────────────
const C2 = 36;
const D2 = 38;
const Eb2 = 39;
const F2 = 41;
const G2 = 43;
const Bb2 = 46;
const F3 = 53;
const Fs3 = 54;
const G3 = 55;
const A3 = 57;
const Bb3 = 58;
const C4 = 60;
const D4 = 62;
const Eb4 = 63;
const F4 = 65;
const Fs4 = 66;
const G4 = 67;
const A4 = 69;
const Bb4 = 70;
const C5 = 72;
const D5 = 74;
const Eb5 = 75;
const F5 = 77;
const Fs5 = 78;
const G5 = 79;
const A5 = 81;
const Bb5 = 82;
const C6 = 84;

// ─── Harmony ─────────────────────────────────────────────────────────────────
type ChordName =
	| "Ebmaj7"
	| "F"
	| "Dm7"
	| "Gm"
	| "Cm7"
	| "Bbmaj7"
	| "D7";

interface ChordShape {
	/** Pitch classes that count as chord tones on strong steps (incl. 7ths / 9ths) */
	tones: Array<number>;
	bass: number;
	/** Mid-register voicing for piano chords, pad and choir (moves by step) */
	voicing: Array<number>;
	/** Pad colour tone (7th / 9th) added on top of the voicing */
	color?: number;
	/** Rolling piano arpeggio tones, low → high (5 notes, under the melody) */
	arp: [number, number, number, number, number];
	/** Long guide-tone counter-line note (Bloom section) */
	guide: number;
}

export const PETALS_CHORDS: Record<ChordName, ChordShape> = {
	Ebmaj7: {
		tones: [3, 7, 10, 2, 5],
		bass: Eb2,
		voicing: [G3, Bb3, D4],
		color: F4,
		arp: [G3, Bb3, D4, Eb4, G4],
		guide: G4,
	},
	F: {
		tones: [5, 9, 0, 7, 3],
		bass: F2,
		voicing: [A3, C4, F4],
		color: G4,
		arp: [A3, C4, F4, G4, A4],
		guide: F4,
	},
	Dm7: {
		tones: [2, 5, 9, 0],
		bass: D2,
		voicing: [A3, C4, F4],
		arp: [A3, C4, D4, F4, A4],
		guide: F4,
	},
	Gm: {
		tones: [7, 10, 2, 9],
		bass: G2,
		voicing: [Bb3, D4, G4],
		color: A4,
		arp: [G3, Bb3, D4, G4, A4],
		guide: D4,
	},
	Cm7: {
		tones: [0, 3, 7, 10, 2],
		bass: C2,
		voicing: [Bb3, Eb4, G4],
		arp: [G3, C4, Eb4, G4, Bb4],
		guide: Eb4,
	},
	Bbmaj7: {
		tones: [10, 2, 5, 9],
		bass: Bb2,
		voicing: [A3, D4, F4],
		arp: [F3, Bb3, D4, F4, A4],
		guide: D4,
	},
	D7: {
		tones: [2, 6, 9, 0],
		bass: D2,
		voicing: [A3, C4, Fs4],
		arp: [Fs3, A3, C4, D4, Fs4],
		guide: Fs4,
	},
};

const CYCLE: Array<ChordName> = [
	"Ebmaj7",
	"F",
	"Dm7",
	"Gm",
	"Cm7",
	"F",
	"Bbmaj7",
	"D7",
];

const TOTAL_BARS = 48;

/** Chord of every bar (exported for the music-theory test) */
export const PETALS_CHORD_CHART: Array<ChordName> = Array.from(
	{ length: TOTAL_BARS },
	(_, bar) => CYCLE[bar % 8] ?? "Ebmaj7"
);

const chordAt = (bar: number): ChordShape =>
	PETALS_CHORDS[PETALS_CHORD_CHART[bar] ?? "Ebmaj7"];

// ─── Melodies ────────────────────────────────────────────────────────────────
type Phrase = Array<
	[step: number, pitch: number, duration: number, options?: NoteOptions]
>;

const ACCENT = { articulation: "accent" as const, velocity: 0.92 };
const PICKUP = { articulation: "staccato" as const, velocity: 0.74 };
const TARGET = { articulation: "tenuto" as const, velocity: 0.86 };

/**
 * Bold piano hook — the 3+3+2 bounce of Breakcore Battle v1, period form:
 * bars 1-4 state and settle on D (5th) over Gm, bars 5-8 repeat the shape a
 * step higher, peak on B♭5 and end open on F# over D7.
 */
const PIANO_HOOK: Array<Phrase> = [
	// E♭maj7
	[
		[0, G5, 3, ACCENT],
		[3, F5, 3, { velocity: 0.8 }],
		[6, D5, 2, PICKUP],
		[8, Bb4, 4, TARGET],
		[12, D5, 2, { velocity: 0.78 }],
		[14, Eb5, 2, PICKUP],
	],
	// F
	[
		[0, F5, 3, { velocity: 0.88 }],
		[3, Eb5, 3, { velocity: 0.78 }],
		[6, C5, 2, PICKUP],
		[8, A4, 6, TARGET],
	],
	// Dm7
	[
		[0, D5, 3, { velocity: 0.86 }],
		[3, F5, 3, { velocity: 0.8 }],
		[6, A5, 2, PICKUP],
		[8, F5, 4, TARGET],
		[12, C5, 2, { velocity: 0.76 }],
		[14, D5, 2, PICKUP],
	],
	// Gm(add9) — held D with one mordent (the phrase's ornament)
	[
		[0, Bb4, 3, { velocity: 0.86 }],
		[3, C5, 3, { velocity: 0.8 }],
		[6, D5, 8, { ...TARGET, ornament: "mordent" }],
	],
	// Cm7 — the hook again, a step higher in feel
	[
		[0, G5, 3, ACCENT],
		[3, F5, 3, { velocity: 0.8 }],
		[6, Eb5, 2, PICKUP],
		[8, C5, 4, TARGET],
		[12, Eb5, 2, { velocity: 0.78 }],
		[14, F5, 2, PICKUP],
	],
	// F
	[
		[0, A5, 3, { velocity: 0.9 }],
		[3, G5, 3, { velocity: 0.8 }],
		[6, F5, 2, PICKUP],
		[8, A5, 6, TARGET],
	],
	// B♭maj7 — the peak
	[
		[0, Bb5, 6, ACCENT],
		[6, A5, 2, PICKUP],
		[8, F5, 4, TARGET],
		[12, D5, 2, { velocity: 0.76 }],
		[14, Eb5, 2, PICKUP],
	],
	// D7 — ends open on the leading tone
	[
		[0, D5, 3, { velocity: 0.86 }],
		[3, Fs5, 3, { velocity: 0.82 }],
		[6, A5, 2, PICKUP],
		[8, Fs5, 6, TARGET],
	],
];

const LONG = (velocity: number): NoteOptions => ({
	articulation: "tenuto" as const,
	velocity,
});
const SLUR = (velocity: number): NoteOptions => ({
	articulation: "legato" as const,
	velocity,
});

/**
 * Long soothing melody (strings, "Static") — one or two notes per bar, moving
 * by step; peak B♭5 in the first 8 bars, C6 in the second.
 */
const LONG_MELODY: Array<Phrase> = [
	// E♭maj7
	[
		[0, G5, 10, LONG(0.78)],
		[10, F5, 2, SLUR(0.66)],
		[12, G5, 4, SLUR(0.72)],
	],
	// F
	[[0, A5, 12, LONG(0.8)]],
	// Dm7
	[
		[0, F5, 10, LONG(0.74)],
		[10, G5, 2, SLUR(0.68)],
		[12, A5, 4, SLUR(0.76)],
	],
	// Gm — peak
	[
		[0, Bb5, 8, LONG(0.86)],
		[8, A5, 6, SLUR(0.72)],
	],
	// Cm7
	[
		[0, G5, 10, LONG(0.78)],
		[10, F5, 2, SLUR(0.66)],
		[12, Eb5, 4, SLUR(0.7)],
	],
	// F
	[[0, F5, 12, LONG(0.74)]],
	// B♭maj7
	[
		[0, D5, 10, LONG(0.72)],
		[10, Eb5, 2, SLUR(0.66)],
		[12, F5, 4, SLUR(0.74)],
	],
	// D7
	[[0, Fs5, 12, LONG(0.78)]],
	// Second pass: same opening ...
	[
		[0, G5, 10, LONG(0.8)],
		[10, F5, 2, SLUR(0.68)],
		[12, G5, 4, SLUR(0.74)],
	],
	[[0, A5, 12, LONG(0.82)]],
	[
		[0, F5, 10, LONG(0.76)],
		[10, G5, 2, SLUR(0.7)],
		[12, A5, 4, SLUR(0.78)],
	],
	[
		[0, Bb5, 8, LONG(0.84)],
		[8, A5, 6, SLUR(0.72)],
	],
	// ... then climbs to C6 and comes down
	[
		[0, C6, 8, LONG(0.9)],
		[8, Bb5, 4, SLUR(0.78)],
		[12, G5, 4, { velocity: 0.72 }],
	],
	[[0, A5, 12, LONG(0.8)]],
	[
		[0, F5, 10, LONG(0.74)],
		[10, Eb5, 2, SLUR(0.66)],
		[12, D5, 4, SLUR(0.7)],
	],
	[
		[0, Fs5, 8, LONG(0.78)],
		[8, A5, 6, { velocity: 0.74 }],
	],
];

const phraseNotes = (
	phrase: Phrase | undefined,
	transpose = 0,
	velocityScale = 1
): Array<NoteEvent> =>
	(phrase ?? []).map(([step, pitch, duration, options]) =>
		n(step, pitch + transpose, duration, {
			...options,
			velocity: Math.min(1, (options?.velocity ?? 0.8) * velocityScale),
		})
	);

// ─── Section helpers ─────────────────────────────────────────────────────────
const bars = (
	build: (bar: number) => Array<NoteEvent> | null
): Array<Array<NoteEvent> | null> =>
	Array.from({ length: TOTAL_BARS }, (_, bar) => build(bar));
const inRange = (bar: number, start: number, end: number): boolean =>
	bar >= start && bar <= end;
const PETALS = [0, 15] as const;
const STATIC = [16, 31] as const;
const BLOOM = [32, 47] as const;
const inPetals = (bar: number): boolean => inRange(bar, ...PETALS);
const inStatic = (bar: number): boolean => inRange(bar, ...STATIC);
const inBloom = (bar: number): boolean => inRange(bar, ...BLOOM);

// ─── Parts ───────────────────────────────────────────────────────────────────
// Bold piano: hook in Petals + Bloom
const pianoHook = buildTrack(
	bars((bar) =>
		inPetals(bar) || inBloom(bar) ? phraseNotes(PIANO_HOOK[bar % 8]) : null
	)
);

// Piano octave-below double: on the Petals repeat only (Bloom has the counter-line there)
const pianoOctave = buildTrack(
	bars((bar) =>
		inRange(bar, 8, 15) ? phraseNotes(PIANO_HOOK[bar % 8], -12, 0.66) : null
	)
);

// Piano chords: downbeat chord + offbeat staccato stabs (Petals, Bloom),
// rolling 8th arpeggios under the long melody (Static)
const ARP_ORDER = [0, 1, 2, 3, 4, 3, 2, 1];
const pianoChords = buildTrack(
	bars((bar) => {
		const chord = chordAt(bar);
		if (inStatic(bar)) {
			return ARP_ORDER.map((toneIndex, index) =>
				n(index * 2, chord.arp[toneIndex] ?? chord.voicing[0] ?? G3, 2, {
					velocity: index === 0 ? 0.74 : toneIndex === 4 ? 0.68 : 0.6,
				})
			);
		}
		return [
			...chord.voicing.map((pitch) =>
				n(0, pitch, 4, { velocity: 0.66, articulation: "tenuto" })
			),
			...[6, 10, 14].flatMap((step) =>
				chord.voicing.map((pitch) =>
					n(step, pitch, 2, {
						velocity: step === 6 ? 0.56 : 0.5,
						articulation: "staccato",
					})
				)
			),
		];
	})
);

// Strings: long melody (Static), long guide-tone counter-line (Bloom)
const strings = buildTrack(
	bars((bar) => {
		if (inStatic(bar)) {
			return phraseNotes(LONG_MELODY[bar - 16]);
		}
		if (inBloom(bar)) {
			const chordName = PETALS_CHORD_CHART[bar];
			const guide = chordAt(bar).guide;
			if (chordName === "D7") {
				return [
					n(0, guide, 8, { velocity: 0.6, articulation: "tenuto" }),
					n(8, A4, 6, { velocity: 0.56 }),
				];
			}
			return [n(0, guide, 16, { velocity: 0.58, articulation: "tenuto" })];
		}
		return null;
	})
);

// Dream pad: whole-bar chords everywhere (softer in Petals)
const pad = buildTrack(
	bars((bar) => {
		const chord = chordAt(bar);
		const velocity = inPetals(bar) ? 0.42 : 0.5;
		return [
			...chord.voicing.map((pitch) => n(0, pitch, 16, { velocity })),
			...(chord.color !== undefined
				? [n(0, chord.color, 16, { velocity: velocity * 0.75 })]
				: []),
		];
	})
);

// Choir: second half of Static, all of Bloom
const choir = buildTrack(
	bars((bar) => {
		if (!(inRange(bar, 24, 31) || inBloom(bar))) {
			return null;
		}
		const velocity = inBloom(bar) ? 0.5 : 0.42;
		return chordAt(bar).voicing.map((pitch) => n(0, pitch, 16, { velocity }));
	})
);

// Bouncy triangle bass (Petals) / plain sub under the reese (Static, Bloom)
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
const subBar = (root: number): Array<NoteEvent> => [
	n(0, root, 6, { velocity: 0.85 }),
	n(8, root, 6, { velocity: 0.8 }),
];
const triangleBass = buildTrack(
	bars((bar) => {
		const root = chordAt(bar).bass;
		return inPetals(bar) ? bounceBar(root) : subBar(root);
	})
);

// Reese (Static, Bloom) — filter sweeps only, no pitch movement
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
const reese = buildTrack(
	bars((bar) =>
		inStatic(bar) || inBloom(bar) ? reeseBar(chordAt(bar).bass) : null
	)
);

// ─── Breaks (no ratchets — every hit is written out) ─────────────────────────
const hats8ths = (velocity = 0.42): Array<NoteEvent> =>
	[0, 2, 4, 6, 8, 10, 12, 14].map((step) => n(step, HAT, 1, { velocity }));

/** Classic amen */
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

/** Amen B — written-out flam ending */
const amenB = (): Array<NoteEvent> => [
	n(0, KICK, 1, { velocity: 1 }),
	n(2, KICK, 1, { velocity: 0.85 }),
	n(4, SNARE, 1, { velocity: 1 }),
	n(7, SNARE, 1, { velocity: 0.5 }),
	n(9, SNARE, 1, { velocity: 0.6 }),
	n(10, KICK, 1, { velocity: 0.9 }),
	n(12, SNARE, 1, { velocity: 0.95 }),
	n(14, SNARE, 1, { velocity: 0.7 }),
	n(15, SNARE, 1, { velocity: 0.55 }),
	...hats8ths(),
];

/** Chopped amen — busier, still on the grid */
const amenChop = (): Array<NoteEvent> => [
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
	n(14, SNARE, 1, { velocity: 0.7 }),
	n(15, SNARE, 1, { velocity: 0.5 }),
	...hats8ths(0.38),
];

/** Jungle break for Static — ghost snares, rolling kicks */
const jungle = (): Array<NoteEvent> => [
	n(0, KICK, 1, { velocity: 1 }),
	n(3, SNARE, 1, { velocity: 0.35 }),
	n(4, SNARE, 1, { velocity: 1 }),
	n(6, KICK, 1, { velocity: 0.8 }),
	n(7, SNARE, 1, { velocity: 0.45 }),
	n(9, SNARE, 1, { velocity: 0.4 }),
	n(10, KICK, 1, { velocity: 0.9 }),
	n(12, SNARE, 1, { velocity: 1 }),
	n(13, SNARE, 1, { velocity: 0.35 }),
	n(14, KICK, 1, { velocity: 0.7 }),
	n(15, SNARE, 1, { velocity: 0.55 }),
	...[0, 2, 4, 6, 8, 10, 12, 14].map((step) =>
		n(step, HAT, 1, { velocity: step % 4 === 2 ? 0.5 : 0.36 })
	),
];

/** Bloom groove: amen A with a ghost-snare shuffle */
const amenGhost = (): Array<NoteEvent> => [
	...amenA(),
	n(1, SNARE, 1, { velocity: 0.3 }),
	n(5, SNARE, 1, { velocity: 0.28 }),
	n(13, SNARE, 1, { velocity: 0.35 }),
];

/** 4th-bar fill: toms + snare */
const tomFill = (): Array<NoteEvent> => [
	n(0, KICK, 1, { velocity: 1 }),
	n(2, KICK, 1, { velocity: 0.85 }),
	n(4, SNARE, 1, { velocity: 1 }),
	n(7, SNARE, 1, { velocity: 0.5 }),
	n(8, KICK, 1, { velocity: 0.9 }),
	n(10, SNARE, 1, { velocity: 0.8 }),
	n(12, HIGH_TOM, 1, { velocity: 0.8 }),
	n(13, HIGH_TOM, 1, { velocity: 0.7 }),
	n(14, LOW_TOM, 1, { velocity: 0.85 }),
	n(15, SNARE, 1, { velocity: 0.9 }),
	...[0, 2, 4, 6, 8, 10].map((step) => n(step, HAT, 1, { velocity: 0.4 })),
];

/** Section-end snare run: every 16th written out, rising — no ratchet */
const snareRun = (): Array<NoteEvent> => [
	n(0, KICK, 1, { velocity: 1 }),
	n(2, KICK, 1, { velocity: 0.85 }),
	n(4, SNARE, 1, { velocity: 1 }),
	n(6, KICK, 1, { velocity: 0.9 }),
	n(7, SNARE, 1, { velocity: 0.6 }),
	...[8, 9, 10, 11, 12, 13, 14, 15].map((step, index) =>
		n(step, SNARE, 1, { velocity: 0.5 + index * 0.065 })
	),
	...[0, 2, 4, 6].map((step) => n(step, HAT, 1, { velocity: 0.4 })),
];

const breaks = buildTrack(
	bars((bar) => {
		const local = bar % 16;
		if (local === 15) {
			return snareRun();
		}
		if (local === 7) {
			return tomFill();
		}
		if (inPetals(bar)) {
			return [amenA, amenB, amenA, amenChop][local % 4]!();
		}
		if (inStatic(bar)) {
			return [jungle, amenChop, jungle, amenB][local % 4]!();
		}
		return [amenGhost, amenChop, amenGhost, amenB][local % 4]!();
	})
);

// Gabber kick: four-on-the-floor in Bloom, out on the last two beats of the run
const gabber = buildTrack(
	bars((bar) => {
		if (!inBloom(bar)) {
			return null;
		}
		const steps = bar % 16 === 15 ? [0, 4] : [0, 4, 8, 12];
		return steps.map((step) =>
			n(step, KICK, 1, { velocity: step === 0 ? 1 : 0.85 })
		);
	})
);

// Crashes on every 8-bar phrase start, offbeat open crashes in Bloom
const fx = buildTrack(
	bars((bar) => {
		const notes: Array<NoteEvent> = [];
		if (bar % 8 === 0) {
			notes.push(n(0, CRASH, 2, { velocity: 0.9 }));
		}
		if (inBloom(bar) && bar % 16 !== 15) {
			[6, 10, 14].forEach((step) => {
				notes.push(n(step, CRASH, 1, { velocity: 0.45 }));
			});
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
export const PETALS_SECTIONS = [
	{ name: "Petals", startBar: PETALS[0], endBar: PETALS[1] },
	{ name: "Static", startBar: STATIC[0], endBar: STATIC[1] },
	{ name: "Bloom", startBar: BLOOM[0], endBar: BLOOM[1] },
] as const;

export const breakcorePetalsSong: SongProject = {
	id: "demo-breakcore-petals-172",
	title: "Petals in the Static",
	author: "UltraBeep Demo",
	bpm: 172,
	beatsPerBar: 4,
	stepsPerBeat: 4,
	totalBars: TOTAL_BARS,
	loopStartBar: 0,
	loopEndBar: TOTAL_BARS - 1,
	swing: 0,
	rootKey: "G",
	scale: "minor",
	masterVolume: 0.6,
	sections: PETALS_SECTIONS.map((section) => ({
		id: `pt-section-${section.name.toLowerCase()}`,
		name: section.name,
		startBar: section.startBar,
		endBar: section.endBar,
	})),
	updatedAt: 1763810000000,
	channels: [
		makeChannel(
			"pt-piano",
			"Bold Piano",
			"pitch",
			"#fde68a",
			"cinematic-felt-piano",
			pianoHook,
			{
				volume: 0.85,
				pan: -0.05,
				filterCutoff: 9000,
				release: 0.35,
				echoMix: 0.14,
				echoTimeSeconds: 0.262,
				reverbMix: 0.3,
			}
		),
		makeChannel(
			"pt-piano-octave",
			"Piano Octaves",
			"pitch",
			"#fcd34d",
			"cinematic-felt-piano",
			pianoOctave,
			{
				volume: 0.52,
				pan: 0.05,
				filterCutoff: 8000,
				release: 0.35,
				echoMix: 0,
				reverbMix: 0.3,
			}
		),
		makeChannel(
			"pt-piano-chords",
			"Piano Chords",
			"pitch",
			"#fbbf24",
			"cinematic-felt-piano",
			pianoChords,
			{
				volume: 0.36,
				pan: 0.12,
				filterCutoff: 7000,
				release: 0.3,
				echoMix: 0,
				reverbMix: 0.32,
			}
		),
		makeChannel(
			"pt-strings",
			"Dream Strings",
			"pitch",
			"#f9a8d4",
			"cinematic-strings",
			strings,
			{
				volume: 1,
				pan: -0.12,
				attack: 0.06,
				decay: 0.3,
				sustain: 0.92,
				release: 0.5,
				filterCutoff: 4200,
				vibratoDepth: 10,
				vibratoSpeed: 5.4,
				reverbMix: 0.42,
			}
		),
		makeChannel(
			"pt-pad",
			"Dream Pad",
			"pitch",
			"#c4b5fd",
			"cinematic-strings",
			pad,
			{
				volume: 0.32,
				pan: 0.15,
				attack: 0.35,
				release: 1.2,
				filterCutoff: 3200,
				reverbMix: 0.5,
			}
		),
		makeChannel(
			"pt-choir",
			"Airy Choir",
			"pitch",
			"#a5f3fc",
			"cinematic-airy-choir",
			choir,
			{ volume: 0.32, attack: 0.5, release: 1.4 }
		),
		makeChannel(
			"pt-reese",
			"Reese Bass",
			"pitch",
			"#fb7185",
			"breakcore-reese-bass",
			reese,
			{ volume: 0.42, drive: 0.4, filterCutoff: 1200 }
		),
		makeChannel(
			"pt-tri",
			"Triangle Bass",
			"pitch",
			"#ff9233",
			"dance-triangle-bass",
			triangleBass,
			{ volume: 0.82 }
		),
		makeChannel(
			"pt-amen",
			"Amen Break",
			"drum",
			"#facc15",
			"breakcore-amen-kit",
			breaks,
			{ volume: 0.86 }
		),
		makeChannel(
			"pt-kick",
			"Gabber Kick",
			"drum",
			"#ef4444",
			"breakcore-gabber-kick",
			gabber,
			{ volume: 0.5, drive: 0.5 }
		),
		makeChannel(
			"pt-fx",
			"Crashes",
			"drum",
			"#34d399",
			"breakcore-amen-kit",
			fx,
			{ volume: 0.55, drive: 0.1, pan: 0.15 }
		),
	],
};

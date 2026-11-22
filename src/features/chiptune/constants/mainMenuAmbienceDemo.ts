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
 * "What the Wind Remembers" — 32-bar, 66 BPM G-major main-menu ambience (~1:56).
 *
 * Brief: Hans Zimmer-style, calming but nostalgic — longing for something that
 * isn't here anymore — with the "the journey is out there" pull of an open-world
 * title screen. Built with the new cinematic palette (felt piano, ensemble
 * strings, airy choir, music box, cinematic percussion, hall reverb).
 *
 * Harmony
 *  "Longing" loop (Dawn, Memory, Homeward): Gmaj9 – Em7 – Cmaj7 – Cm6
 *    I – vi – IV – iv. The borrowed minor iv (Cm6, its E♭) is the nostalgia
 *    chord: the major IV "loses" its brightness, then home returns. Pad voices
 *    move by step, and Cm6 → Gmaj9 is four half-step falls (C→B, E♭→D, G→F#).
 *  "Journey" loop (Horizon): Em – Bm – D – A | Em – Bm – C – Dsus4→D
 *    vi – iii – V – II: the A major (C#, the raised 4th) is the Lydian lift that
 *    sounds like an open horizon; the second half turns IV – V back home.
 *
 * Sections (bars 0-indexed, 8 bars ≈ 29 s each, every one loops on its own)
 *  0-7    Dawn      Solo felt piano states the theme (question → answer) over a
 *                    barely-there string pad; celli enter on the answer.
 *  8-15   Memory    Violins take the theme, piano turns to flowing broken chords,
 *                    choir + music box answer in the gaps of the second phrase.
 *  16-23  Horizon   Zimmer ostinato: spiccato low strings in 3+3+2, tuned timpani,
 *                    full choir, a broader violin theme rising to the B5 peak.
 *  24-31  Homeward  Piano reprise with choir; a violin counter-line answers in
 *                    contrary motion; ends on Cm6, which falls straight into Dawn.
 *
 * Music rules applied (see the project's fundamentals guide): chord tones (incl.
 * the 7ths/9ths of the named chords) on steps 0/4/8/12, every phrase ends with a
 * breath, question phrases end on D (5), the answer ends on G (1), one peak per
 * 8 bars, accents only on the ostinato's 3+3+2 points, legato only between
 * touching stepwise notes, counter-lines move when the lead holds.
 */

// ─── Note helper ────────────────────────────────────────────────────────────
interface NoteOptions {
	velocity?: number;
	articulation?: NoteArticulation;
	ornament?: NoteOrnament;
	/** Micro-timing in steps (negative = early) */
	timing?: number;
	bend?: number;
	ratchet?: number;
	fadeIn?: boolean;
}

let noteCounter = 0;

const n = (
	step: number,
	pitch: number,
	duration: number,
	options: NoteOptions = {}
): NoteEvent => {
	noteCounter += 1;
	return {
		id: `mm-${noteCounter}-${step}-${pitch}`,
		step,
		pitch,
		duration,
		velocity: options.velocity ?? 0.6,
		pitchBend: options.bend ?? 0,
		...(options.articulation ? { articulation: options.articulation } : {}),
		...(options.ornament ? { ornament: options.ornament } : {}),
		...(options.timing ? { timingOffset: options.timing } : {}),
		...(options.ratchet && options.ratchet > 1
			? { ratchet: options.ratchet }
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

/**
 * Turns a list of bars (null = silent bar) into a pattern dictionary plus a
 * bar sequence, re-using identical bars as the same pattern.
 */
const buildTrack = (
	bars: Array<Array<NoteEvent> | null>
): { patterns: Record<string, Pattern>; barSequence: Array<number> } => {
	const uniquePatterns: Array<Array<NoteEvent>> = [];
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
		uniquePatterns.push(notes);
		return uniquePatterns.length;
	});
	return { patterns: toPatterns(uniquePatterns), barSequence };
};

// ─── Pitches (G major: G A B C D E F#, borrowed E♭) ─────────────────────────
const C2 = 36;
const D2 = 38;
const E2 = 40;
const G2 = 43;
const A2 = 45;
const B2 = 47;
const C3 = 48;
const D3 = 50;
const E3 = 52;
const Fs3 = 54;
const G3 = 55;
const A3 = 57;
const B3 = 59;
const C4 = 60;
const Cs4 = 61;
const D4 = 62;
const Eb4 = 63;
const E4 = 64;
const Fs4 = 66;
const G4 = 67;
const A4 = 69;
const B4 = 71;
const C5 = 72;
const Cs5 = 73;
const D5 = 74;
const Eb5 = 75;
const E5 = 76;
const Fs5 = 78;
const G5 = 79;
const A5 = 81;
const B5 = 83;
const C6 = 84;

// ─── Harmony ─────────────────────────────────────────────────────────────────
type ChordName =
	| "Gmaj9"
	| "Em7"
	| "Cmaj7"
	| "Cm6"
	| "Em"
	| "Bm"
	| "D"
	| "A"
	| "C"
	| "Dsus4";

interface ChordShape {
	/** Pitch classes that count as chord tones on strong steps (incl. 7ths / 9ths) */
	tones: Array<number>;
	/** Low root for the bass / timpani */
	root: number;
	/** Mid-register string-pad voicing (moves by step between chords) */
	pad: Array<number>;
	/** Choir voicing */
	choir: Array<number>;
	/** Piano broken-chord tones: [low root, 5th, colour, 3rd, top] */
	broken: [number, number, number, number, number];
}

export const MAIN_MENU_CHORDS: Record<ChordName, ChordShape> = {
	Gmaj9: {
		tones: [7, 11, 2, 6, 9],
		root: G2,
		pad: [B3, D4, Fs4, A4],
		choir: [D4, Fs4, B4],
		broken: [G2, D3, A3, B3, Fs4],
	},
	Em7: {
		tones: [4, 7, 11, 2, 6],
		root: E2,
		pad: [B3, D4, E4, G4],
		choir: [E4, G4, B4],
		broken: [E2, B2, Fs3, G3, D4],
	},
	Cmaj7: {
		tones: [0, 4, 7, 11, 2],
		root: C2,
		pad: [C4, E4, G4, B4],
		choir: [E4, G4, C5],
		broken: [C3, G3, D4, E4, B3],
	},
	Cm6: {
		tones: [0, 3, 7, 9, 2],
		root: C2,
		pad: [C4, Eb4, G4, A4],
		choir: [Eb4, G4, C5],
		broken: [C3, G3, D4, Eb4, A3],
	},
	Em: {
		tones: [4, 7, 11, 6],
		root: E2,
		pad: [B3, E4, G4],
		choir: [E4, G4, B4],
		broken: [E2, B2, Fs3, G3, D4],
	},
	Bm: {
		tones: [11, 2, 6, 9],
		root: B2,
		pad: [B3, D4, Fs4],
		choir: [D4, Fs4, B4],
		broken: [B2, Fs3, Cs4, D4, A3],
	},
	D: {
		tones: [2, 6, 9, 4],
		root: D2,
		pad: [A3, D4, Fs4],
		choir: [D4, Fs4, A4],
		broken: [D3, A3, E4, Fs4, D4],
	},
	A: {
		tones: [9, 1, 4, 11],
		root: A2,
		pad: [A3, Cs4, E4],
		choir: [Cs4, E4, A4],
		broken: [A2, E3, B3, Cs4, A3],
	},
	C: {
		tones: [0, 4, 7, 2],
		root: C2,
		pad: [C4, E4, G4],
		choir: [E4, G4, C5],
		broken: [C3, G3, D4, E4, B3],
	},
	Dsus4: {
		// G on beat 1 resolves to F# on beat 3 (step 8)
		tones: [2, 7, 9, 6],
		root: D2,
		pad: [A3, D4, G4],
		choir: [D4, G4, A4],
		broken: [D3, A3, E4, G4, D4],
	},
};

const LONGING: Array<ChordName> = ["Gmaj9", "Em7", "Cmaj7", "Cm6"];
const JOURNEY: Array<ChordName> = [
	"Em",
	"Bm",
	"D",
	"A",
	"Em",
	"Bm",
	"C",
	"Dsus4",
];

/** Chord of every bar (exported for the music-theory test) */
export const MAIN_MENU_CHORD_CHART: Array<ChordName> = [
	...LONGING,
	...LONGING, // Dawn
	...LONGING,
	...LONGING, // Memory
	...JOURNEY, // Horizon
	...LONGING,
	...LONGING, // Homeward
];

const chordAt = (bar: number): ChordShape =>
	MAIN_MENU_CHORDS[MAIN_MENU_CHORD_CHART[bar] ?? "Gmaj9"];

// ─── Melody ──────────────────────────────────────────────────────────────────
type Phrase = Array<
	[step: number, pitch: number, duration: number, options?: NoteOptions]
>;

/**
 * Main theme, "question" half: rising B–D then a longing leap up to the 9th
 * (A5), falling home by step; ends open on D over Cm6.
 */
const THEME_QUESTION: Array<Phrase> = [
	// Gmaj9
	[
		[0, B4, 2, { velocity: 0.5 }],
		[2, D5, 2, { velocity: 0.56 }],
		[4, A5, 8, { velocity: 0.68, articulation: "tenuto", timing: 0.08 }],
		[12, G5, 2, { velocity: 0.56 }],
		[14, Fs5, 2, { velocity: 0.52 }],
	],
	// Em7
	[
		[0, E5, 6, { velocity: 0.6, articulation: "tenuto" }],
		[6, D5, 2, { velocity: 0.5 }],
		[8, B4, 6, { velocity: 0.52 }],
	],
	// Cmaj7 — same contour as bar 1 (C–E rising, leap to G)
	[
		[0, C5, 2, { velocity: 0.5 }],
		[2, E5, 2, { velocity: 0.56 }],
		[
			4,
			G5,
			8,
			{
				velocity: 0.66,
				articulation: "tenuto",
				ornament: "grace",
				timing: 0.06,
			},
		],
		[12, E5, 2, { velocity: 0.54 }],
		[14, D5, 2, { velocity: 0.5 }],
	],
	// Cm6 — the borrowed E♭ sighs down to D (question: ends on 5)
	[
		[0, Eb5, 8, { velocity: 0.62, articulation: "tenuto" }],
		[8, D5, 6, { velocity: 0.5 }],
	],
];

/** Answer half: same opening, climbs to the B5 peak, then walks home to G. */
const THEME_ANSWER: Array<Phrase> = [
	THEME_QUESTION[0] ?? [],
	// Em7 — the peak
	[
		[0, G5, 4, { velocity: 0.6 }],
		[4, B5, 6, { velocity: 0.72, articulation: "tenuto", timing: 0.07 }],
		[10, A5, 2, { velocity: 0.56 }],
		[12, G5, 3, { velocity: 0.52 }],
	],
	// Cmaj7 — stepwise descent
	[
		[0, E5, 6, { velocity: 0.58, articulation: "tenuto" }],
		[6, D5, 2, { velocity: 0.48, articulation: "legato" }],
		[8, C5, 6, { velocity: 0.52, articulation: "legato" }],
	],
	// Cm6 — E♭ D C A G: lands on the tonic (answer: ends on 1)
	[
		[0, Eb5, 6, { velocity: 0.58, articulation: "tenuto" }],
		[6, D5, 2, { velocity: 0.48, articulation: "legato" }],
		[8, C5, 2, { velocity: 0.46, articulation: "legato" }],
		[10, A4, 2, { velocity: 0.44, articulation: "legato" }],
		[12, G4, 3, { velocity: 0.48, articulation: "tenuto" }],
	],
];

/** Violin version of the theme: slurs on the stepwise joins, no ornaments. */
const toViolinPhrase = (phrase: Phrase, slurs: Array<number>): Phrase =>
	phrase.map(([step, pitch, duration, options]) => [
		step,
		pitch,
		duration,
		{
			velocity: options?.velocity ?? 0.6,
			articulation: slurs.includes(step)
				? "legato"
				: options?.articulation === "legato"
					? undefined
					: options?.articulation,
			timing: options?.timing,
		},
	]);

const VIOLIN_MEMORY: Array<Phrase> = [
	toViolinPhrase(THEME_QUESTION[0] ?? [], [14]),
	toViolinPhrase(THEME_QUESTION[1] ?? [], [6]),
	toViolinPhrase(THEME_QUESTION[2] ?? [], [14]),
	toViolinPhrase(THEME_QUESTION[3] ?? [], [8]),
	toViolinPhrase(THEME_ANSWER[0] ?? [], [14]),
	toViolinPhrase(THEME_ANSWER[1] ?? [], [10, 12]),
	toViolinPhrase(THEME_ANSWER[2] ?? [], [6, 8]),
	// Ends open (question again) to lead into Horizon
	toViolinPhrase(THEME_QUESTION[3] ?? [], [8]),
];

/** Horizon theme — broader, longer notes; the open A-major lift; B5 peak in bar 6. */
const HORIZON_THEME: Array<Phrase> = [
	// Em
	[
		[0, B4, 4, { velocity: 0.56 }],
		[4, E5, 6, { velocity: 0.66, articulation: "tenuto" }],
		[10, Fs5, 2, { velocity: 0.56, articulation: "legato" }],
		[12, G5, 3, { velocity: 0.62, articulation: "legato" }],
	],
	// Bm
	[
		[0, Fs5, 10, { velocity: 0.66, articulation: "tenuto" }],
		[10, E5, 2, { velocity: 0.52, articulation: "legato" }],
		[12, D5, 3, { velocity: 0.54, articulation: "legato" }],
	],
	// D
	[
		[0, A5, 6, { velocity: 0.7, articulation: "tenuto" }],
		[6, G5, 2, { velocity: 0.56, articulation: "legato" }],
		[8, Fs5, 6, { velocity: 0.6, articulation: "legato" }],
		[14, E5, 2, { velocity: 0.52 }],
	],
	// A — C# (raised 4th of G) is the "horizon" colour
	[
		[0, Cs5, 4, { velocity: 0.62, articulation: "tenuto" }],
		[4, E5, 6, { velocity: 0.66, articulation: "tenuto" }],
		[10, D5, 2, { velocity: 0.52, articulation: "legato" }],
		[12, Cs5, 3, { velocity: 0.56, articulation: "legato" }],
	],
	// Em
	[
		[0, B4, 4, { velocity: 0.6 }],
		[4, E5, 6, { velocity: 0.7, articulation: "tenuto" }],
		[10, Fs5, 2, { velocity: 0.6, articulation: "legato" }],
		[12, G5, 3, { velocity: 0.66, articulation: "legato" }],
	],
	// Bm — the peak
	[
		[0, B5, 8, { velocity: 0.78, articulation: "tenuto" }],
		[8, A5, 4, { velocity: 0.64, articulation: "legato" }],
		[12, Fs5, 3, { velocity: 0.6 }],
	],
	// C
	[
		[0, G5, 8, { velocity: 0.68, articulation: "tenuto" }],
		[8, E5, 4, { velocity: 0.58 }],
		[12, G5, 2, { velocity: 0.56 }],
		[14, A5, 2, { velocity: 0.58, articulation: "legato" }],
	],
	// Dsus4 → D: G (the 4th) resolves to F# on beat 3
	[
		[0, A5, 6, { velocity: 0.64 }],
		[6, G5, 2, { velocity: 0.54, articulation: "legato" }],
		[8, Fs5, 6, { velocity: 0.6, articulation: "legato" }],
	],
];

/**
 * Homeward counter-line (violins, bars 28-31, under the piano's answer):
 * moves while the piano holds, contrary motion in bar 3, stays below the lead.
 */
const HOMEWARD_COUNTER: Array<Phrase> = [
	[
		[0, D4, 6, { velocity: 0.42 }],
		[6, E4, 2, { velocity: 0.38, articulation: "legato" }],
		[8, Fs4, 8, { velocity: 0.44, articulation: "legato" }],
	],
	[
		[0, G4, 8, { velocity: 0.46, articulation: "tenuto" }],
		[8, E4, 7, { velocity: 0.4 }],
	],
	[
		[0, C4, 6, { velocity: 0.4 }],
		[6, D4, 2, { velocity: 0.38, articulation: "legato" }],
		[8, E4, 6, { velocity: 0.42, articulation: "legato" }],
	],
	[
		[0, C4, 8, { velocity: 0.42, articulation: "tenuto" }],
		[8, Eb4, 4, { velocity: 0.4 }],
		[12, D4, 3, { velocity: 0.36 }],
	],
];

const phraseNotes = (phrase: Phrase | undefined, scale = 1): Array<NoteEvent> =>
	(phrase ?? []).map(([step, pitch, duration, options]) =>
		n(step, pitch, duration, {
			...options,
			velocity: Math.min(1, (options?.velocity ?? 0.6) * scale),
		})
	);

// ─── Part builders ───────────────────────────────────────────────────────────
const TOTAL_BARS = 32;
const bars = <T>(build: (bar: number) => T): Array<T> =>
	Array.from({ length: TOTAL_BARS }, (_, bar) => build(bar));
const inRange = (bar: number, start: number, end: number): boolean =>
	bar >= start && bar <= end;

// Felt piano — theme in Dawn and Homeward
const pianoMelody = buildTrack(
	bars((bar) => {
		if (inRange(bar, 0, 7) || inRange(bar, 24, 31)) {
			const local = bar % 8;
			const half = local < 4 ? THEME_QUESTION : THEME_ANSWER;
			return phraseNotes(half[local % 4], bar >= 24 ? 1.04 : 1);
		}
		return null;
	})
);

// Piano left hand: sparse low tones (Dawn), flowing 8ths (Memory), quarters (Homeward)
const BROKEN_8THS = [0, 1, 2, 3, 4, 2, 3, 1];
const pianoLow = buildTrack(
	bars((bar) => {
		const chord = chordAt(bar);
		const [root, fifth, colour, third] = chord.broken;
		if (inRange(bar, 0, 7)) {
			// Root rings, then a soft open dyad on beat 3
			return [
				n(0, root, 16, { velocity: 0.6 }),
				n(8, fifth, 8, { velocity: 0.42 }),
				n(8, colour, 8, { velocity: 0.4, timing: 0.05 }),
			];
		}
		if (inRange(bar, 8, 15)) {
			return BROKEN_8THS.map((toneIndex, index) => {
				const pitch = chord.broken[toneIndex] ?? root;
				const velocity =
					index === 0 ? 0.56 : toneIndex === 4 ? 0.5 : 0.4 + (index % 2) * 0.04;
				return n(index * 2, pitch, Math.min(4, 16 - index * 2), { velocity });
			});
		}
		if (inRange(bar, 24, 31)) {
			return [
				n(0, root, 8, { velocity: 0.46 }),
				n(4, fifth, 6, { velocity: 0.34 }),
				n(8, third, 6, { velocity: 0.36 }),
				n(12, fifth, 4, { velocity: 0.3 }),
			];
		}
		return null;
	})
);

// Violins — theme (Memory), Horizon theme, Homeward counter-line
const violins = buildTrack(
	bars((bar) => {
		if (inRange(bar, 8, 15)) {
			return phraseNotes(VIOLIN_MEMORY[bar - 8]);
		}
		if (inRange(bar, 16, 23)) {
			return phraseNotes(HORIZON_THEME[bar - 16]);
		}
		if (inRange(bar, 28, 31)) {
			return phraseNotes(HOMEWARD_COUNTER[bar - 28]);
		}
		return null;
	})
);

// String pad — whole-bar chords, very soft at dawn, fullest on the horizon
const padLevel = (bar: number): number => {
	if (bar < 4) return 0.32;
	if (bar < 8) return 0.38;
	if (bar < 16) return 0.44;
	if (bar < 24) return 0.5;
	return 0.4;
};
const stringPad = buildTrack(
	bars((bar) => {
		const chordName = MAIN_MENU_CHORD_CHART[bar];
		const chord = chordAt(bar);
		const velocity = padLevel(bar);
		if (chordName === "Dsus4") {
			// Suspension: G holds, then resolves down by step to F#
			return [
				n(0, A3, 16, { velocity, articulation: "tenuto" }),
				n(0, D4, 16, { velocity, articulation: "tenuto" }),
				n(0, G4, 8, { velocity }),
				n(8, Fs4, 8, { velocity, articulation: "legato" }),
			];
		}
		return chord.pad.map((pitch) =>
			n(0, pitch, 16, {
				velocity,
				articulation: "tenuto",
				fadeIn: bar === 0,
			})
		);
	})
);

// Celli & basses — long root + fifth (an octave-and-fifth doubling of one line)
const celli = buildTrack(
	bars((bar) => {
		if (bar < 4) {
			return null;
		}
		const chord = chordAt(bar);
		if (inRange(bar, 16, 23)) {
			// Under the ostinato: just a soft sustained root
			return [n(0, chord.root, 16, { velocity: 0.4, articulation: "tenuto" })];
		}
		const velocity = bar < 8 ? 0.42 : bar >= 30 ? 0.4 : 0.48;
		return [
			n(0, chord.root, 16, { velocity, articulation: "tenuto" }),
			n(0, chord.root + 7, 16, { velocity: velocity * 0.8 }),
		];
	})
);

// Ostinato — spiccato 8ths with 3+3+2 accents (steps 0, 6, 12), Horizon only
const ostinato = buildTrack(
	bars((bar) => {
		if (!inRange(bar, 16, 23)) {
			return null;
		}
		const root = chordAt(bar).root;
		const swell = bar < 20 ? 0.82 : 1;
		const shape: Array<[number, number, number, NoteArticulation]> = [
			[0, 0, 0.86, "accent"],
			[2, 0, 0.5, "staccato"],
			[4, 0, 0.54, "staccato"],
			[6, 12, 0.8, "accent"],
			[8, 0, 0.52, "staccato"],
			[10, 0, 0.56, "staccato"],
			[12, 7, 0.72, "staccato"],
			[14, 0, 0.58, "staccato"],
		];
		return shape.map(([step, interval, velocity, articulation]) =>
			n(step, root + interval, 2, {
				velocity: velocity * swell,
				articulation,
			})
		);
	})
);

// Choir — enters halfway through Memory, full on the horizon, distant at home
const choirLevel = (bar: number): number | null => {
	if (inRange(bar, 12, 15)) return 0.4;
	if (inRange(bar, 16, 19)) return 0.5;
	if (inRange(bar, 20, 23)) return 0.58;
	if (inRange(bar, 24, 31)) return 0.36;
	return null;
};
const choir = buildTrack(
	bars((bar) => {
		const velocity = choirLevel(bar);
		if (velocity === null) {
			return null;
		}
		if (MAIN_MENU_CHORD_CHART[bar] === "Dsus4") {
			return [
				n(0, D4, 16, { velocity }),
				n(0, A4, 16, { velocity }),
				n(0, G4, 8, { velocity }),
				n(8, Fs4, 8, { velocity, articulation: "legato" }),
			];
		}
		return chordAt(bar).choir.map((pitch) => n(0, pitch, 16, { velocity }));
	})
);

// Music box — answers in the theme's breaths / under its held notes
const MUSIC_BOX_ANSWERS: Record<number, Array<NoteEvent>> = {
	12: [n(6, Fs5, 2, { velocity: 0.46 }), n(8, D5, 4, { velocity: 0.4 })],
	14: [n(14, G5, 2, { velocity: 0.44 })],
	15: [n(14, C6, 2, { velocity: 0.4 })],
	24: [n(6, Fs5, 2, { velocity: 0.46 }), n(8, D5, 4, { velocity: 0.4 })],
	25: [n(14, G5, 2, { velocity: 0.44 })],
	26: [n(6, E5, 2, { velocity: 0.44 }), n(8, C5, 4, { velocity: 0.38 })],
	27: [n(14, G5, 2, { velocity: 0.42 })],
};
const musicBox = buildTrack(bars((bar) => MUSIC_BOX_ANSWERS[bar] ?? null));

// Cinematic percussion (pads: 0 boom, 1 taiko, 2 shaker, 3 swell, 4/5 timpani, 6 chimes)
const BOOM = 0;
const TAIKO = 1;
const SHAKER = 2;
const SWELL = 3;
const TIMPANI_LOW = 4; // G2
const TIMPANI_HIGH = 5; // D3
const CHIMES = 6;

/** Timpani pad + pitch bend (semitones) that tunes it to each Horizon root */
const TIMPANI_TUNING: Partial<Record<ChordName, [number, number]>> = {
	Em: [TIMPANI_LOW, -3], // E2
	Bm: [TIMPANI_HIGH, -3], // B2
	D: [TIMPANI_HIGH, 0], // D3
	A: [TIMPANI_LOW, 2], // A2
	C: [TIMPANI_LOW, -7], // C2
	Dsus4: [TIMPANI_HIGH, 0], // D3
};

const percussion = buildTrack(
	bars((bar) => {
		const notes: Array<NoteEvent> = [];
		if (bar === 0) {
			notes.push(n(0, CHIMES, 4, { velocity: 0.5 }));
		}
		if (bar === 7) {
			notes.push(n(4, SWELL, 12, { velocity: 0.42 }));
		}
		if (bar === 15) {
			notes.push(n(0, SWELL, 16, { velocity: 0.62 }));
		}
		if (inRange(bar, 16, 23)) {
			const tuning = TIMPANI_TUNING[MAIN_MENU_CHORD_CHART[bar] ?? "Em"];
			if (tuning) {
				notes.push(
					n(0, tuning[0], 4, {
						velocity: bar % 4 === 0 ? 0.66 : 0.5,
						bend: tuning[1],
					})
				);
			}
			if (bar === 16 || bar === 20) {
				notes.push(n(0, BOOM, 8, { velocity: bar === 16 ? 0.62 : 0.54 }));
			}
			if (bar === 17 || bar === 19 || bar === 21) {
				notes.push(
					n(12, TAIKO, 2, { velocity: 0.42 }),
					n(14, TAIKO, 2, { velocity: 0.32 })
				);
			}
			if (bar >= 18) {
				[2, 6, 10, 14].forEach((step) => {
					notes.push(n(step, SHAKER, 1, { velocity: 0.24 }));
				});
			}
			if (bar === 23) {
				notes.push(
					n(0, SWELL, 16, { velocity: 0.58 }),
					n(8, TAIKO, 2, { velocity: 0.38 }),
					n(10, TAIKO, 2, { velocity: 0.44 }),
					n(12, TAIKO, 2, { velocity: 0.5 }),
					n(14, TAIKO, 2, { velocity: 0.56 })
				);
			}
		}
		if (bar === 24) {
			notes.push(
				n(0, BOOM, 8, { velocity: 0.5 }),
				n(0, CHIMES, 4, { velocity: 0.42 })
			);
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

/** Section loop ranges (0-indexed, inclusive). */
export const MAIN_MENU_AMBIENCE_SECTIONS = [
	{ name: "Dawn", startBar: 0, endBar: 7 },
	{ name: "Memory", startBar: 8, endBar: 15 },
	{ name: "Horizon", startBar: 16, endBar: 23 },
	{ name: "Homeward", startBar: 24, endBar: 31 },
] as const;

export const mainMenuAmbienceSong: SongProject = {
	id: "demo-main-menu-ambience",
	title: "What the Wind Remembers",
	author: "UltraBeep Demo",
	bpm: 66,
	beatsPerBar: 4,
	stepsPerBeat: 4,
	totalBars: TOTAL_BARS,
	loopStartBar: 0,
	loopEndBar: TOTAL_BARS - 1,
	swing: 0,
	rootKey: "G",
	scale: "major",
	masterVolume: 0.82,
	sections: MAIN_MENU_AMBIENCE_SECTIONS.map((section) => ({
		id: `mm-section-${section.name.toLowerCase()}`,
		name: section.name,
		startBar: section.startBar,
		endBar: section.endBar,
	})),
	updatedAt: 1763800000000,
	channels: [
		makeChannel(
			"mm-piano",
			"Felt Piano",
			"pitch",
			"#fde68a",
			"cinematic-felt-piano",
			pianoMelody,
			{ volume: 0.9, pan: -0.08 }
		),
		makeChannel(
			"mm-piano-low",
			"Piano Left Hand",
			"pitch",
			"#fcd34d",
			"cinematic-felt-piano",
			pianoLow,
			{ volume: 0.42, pan: 0.1, echoMix: 0, reverbMix: 0.38 }
		),
		makeChannel(
			"mm-violins",
			"Violins",
			"pitch",
			"#f9a8d4",
			"cinematic-strings",
			violins,
			{
				volume: 0.85,
				pan: -0.15,
				attack: 0.12,
				decay: 0.3,
				sustain: 0.92,
				release: 0.9,
				filterCutoff: 3400,
				vibratoDepth: 9,
				vibratoSpeed: 5.2,
				reverbMix: 0.42,
			}
		),
		makeChannel(
			"mm-pad",
			"String Pad",
			"pitch",
			"#c4b5fd",
			"cinematic-strings",
			stringPad,
			{ volume: 0.28, pan: 0.12 }
		),
		makeChannel(
			"mm-celli",
			"Celli & Basses",
			"pitch",
			"#818cf8",
			"cinematic-strings",
			celli,
			{
				volume: 0.4,
				attack: 0.5,
				release: 1.6,
				filterCutoff: 1100,
				vibratoDepth: 4,
				reverbMix: 0.3,
			}
		),
		makeChannel(
			"mm-ostinato",
			"Low Strings Ostinato",
			"pitch",
			"#60a5fa",
			"cinematic-low-strings",
			ostinato,
			{ volume: 0.57 }
		),
		makeChannel(
			"mm-choir",
			"Airy Choir",
			"pitch",
			"#a5f3fc",
			"cinematic-airy-choir",
			choir,
			{ volume: 0.34 }
		),
		makeChannel(
			"mm-music-box",
			"Music Box",
			"pitch",
			"#fef3c7",
			"cinematic-music-box",
			musicBox,
			{ volume: 0.8 }
		),
		makeChannel(
			"mm-perc",
			"Cinematic Percussion",
			"drum",
			"#f59e0b",
			"cinematic-perc-kit",
			percussion,
			{ volume: 0.75 }
		),
	],
};

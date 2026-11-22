import type {
	Channel,
	ModernInstrumentSettings,
	NoteArticulation,
	NoteEvent,
	Pattern,
	SongProject,
} from "../types/music";
import { getModernPresetById } from "./modernPresets";

/**
 * "Afterglow Circuit" — 32-bar, 174 BPM D-minor breakcore loop for the modern
 * music maker (sewerslvt / hkmori mood): a bold sampled grand piano hook,
 * a dream pad that pumps with the kick, glass bells, a sampled string
 * counter-line, reese bass and programmed jungle breaks.
 *
 * Harmony — one 8-bar cycle so both sections loop and swap seamlessly:
 *   B♭maj7 – C – Am7 – Dm(add9) | Gm7 – C – Fmaj7 – A7
 *   VI – VII – v – i | iv – VII – III – V7  (A7 pulls back into B♭maj7)
 *
 * Sections (0-indexed bars, 16 bars ≈ 22 s each)
 *   0-15   "Glow"   piano hook, dream pad, sub bass, lighter break; bells join at bar 8
 *   16-31  "Surge"  hook + low string counter-line, reese, crushed amen breaks,
 *                    rave stabs from bar 24
 * No stutters and no pitch bends — the energy comes from the drums and bass,
 * so the lead stays clean over long fights.
 */

// Drum pads (shared by every kit)
const KICK = 0;
const SNARE = 1;
const HAT = 2;
const OPEN_HAT = 3;
const LOW_TOM = 4;
const HIGH_TOM = 5;
const RIDE = 7;

let noteCounter = 0;

const n = (
	step: number,
	pitch: number,
	duration = 1,
	velocity = 0.9,
	articulation?: NoteArticulation
): NoteEvent => {
	noteCounter += 1;
	return {
		id: `ag-${noteCounter}-${step}-${pitch}`,
		step,
		pitch,
		duration,
		velocity,
		pitchBend: 0,
		...(articulation ? { articulation } : {}),
	};
};

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

// ─── Pitches (D minor, borrowed C# in A7) ────────────────────────────────────
const F2 = 41;
const G2 = 43;
const A2 = 45;
const Bb2 = 46;
const C3 = 48;
const D3 = 50;
const G3 = 55;
const A3 = 57;
const Bb3 = 58;
const C4 = 60;
const Cs4 = 61;
const D4 = 62;
const E4 = 64;
const F4 = 65;
const G4 = 67;
const A4 = 69;
const Bb4 = 70;
const C5 = 72;
const Cs5 = 73;
const D5 = 74;
const E5 = 76;
const F5 = 77;
const G5 = 79;
const A5 = 81;
const C6 = 84;

interface Chord {
	bass: number;
	voicing: Array<number>;
	/** Pad colour note on top (7th / 9th) */
	color: number;
}

const CYCLE: Array<Chord> = [
	{ bass: Bb2, voicing: [A3, D4, F4], color: C5 }, // B♭maj7(9)
	{ bass: C3, voicing: [G3, C4, E4], color: D5 }, // C(add9)
	{ bass: A2, voicing: [A3, C4, E4], color: G4 }, // Am7
	{ bass: D3, voicing: [A3, D4, F4], color: E5 }, // Dm(add9)
	{ bass: G2, voicing: [Bb3, D4, F4], color: A4 }, // Gm7(9)
	{ bass: C3, voicing: [G3, C4, E4], color: D5 }, // C(add9)
	{ bass: F2, voicing: [A3, C4, E4], color: G4 }, // Fmaj7(9)
	{ bass: A2, voicing: [G3, Cs4, E4], color: Bb4 }, // A7(♭9)
];

const TOTAL_BARS = 32;
const chordAt = (bar: number): Chord =>
	CYCLE[bar % CYCLE.length] ?? (CYCLE[0] as Chord);
const inGlow = (bar: number): boolean => bar < 16;
const inSurge = (bar: number): boolean => bar >= 16;
const bars = (
	build: (bar: number) => Array<NoteEvent> | null
): Array<Array<NoteEvent> | null> =>
	Array.from({ length: TOTAL_BARS }, (_, bar) => build(bar));

// ─── Piano hook: the same 3+3+2 rhythm every bar, a breath every 2 bars ──────
type Phrase = Array<
	[
		step: number,
		pitch: number,
		duration: number,
		velocity?: number,
		articulation?: NoteArticulation,
	]
>;

const HOOK: Array<Phrase> = [
	[
		[0, F5, 3, 0.92, "accent"],
		[3, D5, 3, 0.8],
		[6, F5, 2, 0.82],
		[8, A5, 4, 0.95, "tenuto"],
		[12, G5, 2, 0.78],
		[14, F5, 2, 0.74, "staccato"],
	],
	[
		[0, E5, 3, 0.9],
		[3, G5, 3, 0.82],
		[6, E5, 6, 0.86, "tenuto"],
		[14, C5, 2, 0.7, "staccato"],
	],
	[
		[0, E5, 3, 0.9, "accent"],
		[3, C5, 3, 0.8],
		[6, E5, 2, 0.82],
		[8, G5, 4, 0.92, "tenuto"],
		[12, A5, 2, 0.8],
		[14, G5, 2, 0.74, "staccato"],
	],
	[
		[0, F5, 4, 0.9],
		[4, E5, 2, 0.8],
		[6, D5, 6, 0.86, "tenuto"],
	],
	[
		[0, D5, 3, 0.9, "accent"],
		[3, Bb4, 3, 0.8],
		[6, D5, 2, 0.82],
		[8, G5, 4, 0.92, "tenuto"],
		[12, F5, 2, 0.78],
		[14, D5, 2, 0.74, "staccato"],
	],
	[
		[0, E5, 3, 0.9],
		[3, G5, 3, 0.86],
		[6, C6, 6, 0.98, "tenuto"],
		[14, A5, 2, 0.72, "staccato"],
	],
	[
		[0, A5, 3, 0.92, "accent"],
		[3, G5, 3, 0.82],
		[6, F5, 2, 0.8],
		[8, E5, 4, 0.9, "tenuto"],
		[12, C5, 2, 0.78],
		[14, E5, 2, 0.74, "staccato"],
	],
	[
		[0, Cs5, 4, 0.9],
		[4, E5, 2, 0.8],
		[6, A4, 6, 0.84, "tenuto"],
		[14, E5, 2, 0.7, "staccato"],
	],
];

const phraseNotes = (
	phrase: Phrase | undefined,
	transpose = 0
): Array<NoteEvent> =>
	(phrase ?? []).map(([step, pitch, duration, velocity, articulation]) =>
		n(step, pitch + transpose, duration, velocity ?? 0.85, articulation)
	);

const pianoHook = buildTrack(bars((bar) => phraseNotes(HOOK[bar % 8])));

// Long, soothing counter-line an octave under the hook (Surge only)
const COUNTER: Array<Phrase> = [
	[
		[0, F4, 8, 0.8],
		[8, A4, 8, 0.84],
	],
	[
		[0, G4, 12, 0.82],
		[12, E4, 4, 0.76],
	],
	[
		[0, E4, 8, 0.8],
		[8, G4, 8, 0.84],
	],
	[
		[0, F4, 6, 0.82],
		[6, E4, 2, 0.74],
		[8, D4, 8, 0.8],
	],
	[
		[0, D4, 8, 0.8],
		[8, F4, 8, 0.84],
	],
	[
		[0, E4, 8, 0.82],
		[8, G4, 8, 0.86],
	],
	[
		[0, A4, 12, 0.86],
		[12, G4, 4, 0.78],
	],
	[
		[0, E4, 8, 0.82],
		[8, Cs4, 8, 0.8],
	],
];
const strings = buildTrack(
	bars((bar) => (inSurge(bar) ? phraseNotes(COUNTER[bar % 8]) : null))
);

// Pad: whole-bar chords + colour tone
const pad = buildTrack(
	bars((bar) => {
		const chord = chordAt(bar);
		return [...chord.voicing, chord.color].map((pitch) =>
			n(0, pitch, 16, 0.62)
		);
	})
);

// Glass bells: 8th-note arpeggio over the voicing, an octave up
const ARP_ORDER = [0, 1, 2, 3, 2, 1, 2, 3];
const bells = buildTrack(
	bars((bar) => {
		if (bar % 16 < 8) {
			return null;
		}
		const chord = chordAt(bar);
		const tones = [
			...chord.voicing.map((pitch) => pitch + 12),
			chord.color + 12,
		]
			.filter((pitch) => pitch <= 84)
			.sort((a, b) => a - b);
		return ARP_ORDER.map((toneIndex, index) =>
			n(
				index * 2,
				tones[toneIndex % tones.length] ?? D5,
				2,
				index % 2 === 0 ? 0.62 : 0.5
			)
		);
	})
);

// Rave stabs on the offbeat 8ths, last 8 bars of Surge
const stabs = buildTrack(
	bars((bar) => {
		if (bar < 24) {
			return null;
		}
		const chord = chordAt(bar);
		return [2, 6, 10, 14].flatMap((step) =>
			chord.voicing.map((pitch) => n(step, pitch + 12, 1, 0.7, "staccato"))
		);
	})
);

// Sub (Glow): root on the 3+3+2 / downbeat feel
const sub = buildTrack(
	bars((bar) => {
		if (!inGlow(bar)) {
			return null;
		}
		const root = chordAt(bar).bass;
		return [n(0, root, 6, 0.9), n(6, root, 2, 0.75), n(8, root, 8, 0.85)];
	})
);

// Reese (Surge): rolling, with an octave pop at the end of every 2nd bar
const reese = buildTrack(
	bars((bar) => {
		if (!inSurge(bar)) {
			return null;
		}
		const root = chordAt(bar).bass;
		return [
			n(0, root, 6, 0.92),
			n(6, root, 2, 0.78),
			n(8, root, 4, 0.86),
			bar % 2 === 1 ? n(12, root + 12, 4, 0.8) : n(12, root, 4, 0.82),
		];
	})
);

// ─── Breaks ──────────────────────────────────────────────────────────────────
const hats = (velocity: number, pad = HAT): Array<NoteEvent> =>
	[0, 2, 4, 6, 8, 10, 12, 14].map((step) =>
		n(step, pad, 1, step % 4 === 0 ? velocity : velocity * 0.75)
	);

/** Lighter two-step break for the Glow section */
const glowBreak = (): Array<NoteEvent> => [
	n(0, KICK, 1, 0.95),
	n(4, SNARE, 1, 0.9),
	n(7, SNARE, 1, 0.32),
	n(10, KICK, 1, 0.85),
	n(12, SNARE, 1, 0.92),
	n(15, SNARE, 1, 0.3),
	...hats(0.42),
];

/** Classic amen-style bar on the 16th grid */
const amenA = (): Array<NoteEvent> => [
	n(0, KICK, 1, 1),
	n(2, KICK, 1, 0.85),
	n(4, SNARE, 1, 0.95),
	n(7, SNARE, 1, 0.45),
	n(9, SNARE, 1, 0.5),
	n(10, KICK, 1, 0.9),
	n(12, SNARE, 1, 0.95),
	n(15, SNARE, 1, 0.45),
	...hats(0.38, RIDE),
];

const amenB = (): Array<NoteEvent> => [
	n(0, KICK, 1, 1),
	n(2, KICK, 1, 0.85),
	n(4, SNARE, 1, 0.95),
	n(7, SNARE, 1, 0.45),
	n(9, SNARE, 1, 0.5),
	n(10, KICK, 1, 0.88),
	n(11, KICK, 1, 0.7),
	n(12, SNARE, 1, 0.92),
	n(14, SNARE, 1, 0.55),
	...hats(0.38, RIDE),
];

/** End-of-cycle fill: amen first half, then a snare / tom run */
const fill = (): Array<NoteEvent> => [
	n(0, KICK, 1, 1),
	n(2, KICK, 1, 0.85),
	n(4, SNARE, 1, 0.95),
	n(7, SNARE, 1, 0.45),
	n(8, SNARE, 1, 0.6),
	n(9, SNARE, 1, 0.65),
	n(10, HIGH_TOM, 1, 0.75),
	n(11, HIGH_TOM, 1, 0.8),
	n(12, SNARE, 1, 0.85),
	n(13, LOW_TOM, 1, 0.85),
	n(14, SNARE, 1, 0.9),
	n(15, SNARE, 1, 0.98),
	...hats(0.34, HAT).filter((note) => note.step < 8),
];

const glowBreaks = buildTrack(
	bars((bar) => {
		if (!inGlow(bar)) {
			return null;
		}
		const notes = bar % 8 === 7 ? fill() : glowBreak();
		return bar === 0 || bar === 8 ? [...notes, n(0, OPEN_HAT, 2, 0.6)] : notes;
	})
);

const surgeBreaks = buildTrack(
	bars((bar) => {
		if (!inSurge(bar)) {
			return null;
		}
		if (bar % 8 === 7) {
			return fill();
		}
		const notes = bar % 2 === 0 ? amenA() : amenB();
		return bar % 8 === 0 ? [...notes, n(0, OPEN_HAT, 2, 0.7)] : notes;
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
	overrides: Partial<Omit<Channel["instrument"], "modern">> = {},
	modernOverrides: Partial<ModernInstrumentSettings> = {}
): Channel => {
	const preset = getModernPresetById(presetId);
	if (!preset?.configuration.modern) {
		throw new Error(`Unknown modern preset ${presetId}`);
	}
	return {
		id,
		name,
		type,
		color,
		muted: false,
		solo: false,
		instrument: {
			...preset.configuration,
			...overrides,
			modern: { ...preset.configuration.modern, ...modernOverrides },
		},
		barSequence: track.barSequence,
		patterns: track.patterns,
	};
};

export const AFTERGLOW_SECTIONS = [
	{ name: "Glow", startBar: 0, endBar: 15 },
	{ name: "Surge", startBar: 16, endBar: 31 },
] as const;

export const modernAfterglowSong: SongProject = {
	id: "demo-modern-afterglow-174",
	title: "Afterglow Circuit",
	author: "UltraBeep Demo",
	engine: "modern",
	bpm: 174,
	beatsPerBar: 4,
	stepsPerBeat: 4,
	totalBars: TOTAL_BARS,
	loopStartBar: 0,
	loopEndBar: TOTAL_BARS - 1,
	swing: 0,
	rootKey: "D",
	scale: "minor",
	masterVolume: 0.8,
	sections: AFTERGLOW_SECTIONS.map((section) => ({
		id: `ag-section-${section.name.toLowerCase()}`,
		name: section.name,
		startBar: section.startBar,
		endBar: section.endBar,
	})),
	updatedAt: 1795400000000,
	channels: [
		makeChannel(
			"ag-piano",
			"Dream Piano",
			"pitch",
			"#fde68a",
			"modern-dream-piano",
			pianoHook,
			{ volume: 0.9, pan: -0.04 }
		),
		makeChannel(
			"ag-pad",
			"Dream Pad",
			"pitch",
			"#c4b5fd",
			"modern-dream-pad",
			pad,
			{ volume: 0.42, pan: 0.08 }
		),
		makeChannel(
			"ag-bells",
			"Glass Bells",
			"pitch",
			"#a5f3fc",
			"modern-glass-bells",
			bells,
			{ volume: 0.5, pan: 0.3 }
		),
		makeChannel(
			"ag-strings",
			"String Line",
			"pitch",
			"#f9a8d4",
			"modern-string-section",
			strings,
			{ volume: 0.42, pan: -0.2 }
		),
		makeChannel(
			"ag-stabs",
			"Rave Stabs",
			"pitch",
			"#f472b6",
			"modern-rave-stab",
			stabs,
			{ volume: 0.34, pan: 0.12 }
		),
		makeChannel(
			"ag-sub",
			"Sub Bass",
			"pitch",
			"#38bdf8",
			"modern-sub-bass",
			sub,
			{ volume: 0.62 }
		),
		makeChannel(
			"ag-reese",
			"Reese Bass",
			"pitch",
			"#fb7185",
			"modern-reese-bass",
			reese,
			{ volume: 0.4 }
		),
		makeChannel(
			"ag-glow-break",
			"Glow Break",
			"drum",
			"#facc15",
			"modern-break-kit",
			glowBreaks,
			{ volume: 0.8 }
		),
		makeChannel(
			"ag-amen",
			"Crushed Amen",
			"drum",
			"#ef4444",
			"modern-crushed-breaks",
			surgeBreaks,
			{ volume: 0.78 }
		),
	],
};

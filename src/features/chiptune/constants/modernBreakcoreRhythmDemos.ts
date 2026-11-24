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
 * Three Modern Mode breakcore rhythm-and-bass demos with strictly zero lead
 * notes (no melodies, chords, pads, arps, or keys — only breakcore bass & drums):
 *
 *  1. `modernAmenReeseSong`   ("Amen & Reese 174", F minor, 174 BPM)
 *  2. `modernGabberChopSong`  ("Gabber Chop 185", C# minor, 185 BPM)
 *  3. `modernHalftime808Song` ("808 Half-Time 172", G minor, 172 BPM)
 */

// Drum pads (shared across all modern drum kits)
const KICK = 0;
const SNARE = 1;
const HAT = 2;
const OPEN_HAT = 3;
const CLAP = 6;
const CYM = 7;

const TOTAL_BARS = 32;

interface NoteOptions {
	velocity?: number;
	articulation?: NoteArticulation;
	ratchet?: number;
	cutoff?: number;
	sweepTo?: number;
}

type NoteBuilder = (
	step: number,
	pitch: number,
	duration?: number,
	options?: NoteOptions
) => NoteEvent;

const createNoteFactory = (prefix: string): NoteBuilder => {
	let noteCounter = 0;
	return (
		step: number,
		pitch: number,
		duration = 1,
		options: NoteOptions = {}
	): NoteEvent => {
		noteCounter += 1;
		return {
			id: `${prefix}-${noteCounter}-${step}-${pitch}`,
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
};

const buildTrack = (
	barsList: Array<Array<NoteEvent> | null>
): { patterns: Record<string, Pattern>; barSequence: Array<number> } => {
	const patterns: Record<string, Pattern> = {};
	const signatures: Array<string> = [];
	const barSequence = barsList.map((notes) => {
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

const bars = (
	build: (bar: number) => Array<NoteEvent> | null
): Array<Array<NoteEvent> | null> =>
	Array.from({ length: TOTAL_BARS }, (_, bar) => build(bar));

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

// ═════════════════════════════════════════════════════════════════════════════
// 1. "Amen & Reese 174" — 174 BPM F-minor jungle / breakcore bass & drums
// ═════════════════════════════════════════════════════════════════════════════

const arNote = createNoteFactory("ar");

// F minor bass pitches (MIDI 36-53)
const F_MIN_C2 = 36;
const F_MIN_DB2 = 37;
const F_MIN_EB2 = 39;
const F_MIN_F2 = 41;
const F_MIN_G2 = 43;
const F_MIN_AB2 = 44;
const F_MIN_BB2 = 46;
const F_MIN_C3 = 48;
const F_MIN_DB3 = 49;
const F_MIN_EB3 = 51;
const F_MIN_F3 = 53;

interface AmenReeseBassRoot {
	sub: number;
	subPass: number;
	reese: number;
	reesePass: number;
}

const AR_CYCLE: Array<AmenReeseBassRoot> = [
	{
		sub: F_MIN_F2,
		subPass: F_MIN_EB2,
		reese: F_MIN_F2,
		reesePass: F_MIN_C3,
	},
	{
		sub: F_MIN_DB2,
		subPass: F_MIN_F2,
		reese: F_MIN_DB3,
		reesePass: F_MIN_EB3,
	},
	{
		sub: F_MIN_AB2,
		subPass: F_MIN_F2,
		reese: F_MIN_AB2,
		reesePass: F_MIN_BB2,
	},
	{
		sub: F_MIN_EB2,
		subPass: F_MIN_G2,
		reese: F_MIN_EB3,
		reesePass: F_MIN_F3,
	},
	{
		sub: F_MIN_BB2,
		subPass: F_MIN_F2,
		reese: F_MIN_BB2,
		reesePass: F_MIN_C3,
	},
	{
		sub: F_MIN_DB2,
		subPass: F_MIN_EB2,
		reese: F_MIN_DB3,
		reesePass: F_MIN_C3,
	},
	{
		sub: F_MIN_C2,
		subPass: F_MIN_DB2,
		reese: F_MIN_C3,
		reesePass: F_MIN_BB2,
	},
	{
		sub: F_MIN_EB2,
		subPass: F_MIN_C2,
		reese: F_MIN_EB3,
		reesePass: F_MIN_C3,
	},
];

const arRootAt = (bar: number): AmenReeseBassRoot =>
	AR_CYCLE[bar % AR_CYCLE.length] ?? (AR_CYCLE[0] as AmenReeseBassRoot);

const arSubTrack = buildTrack(
	bars((bar) => {
		if (bar >= 16) {
			return null;
		}
		const { sub, subPass } = arRootAt(bar);
		if (bar < 8) {
			return [
				arNote(0, sub, 6, { velocity: 0.94 }),
				arNote(6, sub, 2, { velocity: 0.78 }),
				arNote(8, sub, 6, { velocity: 0.88 }),
				bar % 2 === 1
					? arNote(14, subPass, 2, { velocity: 0.78, articulation: "legato" })
					: arNote(14, sub, 2, { velocity: 0.78 }),
			];
		}
		if (bar === 15) {
			return [
				arNote(0, sub, 2, { velocity: 0.96 }),
				arNote(2, sub, 6, { velocity: 0.9 }),
			];
		}
		return [
			arNote(0, sub, 2, { velocity: 0.96 }),
			arNote(2, sub, 4, { velocity: 0.88 }),
			arNote(6, sub, 2, { velocity: 0.76 }),
			arNote(8, sub, 2, { velocity: 0.85 }),
			arNote(10, sub, 4, { velocity: 0.92 }),
			arNote(14, subPass, 2, { velocity: 0.8, articulation: "legato" }),
		];
	})
);

const arReeseTrack = buildTrack(
	bars((bar) => {
		if (bar < 16) {
			return null;
		}
		const { reese, reesePass } = arRootAt(bar);
		if (bar < 24) {
			return [
				arNote(0, reese, 6, { velocity: 0.92, cutoff: 540, sweepTo: 2100 }),
				arNote(6, reese, 2, { velocity: 0.78 }),
				arNote(8, reese, 4, { velocity: 0.88, cutoff: 1700, sweepTo: 620 }),
				bar % 2 === 1
					? arNote(12, reesePass, 4, {
							velocity: 0.84,
							articulation: "legato",
						})
					: arNote(12, reese, 4, { velocity: 0.84 }),
			];
		}
		if (bar === 31) {
			return [
				arNote(0, reese, 4, { velocity: 0.94, cutoff: 1800, sweepTo: 420 }),
				arNote(4, reese, 4, { velocity: 0.82 }),
			];
		}
		return [
			arNote(0, reese, 3, {
				velocity: 0.94,
				articulation: "accent",
				cutoff: 620,
				sweepTo: 2600,
			}),
			arNote(3, reese, 3, { velocity: 0.8 }),
			arNote(6, reesePass, 2, { velocity: 0.84, articulation: "legato" }),
			arNote(8, reese, 2, { velocity: 0.88 }),
			arNote(10, reese, 2, { velocity: 0.84 }),
			arNote(12, reesePass, 2, { velocity: 0.86, articulation: "legato" }),
			arNote(14, reese, 2, { velocity: 0.8, articulation: "legato" }),
		];
	})
);

const arEighthHats = (
	noteFn: NoteBuilder,
	velocity: number,
	pad = HAT
): Array<NoteEvent> =>
	[0, 2, 4, 6, 8, 10, 12, 14].map((step) =>
		noteFn(step, pad, 1, {
			velocity: step % 4 === 0 ? velocity : velocity * 0.76,
		})
	);

const arAmenClassicA = (): Array<NoteEvent> => [
	arNote(0, KICK, 1, { velocity: 1 }),
	arNote(2, KICK, 1, { velocity: 0.86 }),
	arNote(4, SNARE, 1, { velocity: 0.96 }),
	arNote(7, SNARE, 1, { velocity: 0.42 }),
	arNote(9, SNARE, 1, { velocity: 0.48 }),
	arNote(10, KICK, 1, { velocity: 0.9 }),
	arNote(12, SNARE, 1, { velocity: 0.95 }),
	arNote(15, SNARE, 1, { velocity: 0.42 }),
	...arEighthHats(arNote, 0.42, HAT),
];

const arAmenClassicB = (): Array<NoteEvent> => [
	arNote(0, KICK, 1, { velocity: 1 }),
	arNote(2, KICK, 1, { velocity: 0.86 }),
	arNote(4, SNARE, 1, { velocity: 0.96 }),
	arNote(7, SNARE, 1, { velocity: 0.42 }),
	arNote(9, SNARE, 1, { velocity: 0.48 }),
	arNote(10, KICK, 1, { velocity: 0.88 }),
	arNote(11, KICK, 1, { velocity: 0.72 }),
	arNote(12, SNARE, 1, { velocity: 0.94 }),
	arNote(14, SNARE, 1, { velocity: 0.55 }),
	...arEighthHats(arNote, 0.42, HAT),
];

const arThinkChop = (): Array<NoteEvent> => [
	arNote(0, KICK, 1, { velocity: 1 }),
	arNote(2, KICK, 1, { velocity: 0.84 }),
	arNote(4, SNARE, 1, { velocity: 0.96 }),
	arNote(6, KICK, 1, { velocity: 0.8 }),
	arNote(7, SNARE, 1, { velocity: 0.45 }),
	arNote(9, SNARE, 1, { velocity: 0.52 }),
	arNote(10, KICK, 1, { velocity: 0.9 }),
	arNote(12, SNARE, 1, { velocity: 0.95 }),
	arNote(15, SNARE, 1, { velocity: 0.48 }),
	...arEighthHats(arNote, 0.38, CYM),
];

const arSnareFill = (): Array<NoteEvent> => [
	arNote(0, KICK, 1, { velocity: 1 }),
	arNote(2, KICK, 1, { velocity: 0.86 }),
	arNote(4, SNARE, 1, { velocity: 0.96 }),
	arNote(7, SNARE, 1, { velocity: 0.48 }),
	arNote(8, KICK, 1, { velocity: 0.9 }),
	arNote(9, SNARE, 1, { velocity: 0.52 }),
	arNote(10, SNARE, 1, { velocity: 0.72 }),
	arNote(11, KICK, 1, { velocity: 0.82 }),
	arNote(12, SNARE, 4, { velocity: 0.84, ratchet: 6 }),
	...[0, 2, 4, 6].map((step) => arNote(step, HAT, 1, { velocity: 0.38 })),
];

const arSectionRoll = (): Array<NoteEvent> => [
	arNote(0, KICK, 1, { velocity: 1 }),
	arNote(2, KICK, 1, { velocity: 0.86 }),
	arNote(4, SNARE, 1, { velocity: 0.96 }),
	arNote(7, SNARE, 1, { velocity: 0.48 }),
	arNote(8, SNARE, 4, { velocity: 0.76, ratchet: 4 }),
	arNote(12, SNARE, 4, { velocity: 0.94, ratchet: 8 }),
	...[0, 2, 4, 6].map((step) => arNote(step, HAT, 1, { velocity: 0.38 })),
];

const arJungleTrack = buildTrack(
	bars((bar) => {
		if (bar >= 16) {
			return null;
		}
		if (bar === 7) {
			return arSnareFill();
		}
		if (bar === 15) {
			return arSectionRoll();
		}
		if (bar < 7) {
			const notes = bar % 2 === 0 ? arAmenClassicA() : arAmenClassicB();
			return bar === 0
				? [...notes, arNote(0, OPEN_HAT, 2, { velocity: 0.62 })]
				: notes;
		}
		const notes =
			bar % 2 === 0
				? [
						...arAmenClassicA().filter((note) => note.pitch !== HAT),
						...arEighthHats(arNote, 0.38, CYM),
					]
				: arThinkChop();
		return bar === 8
			? [...notes, arNote(0, OPEN_HAT, 2, { velocity: 0.62 })]
			: notes;
	})
);

const arCrushedChopA = (): Array<NoteEvent> => [
	arNote(0, KICK, 1, { velocity: 1 }),
	arNote(2, KICK, 1, { velocity: 0.88 }),
	arNote(4, SNARE, 1, { velocity: 0.98 }),
	arNote(7, SNARE, 1, { velocity: 0.46 }),
	arNote(9, SNARE, 1, { velocity: 0.54 }),
	arNote(10, KICK, 1, { velocity: 0.9 }),
	arNote(11, KICK, 1, { velocity: 0.76 }),
	arNote(12, SNARE, 1, { velocity: 0.96 }),
	arNote(15, SNARE, 1, { velocity: 0.48 }),
	...arEighthHats(arNote, 0.38, CYM),
	...[0, 4, 8, 12].map((step) => arNote(step, HAT, 1, { velocity: 0.42 })),
];

const arCrushedChopB = (): Array<NoteEvent> => [
	arNote(0, KICK, 1, { velocity: 1 }),
	arNote(2, SNARE, 1, { velocity: 0.58 }),
	arNote(3, KICK, 1, { velocity: 0.86 }),
	arNote(4, SNARE, 1, { velocity: 0.98 }),
	arNote(6, KICK, 1, { velocity: 0.86 }),
	arNote(7, SNARE, 1, { velocity: 0.45 }),
	arNote(10, SNARE, 1, { velocity: 0.82 }),
	arNote(11, KICK, 1, { velocity: 0.84 }),
	arNote(12, SNARE, 1, { velocity: 0.96 }),
	arNote(14, SNARE, 1, { velocity: 0.65 }),
	arNote(15, SNARE, 1, { velocity: 0.5 }),
	...arEighthHats(arNote, 0.38, CYM),
];

const arCrushedTrack = buildTrack(
	bars((bar) => {
		if (bar < 16) {
			return null;
		}
		if (bar === 23) {
			return arSnareFill();
		}
		if (bar === 31) {
			return arSectionRoll();
		}
		if (bar < 23) {
			const notes = bar % 2 === 0 ? arCrushedChopA() : arCrushedChopB();
			return bar === 16
				? [...notes, arNote(0, OPEN_HAT, 2, { velocity: 0.68 })]
				: notes;
		}
		const base = bar % 2 === 0 ? arCrushedChopA() : arCrushedChopB();
		const intense =
			bar % 2 === 1
				? [
						...base.filter(
							(note) => !(note.pitch === SNARE && note.step >= 14)
						),
						arNote(14, SNARE, 2, { velocity: 0.72, ratchet: 2 }),
						arNote(6, OPEN_HAT, 1, { velocity: 0.48 }),
						arNote(14, OPEN_HAT, 1, { velocity: 0.48 }),
					]
				: [
						...base,
						arNote(6, OPEN_HAT, 1, { velocity: 0.48 }),
						arNote(14, OPEN_HAT, 1, { velocity: 0.48 }),
					];
		return bar === 24
			? [...intense, arNote(0, OPEN_HAT, 2, { velocity: 0.68 })]
			: intense;
	})
);

export const AMEN_REESE_SECTIONS = [
	{ name: "Roller", startBar: 0, endBar: 15 },
	{ name: "Overdrive", startBar: 16, endBar: 31 },
] as const;

export const modernAmenReeseSong: SongProject = {
	id: "demo-modern-amen-reese-174",
	title: "Amen & Reese 174",
	author: "UltraBeep Demo",
	engine: "modern",
	bpm: 174,
	beatsPerBar: 4,
	stepsPerBeat: 4,
	totalBars: TOTAL_BARS,
	loopStartBar: 0,
	loopEndBar: TOTAL_BARS - 1,
	swing: 0,
	rootKey: "F",
	scale: "minor",
	masterVolume: 0.82,
	sections: AMEN_REESE_SECTIONS.map((section) => ({
		id: `ar-section-${section.name.toLowerCase()}`,
		name: section.name,
		startBar: section.startBar,
		endBar: section.endBar,
	})),
	updatedAt: 1795400100000,
	channels: [
		makeChannel(
			"ar-sub",
			"Sub Bass",
			"pitch",
			"#38bdf8",
			"modern-sub-bass",
			arSubTrack,
			{ volume: 0.76 },
			{ sidechain: 0.45 }
		),
		makeChannel(
			"ar-reese",
			"Reese Bass",
			"pitch",
			"#fb7185",
			"modern-reese-bass",
			arReeseTrack,
			{ volume: 0.54 },
			{ cutoff: 900, drive: 0.5, sidechain: 0.42 }
		),
		makeChannel(
			"ar-jungle",
			"Jungle Breaks",
			"drum",
			"#facc15",
			"modern-break-kit",
			arJungleTrack,
			{ volume: 0.86 },
			{ drive: 0.28 }
		),
		makeChannel(
			"ar-crushed",
			"Crushed Amen",
			"drum",
			"#ef4444",
			"modern-crushed-breaks",
			arCrushedTrack,
			{ volume: 0.84 },
			{ tune: 2, drive: 0.68 }
		),
	],
};

// ═════════════════════════════════════════════════════════════════════════════
// 2. "Gabber Chop 185" — 185 BPM C#-minor hardcore kick & sliced amen breaks
// ═════════════════════════════════════════════════════════════════════════════

const gcNote = createNoteFactory("gc");

// C# minor bass pitches (MIDI 37-59)
const CS_MIN_CS2 = 37;
const CS_MIN_E2 = 40;
const CS_MIN_FS2 = 42;
const CS_MIN_GS2 = 44;
const CS_MIN_A2 = 45;
const CS_MIN_B2 = 47;
const CS_MIN_CS3 = 49;
const CS_MIN_DS3 = 51;
const CS_MIN_E3 = 52;
const CS_MIN_FS3 = 54;
const CS_MIN_GS3 = 56;
const CS_MIN_B3 = 59;

interface GabberBassRoot {
	root: number;
	low: number;
	acidHigh: number;
	fifth: number;
}

const GC_CYCLE: Array<GabberBassRoot> = [
	{
		root: CS_MIN_CS3,
		low: CS_MIN_CS2,
		acidHigh: CS_MIN_E3,
		fifth: CS_MIN_GS2,
	},
	{
		root: CS_MIN_CS3,
		low: CS_MIN_CS2,
		acidHigh: CS_MIN_FS3,
		fifth: CS_MIN_B2,
	},
	{ root: CS_MIN_A2, low: CS_MIN_A2, acidHigh: CS_MIN_E3, fifth: CS_MIN_E2 },
	{ root: CS_MIN_B2, low: CS_MIN_B2, acidHigh: CS_MIN_FS3, fifth: CS_MIN_FS2 },
	{
		root: CS_MIN_CS3,
		low: CS_MIN_CS2,
		acidHigh: CS_MIN_GS3,
		fifth: CS_MIN_GS2,
	},
	{ root: CS_MIN_E3, low: CS_MIN_E2, acidHigh: CS_MIN_B3, fifth: CS_MIN_B2 },
	{ root: CS_MIN_A2, low: CS_MIN_A2, acidHigh: CS_MIN_E3, fifth: CS_MIN_E2 },
	{ root: CS_MIN_GS2, low: CS_MIN_GS2, acidHigh: CS_MIN_DS3, fifth: CS_MIN_B2 },
];

const gcRootAt = (bar: number): GabberBassRoot =>
	GC_CYCLE[bar % GC_CYCLE.length] ?? (GC_CYCLE[0] as GabberBassRoot);

const gcNeuroTrack = buildTrack(
	bars((bar) => {
		const { root, fifth } = gcRootAt(bar);
		if (bar === 15) {
			return [
				gcNote(0, root, 4, { velocity: 0.96, cutoff: 2400, sweepTo: 480 }),
			];
		}
		if (bar === 31) {
			return [
				gcNote(0, root, 4, { velocity: 0.96, cutoff: 2600, sweepTo: 420 }),
			];
		}
		if (bar < 8) {
			return [
				gcNote(0, root, 8, { velocity: 0.92, cutoff: 720, sweepTo: 2200 }),
				gcNote(8, root, 6, { velocity: 0.88, cutoff: 1800, sweepTo: 700 }),
				gcNote(14, fifth, 2, { velocity: 0.82, articulation: "legato" }),
			];
		}
		if (bar < 15) {
			return [
				gcNote(0, root, 3, { velocity: 0.94, articulation: "marcato" }),
				gcNote(3, root, 3, { velocity: 0.82 }),
				gcNote(6, fifth, 2, { velocity: 0.84, articulation: "legato" }),
				gcNote(8, root, 4, { velocity: 0.92, cutoff: 650, sweepTo: 2800 }),
				gcNote(12, root, 2, { velocity: 0.86 }),
				gcNote(14, fifth, 2, { velocity: 0.84, articulation: "legato" }),
			];
		}
		return [
			gcNote(0, root, 4, { velocity: 0.92, cutoff: 680, sweepTo: 2500 }),
			gcNote(4, root, 4, { velocity: 0.86 }),
			gcNote(8, root, 3, { velocity: 0.9 }),
			gcNote(11, fifth, 3, { velocity: 0.84, articulation: "legato" }),
			gcNote(14, root, 2, { velocity: 0.88, articulation: "legato" }),
		];
	})
);

const gcAcidTrack = buildTrack(
	bars((bar) => {
		if (bar < 16) {
			return null;
		}
		const { low, acidHigh, fifth } = gcRootAt(bar);
		if (bar === 31) {
			return [
				gcNote(0, low, 2, { velocity: 0.94, articulation: "accent" }),
				gcNote(2, acidHigh, 2, { velocity: 0.9, articulation: "legato" }),
				gcNote(4, low, 4, { velocity: 0.88, cutoff: 900, sweepTo: 4200 }),
			];
		}
		const isPeak = bar >= 24;
		return [
			gcNote(0, low, 2, {
				velocity: 0.9,
				articulation: "accent",
				...(isPeak ? { cutoff: 750, sweepTo: 3600 } : {}),
			}),
			gcNote(2, low, 1, { velocity: 0.72, articulation: "staccato" }),
			gcNote(3, acidHigh, 2, { velocity: 0.88, articulation: "legato" }),
			gcNote(5, low, 1, { velocity: 0.7 }),
			gcNote(6, fifth, 2, { velocity: 0.84 }),
			gcNote(8, low, 2, {
				velocity: 0.92,
				articulation: "accent",
				...(isPeak ? { cutoff: 900, sweepTo: 3800 } : {}),
			}),
			gcNote(10, acidHigh, 2, { velocity: 0.86, articulation: "legato" }),
			gcNote(12, low, 2, { velocity: 0.78 }),
			gcNote(14, fifth, 2, { velocity: 0.85, articulation: "legato" }),
		];
	})
);

const gcSixteenthHats = (accentVelocity = 0.44): Array<NoteEvent> =>
	Array.from({ length: 16 }, (_, step) =>
		gcNote(step, HAT, 1, {
			velocity: step % 2 === 0 ? accentVelocity : accentVelocity * 0.62,
		})
	);

const gcGabberStomp = (extraTurnaroundKick: boolean): Array<NoteEvent> => [
	...[0, 4, 8, 12].map((step) => gcNote(step, KICK, 1, { velocity: 1 })),
	...(extraTurnaroundKick ? [gcNote(14, KICK, 1, { velocity: 0.88 })] : []),
	...[2, 6, 10, 14].map((step) =>
		gcNote(step, OPEN_HAT, 1, { velocity: 0.45 })
	),
	...[0, 4, 8, 12].map((step) => gcNote(step, HAT, 1, { velocity: 0.36 })),
];

const gcGabberSyncA = (): Array<NoteEvent> => [
	...[0, 4, 8, 10, 12].map((step) => gcNote(step, KICK, 1, { velocity: 0.96 })),
	gcNote(4, SNARE, 1, { velocity: 0.92 }),
	gcNote(12, SNARE, 1, { velocity: 0.94 }),
	...[7, 9, 15].map((step) => gcNote(step, SNARE, 1, { velocity: 0.45 })),
	...gcSixteenthHats(0.42),
];

const gcGabberSyncB = (): Array<NoteEvent> => [
	...[0, 3, 6, 8, 11, 14].map((step) =>
		gcNote(step, KICK, 1, { velocity: step % 4 === 0 ? 1 : 0.88 })
	),
	gcNote(4, SNARE, 1, { velocity: 0.92 }),
	gcNote(12, SNARE, 1, { velocity: 0.94 }),
	gcNote(14, CYM, 1, { velocity: 0.72 }),
	...gcSixteenthHats(0.42),
];

const gcGabberRiotA = (withStartChop: boolean): Array<NoteEvent> => [
	...[0, 4, 8, 10, 12, 14].map((step) =>
		gcNote(step, KICK, 1, { velocity: step % 4 === 0 ? 1 : 0.9 })
	),
	...(withStartChop ? [gcNote(0, CYM, 1, { velocity: 0.78 })] : []),
	...[2, 6, 10, 14].map((step) =>
		gcNote(step, OPEN_HAT, 1, { velocity: 0.46 })
	),
];

const gcGabberRiotB = (): Array<NoteEvent> => [
	...[0, 3, 6, 8, 11, 12, 15].map((step) =>
		gcNote(step, KICK, 1, { velocity: step % 4 === 0 ? 1 : 0.88 })
	),
	gcNote(14, CYM, 1, { velocity: 0.76 }),
	...[2, 6, 10, 14].map((step) =>
		gcNote(step, OPEN_HAT, 1, { velocity: 0.46 })
	),
];

const gcGabberTrack = buildTrack(
	bars((bar) => {
		if (bar === 7) {
			return [
				...[0, 4, 8, 10, 12].map((step) =>
					gcNote(step, KICK, 1, { velocity: 0.98 })
				),
				gcNote(14, KICK, 2, { velocity: 0.95, ratchet: 2 }),
				gcNote(4, SNARE, 1, { velocity: 0.9 }),
				gcNote(12, SNARE, 1, { velocity: 0.92 }),
			];
		}
		if (bar === 15) {
			return [
				...[0, 2, 4, 6].map((step) =>
					gcNote(step, KICK, 1, { velocity: 0.98 })
				),
				gcNote(8, KICK, 4, { velocity: 0.92, ratchet: 4 }),
				gcNote(12, KICK, 4, { velocity: 1, ratchet: 6 }),
				gcNote(12, SNARE, 4, { velocity: 0.92, ratchet: 8 }),
			];
		}
		if (bar === 23 || bar === 31) {
			return [
				...[0, 2, 4, 6].map((step) =>
					gcNote(step, KICK, 1, { velocity: 0.98 })
				),
				gcNote(8, KICK, 4, { velocity: 0.94, ratchet: 4 }),
				gcNote(12, KICK, 4, { velocity: 1, ratchet: 4 }),
				gcNote(12, SNARE, 4, { velocity: 0.96, ratchet: 8 }),
			];
		}
		if (bar < 7) {
			return gcGabberStomp(bar === 3);
		}
		if (bar < 15) {
			return bar % 2 === 0 ? gcGabberSyncA() : gcGabberSyncB();
		}
		return bar % 2 === 0 ? gcGabberRiotA(bar % 4 === 0) : gcGabberRiotB();
	})
);

const gcSlicedChopA = (): Array<NoteEvent> => [
	gcNote(0, KICK, 1, { velocity: 0.85 }),
	gcNote(2, SNARE, 1, { velocity: 0.56 }),
	gcNote(4, SNARE, 1, { velocity: 0.98 }),
	gcNote(7, SNARE, 1, { velocity: 0.48 }),
	gcNote(9, SNARE, 1, { velocity: 0.52 }),
	gcNote(10, KICK, 1, { velocity: 0.86 }),
	gcNote(12, SNARE, 1, { velocity: 0.98 }),
	gcNote(15, SNARE, 1, { velocity: 0.48 }),
	...arEighthHats(gcNote, 0.4, CYM),
];

const gcSlicedChopB = (): Array<NoteEvent> => [
	gcNote(0, KICK, 1, { velocity: 0.86 }),
	gcNote(1, SNARE, 1, { velocity: 0.36 }),
	gcNote(3, KICK, 1, { velocity: 0.8 }),
	gcNote(4, SNARE, 1, { velocity: 0.98 }),
	gcNote(6, SNARE, 1, { velocity: 0.62 }),
	gcNote(9, SNARE, 1, { velocity: 0.5 }),
	gcNote(11, KICK, 1, { velocity: 0.84 }),
	gcNote(12, SNARE, 1, { velocity: 0.96 }),
	gcNote(14, SNARE, 1, { velocity: 0.72 }),
	gcNote(15, SNARE, 1, { velocity: 0.46 }),
	...arEighthHats(gcNote, 0.4, CYM),
];

const gcHyperChopA = (): Array<NoteEvent> => [
	gcNote(0, KICK, 1, { velocity: 0.85 }),
	gcNote(2, SNARE, 1, { velocity: 0.86 }),
	gcNote(4, SNARE, 1, { velocity: 0.98 }),
	gcNote(6, KICK, 1, { velocity: 0.84 }),
	gcNote(7, SNARE, 1, { velocity: 0.55 }),
	gcNote(10, SNARE, 1, { velocity: 0.9 }),
	gcNote(12, SNARE, 2, { velocity: 0.96, ratchet: 2 }),
	gcNote(14, SNARE, 1, { velocity: 0.7 }),
	...gcSixteenthHats(0.42),
	...arEighthHats(gcNote, 0.36, CYM),
];

const gcHyperChopB = (): Array<NoteEvent> => [
	gcNote(0, KICK, 1, { velocity: 0.86 }),
	gcNote(1, SNARE, 1, { velocity: 0.42 }),
	gcNote(4, SNARE, 1, { velocity: 0.98 }),
	gcNote(5, KICK, 1, { velocity: 0.78 }),
	gcNote(7, SNARE, 1, { velocity: 0.6 }),
	gcNote(9, SNARE, 1, { velocity: 0.54 }),
	gcNote(10, SNARE, 1, { velocity: 0.88 }),
	gcNote(12, SNARE, 1, { velocity: 0.98 }),
	gcNote(13, SNARE, 3, { velocity: 0.86, ratchet: 3 }),
	...gcSixteenthHats(0.42),
	...arEighthHats(gcNote, 0.36, CYM),
];

const gcHyperChopC = (): Array<NoteEvent> => [
	gcNote(0, KICK, 1, { velocity: 0.86 }),
	gcNote(2, SNARE, 1, { velocity: 0.78 }),
	gcNote(3, SNARE, 1, { velocity: 0.45 }),
	gcNote(4, SNARE, 1, { velocity: 0.98 }),
	gcNote(7, SNARE, 1, { velocity: 0.6 }),
	gcNote(8, KICK, 1, { velocity: 0.84 }),
	gcNote(10, SNARE, 1, { velocity: 0.9 }),
	gcNote(12, SNARE, 1, { velocity: 0.98 }),
	gcNote(14, SNARE, 2, { velocity: 0.82, ratchet: 2 }),
	...gcSixteenthHats(0.44),
	...arEighthHats(gcNote, 0.36, CYM),
];

const gcAmenTrack = buildTrack(
	bars((bar) => {
		if (bar < 4) {
			return null;
		}
		if (bar === 7) {
			return [
				gcNote(0, KICK, 1, { velocity: 0.85 }),
				gcNote(4, SNARE, 1, { velocity: 0.96 }),
				gcNote(7, SNARE, 1, { velocity: 0.52 }),
				gcNote(8, KICK, 1, { velocity: 0.86 }),
				gcNote(9, SNARE, 1, { velocity: 0.54 }),
				gcNote(10, SNARE, 1, { velocity: 0.74 }),
				gcNote(11, KICK, 1, { velocity: 0.8 }),
				gcNote(12, SNARE, 4, { velocity: 0.9, ratchet: 4 }),
				...arEighthHats(gcNote, 0.38, CYM),
			];
		}
		if (bar === 15) {
			return [
				gcNote(0, KICK, 1, { velocity: 0.85 }),
				gcNote(2, SNARE, 1, { velocity: 0.7 }),
				gcNote(4, SNARE, 1, { velocity: 0.98 }),
				gcNote(6, KICK, 1, { velocity: 0.82 }),
				gcNote(7, SNARE, 1, { velocity: 0.54 }),
				gcNote(8, SNARE, 4, { velocity: 0.8, ratchet: 4 }),
				gcNote(12, SNARE, 4, { velocity: 0.96, ratchet: 8 }),
			];
		}
		if (bar === 23) {
			return [
				gcNote(0, KICK, 1, { velocity: 0.85 }),
				gcNote(4, SNARE, 1, { velocity: 0.98 }),
				gcNote(7, SNARE, 1, { velocity: 0.52 }),
				gcNote(8, KICK, 1, { velocity: 0.88 }),
				gcNote(9, SNARE, 1, { velocity: 0.58 }),
				gcNote(10, SNARE, 1, { velocity: 0.78 }),
				gcNote(11, KICK, 1, { velocity: 0.82 }),
				gcNote(12, SNARE, 4, { velocity: 0.92, ratchet: 6 }),
				...[0, 2, 4, 6].map((step) => gcNote(step, HAT, 1, { velocity: 0.4 })),
			];
		}
		if (bar === 31) {
			return [
				gcNote(0, KICK, 1, { velocity: 0.88 }),
				gcNote(2, SNARE, 1, { velocity: 0.78 }),
				gcNote(4, SNARE, 1, { velocity: 0.98 }),
				gcNote(6, KICK, 1, { velocity: 0.84 }),
				gcNote(7, SNARE, 1, { velocity: 0.58 }),
				gcNote(8, SNARE, 4, { velocity: 0.86, ratchet: 6 }),
				gcNote(12, SNARE, 4, { velocity: 0.98, ratchet: 8 }),
			];
		}
		if (bar < 15) {
			return bar % 2 === 0 ? gcSlicedChopA() : gcSlicedChopB();
		}
		const patternIndex = (bar - 16) % 3;
		if (patternIndex === 0) {
			return gcHyperChopA();
		}
		if (patternIndex === 1) {
			return gcHyperChopB();
		}
		return gcHyperChopC();
	})
);

export const GABBER_CHOP_SECTIONS = [
	{ name: "Stomp", startBar: 0, endBar: 15 },
	{ name: "Riot", startBar: 16, endBar: 31 },
] as const;

export const modernGabberChopSong: SongProject = {
	id: "demo-modern-gabber-chop-185",
	title: "Gabber Chop 185",
	author: "UltraBeep Demo",
	engine: "modern",
	bpm: 185,
	beatsPerBar: 4,
	stepsPerBeat: 4,
	totalBars: TOTAL_BARS,
	loopStartBar: 0,
	loopEndBar: TOTAL_BARS - 1,
	swing: 0,
	rootKey: "C#",
	scale: "minor",
	masterVolume: 0.8,
	sections: GABBER_CHOP_SECTIONS.map((section) => ({
		id: `gc-section-${section.name.toLowerCase()}`,
		name: section.name,
		startBar: section.startBar,
		endBar: section.endBar,
	})),
	updatedAt: 1795400200000,
	channels: [
		makeChannel(
			"gc-neuro",
			"Neuro Reese",
			"pitch",
			"#f43f5e",
			"modern-neuro-bass",
			gcNeuroTrack,
			{ volume: 0.56 },
			{ cutoff: 1200, resonance: 3.2, drive: 0.65, sidechain: 0.52 }
		),
		makeChannel(
			"gc-acid",
			"Acid 303 Bass",
			"pitch",
			"#22d3ee",
			"modern-acid-303",
			gcAcidTrack,
			{ volume: 0.52 },
			{
				cutoff: 480,
				resonance: 8.8,
				filterEnv: 4,
				drive: 0.4,
				sidechain: 0.45,
				lowCut: 95,
			}
		),
		makeChannel(
			"gc-gabber",
			"Gabber Kick",
			"drum",
			"#ef4444",
			"modern-gabber-kit",
			gcGabberTrack,
			{ volume: 0.86 },
			{ drive: 0.6 }
		),
		makeChannel(
			"gc-amen",
			"Sliced Amen",
			"drum",
			"#facc15",
			"modern-crushed-breaks",
			gcAmenTrack,
			{ volume: 0.76 },
			{ tune: 3, drive: 0.72, lowCut: 180 }
		),
	],
};

// ═════════════════════════════════════════════════════════════════════════════
// 3. "808 Half-Time 172" — 172 BPM G-minor distorted 808 + half-time/amen
// ═════════════════════════════════════════════════════════════════════════════

const htNote = createNoteFactory("ht");

// G minor bass pitches (MIDI 36-58)
const G_MIN_C2 = 36;
const G_MIN_D2 = 38;
const G_MIN_EB2 = 39;
const G_MIN_F2 = 41;
const G_MIN_G2 = 43;
const G_MIN_A2 = 45;
const G_MIN_BB2 = 46;
const G_MIN_C3 = 48;
const G_MIN_D3 = 50;
const G_MIN_EB3 = 51;
const G_MIN_F3 = 53;
const G_MIN_G3 = 55;

interface HalftimeBassRoot {
	root: number;
	glide: number;
	reese: number;
	turn: number;
}

const HT_CYCLE: Array<HalftimeBassRoot> = [
	{ root: G_MIN_G2, glide: G_MIN_G3, reese: G_MIN_G3, turn: G_MIN_F2 },
	{ root: G_MIN_EB2, glide: G_MIN_EB3, reese: G_MIN_EB3, turn: G_MIN_F2 },
	{ root: G_MIN_BB2, glide: G_MIN_F3, reese: G_MIN_BB2, turn: G_MIN_A2 },
	{ root: G_MIN_F2, glide: G_MIN_F3, reese: G_MIN_F3, turn: G_MIN_EB2 },
	{ root: G_MIN_C2, glide: G_MIN_C3, reese: G_MIN_C3, turn: G_MIN_D2 },
	{ root: G_MIN_EB2, glide: G_MIN_BB2, reese: G_MIN_EB3, turn: G_MIN_D2 },
	{ root: G_MIN_D2, glide: G_MIN_D3, reese: G_MIN_D3, turn: G_MIN_F2 },
	{ root: G_MIN_D2, glide: G_MIN_A2, reese: G_MIN_D3, turn: G_MIN_F2 },
];

const htRootAt = (bar: number): HalftimeBassRoot =>
	HT_CYCLE[bar % HT_CYCLE.length] ?? (HT_CYCLE[0] as HalftimeBassRoot);

const ht808Track = buildTrack(
	bars((bar) => {
		const { root, glide, turn } = htRootAt(bar);
		if (bar === 7) {
			return [
				htNote(0, root, 6, { velocity: 1 }),
				htNote(6, glide, 2, { velocity: 0.86, articulation: "legato" }),
			];
		}
		if (bar === 15) {
			return [
				htNote(0, root, 2, { velocity: 1 }),
				htNote(2, root, 6, { velocity: 0.9 }),
			];
		}
		if (bar === 23 || bar === 31) {
			return [
				htNote(0, root, 3, { velocity: 1 }),
				htNote(3, root, 3, { velocity: 0.88 }),
				htNote(6, glide, 2, { velocity: 0.86, articulation: "legato" }),
			];
		}
		if (bar < 7) {
			return bar % 2 === 0
				? [
						htNote(0, root, 7, { velocity: 1 }),
						htNote(10, root, 1, { velocity: 0.84 }),
						htNote(11, root, 5, { velocity: 0.92 }),
					]
				: [
						htNote(0, root, 7, { velocity: 1 }),
						htNote(10, root, 2, { velocity: 0.86 }),
						htNote(12, glide, 2, { velocity: 0.84, articulation: "legato" }),
						htNote(14, turn, 2, { velocity: 0.82, articulation: "legato" }),
					];
		}
		if (bar < 15) {
			return bar % 2 === 0
				? [
						htNote(0, root, 2, { velocity: 1 }),
						htNote(2, root, 6, { velocity: 0.9 }),
						htNote(10, root, 4, { velocity: 0.88 }),
						htNote(14, turn, 2, { velocity: 0.82, articulation: "legato" }),
					]
				: [
						htNote(0, root, 2, { velocity: 1 }),
						htNote(2, root, 6, { velocity: 0.9 }),
						htNote(10, root, 2, { velocity: 0.88 }),
						htNote(12, glide, 2, { velocity: 0.86, articulation: "legato" }),
						htNote(14, root, 2, { velocity: 0.82, articulation: "legato" }),
					];
		}
		return [
			htNote(0, root, 3, { velocity: 1 }),
			htNote(3, root, 3, { velocity: 0.88 }),
			htNote(6, glide, 2, { velocity: 0.84, articulation: "legato" }),
			htNote(8, root, 2, { velocity: 0.9 }),
			htNote(10, root, 4, { velocity: 0.92 }),
			htNote(14, turn, 2, { velocity: 0.82, articulation: "legato" }),
		];
	})
);

const htReeseTrack = buildTrack(
	bars((bar) => {
		if (bar < 16) {
			return null;
		}
		const { reese } = htRootAt(bar);
		if (bar === 23 || bar === 31) {
			return [
				htNote(0, reese, 8, { velocity: 0.86, cutoff: 1900, sweepTo: 480 }),
			];
		}
		return [
			htNote(0, reese, 6, { velocity: 0.84, cutoff: 580, sweepTo: 2200 }),
			htNote(6, reese, 2, { velocity: 0.74 }),
			htNote(8, reese, 4, { velocity: 0.82, cutoff: 1750, sweepTo: 620 }),
			htNote(12, reese, 4, { velocity: 0.8 }),
		];
	})
);

const htHalftimeBreak = (shufflingHats: boolean): Array<NoteEvent> => [
	htNote(0, KICK, 1, { velocity: 1 }),
	htNote(8, SNARE, 1, { velocity: 1 }),
	htNote(10, KICK, 1, { velocity: 0.85 }),
	htNote(11, KICK, 1, { velocity: 0.74 }),
	htNote(13, SNARE, 1, { velocity: 0.32 }),
	htNote(15, SNARE, 1, { velocity: 0.44 }),
	...(shufflingHats
		? Array.from({ length: 16 }, (_, step) =>
				htNote(step, HAT, 1, { velocity: step % 2 === 0 ? 0.48 : 0.28 })
			)
		: arEighthHats(htNote, 0.46, HAT)),
];

const htAmenDoubleA = (): Array<NoteEvent> => [
	htNote(0, KICK, 1, { velocity: 1 }),
	htNote(2, KICK, 1, { velocity: 0.86 }),
	htNote(4, SNARE, 1, { velocity: 0.96 }),
	htNote(7, SNARE, 1, { velocity: 0.46 }),
	htNote(9, SNARE, 1, { velocity: 0.54 }),
	htNote(10, KICK, 1, { velocity: 0.9 }),
	htNote(11, KICK, 1, { velocity: 0.76 }),
	htNote(12, SNARE, 1, { velocity: 0.96 }),
	htNote(15, SNARE, 1, { velocity: 0.46 }),
	...arEighthHats(htNote, 0.4, CYM),
];

const htAmenDoubleB = (): Array<NoteEvent> => [
	htNote(0, KICK, 1, { velocity: 1 }),
	htNote(2, KICK, 1, { velocity: 0.86 }),
	htNote(4, SNARE, 1, { velocity: 0.96 }),
	htNote(7, SNARE, 1, { velocity: 0.46 }),
	htNote(9, SNARE, 1, { velocity: 0.54 }),
	htNote(10, KICK, 1, { velocity: 0.9 }),
	htNote(12, SNARE, 1, { velocity: 0.94 }),
	htNote(14, SNARE, 1, { velocity: 0.65 }),
	htNote(15, SNARE, 1, { velocity: 0.48 }),
	...arEighthHats(htNote, 0.4, CYM),
];

const htShatteredBreakA = (): Array<NoteEvent> => [
	htNote(0, KICK, 1, { velocity: 1 }),
	htNote(1, SNARE, 1, { velocity: 0.34 }),
	htNote(3, KICK, 1, { velocity: 0.86 }),
	htNote(4, SNARE, 1, { velocity: 0.98 }),
	htNote(5, SNARE, 1, { velocity: 0.32 }),
	htNote(7, SNARE, 1, { velocity: 0.5 }),
	htNote(9, SNARE, 1, { velocity: 0.54 }),
	htNote(10, KICK, 1, { velocity: 0.92 }),
	htNote(12, SNARE, 1, { velocity: 0.98 }),
	htNote(13, SNARE, 1, { velocity: 0.36 }),
	htNote(15, SNARE, 1, { velocity: 0.48 }),
	htNote(6, OPEN_HAT, 1, { velocity: 0.5 }),
	htNote(14, OPEN_HAT, 1, { velocity: 0.5 }),
	...Array.from({ length: 16 }, (_, step) =>
		htNote(step, HAT, 1, { velocity: step % 2 === 0 ? 0.46 : 0.28 })
	),
];

const htShatteredBreakB = (): Array<NoteEvent> => [
	htNote(0, KICK, 1, { velocity: 1 }),
	htNote(1, SNARE, 1, { velocity: 0.36 }),
	htNote(2, SNARE, 1, { velocity: 0.66 }),
	htNote(4, SNARE, 1, { velocity: 0.98 }),
	htNote(5, SNARE, 1, { velocity: 0.34 }),
	htNote(7, SNARE, 1, { velocity: 0.52 }),
	htNote(9, SNARE, 1, { velocity: 0.56 }),
	htNote(10, KICK, 1, { velocity: 0.92 }),
	htNote(11, KICK, 1, { velocity: 0.78 }),
	htNote(12, SNARE, 1, { velocity: 0.98 }),
	htNote(13, SNARE, 1, { velocity: 0.38 }),
	htNote(15, SNARE, 1, { velocity: 0.52 }),
	htNote(6, OPEN_HAT, 1, { velocity: 0.5 }),
	htNote(14, OPEN_HAT, 1, { velocity: 0.5 }),
	...arEighthHats(htNote, 0.42, CYM),
];

const htBreaksTrack = buildTrack(
	bars((bar) => {
		if (bar === 7) {
			return [
				htNote(0, KICK, 1, { velocity: 1 }),
				htNote(4, SNARE, 1, { velocity: 0.65 }),
				htNote(8, SNARE, 1, { velocity: 0.92 }),
				htNote(10, KICK, 1, { velocity: 0.88 }),
				htNote(11, SNARE, 1, { velocity: 0.65 }),
				htNote(12, SNARE, 4, { velocity: 0.82, ratchet: 6 }),
				...[0, 2, 4, 6].map((step) => htNote(step, HAT, 1, { velocity: 0.42 })),
			];
		}
		if (bar === 15 || bar === 31) {
			return [
				htNote(0, KICK, 1, { velocity: 1 }),
				htNote(2, KICK, 1, { velocity: 0.86 }),
				htNote(4, SNARE, 1, { velocity: 0.96 }),
				htNote(7, SNARE, 1, { velocity: 0.5 }),
				htNote(8, SNARE, 4, { velocity: 0.76, ratchet: 4 }),
				htNote(12, SNARE, 4, { velocity: 0.94, ratchet: 8 }),
				...[0, 2, 4, 6].map((step) => htNote(step, HAT, 1, { velocity: 0.42 })),
			];
		}
		if (bar === 23) {
			return [
				htNote(0, KICK, 1, { velocity: 1 }),
				htNote(3, KICK, 1, { velocity: 0.86 }),
				htNote(4, SNARE, 1, { velocity: 0.96 }),
				htNote(7, SNARE, 1, { velocity: 0.52 }),
				htNote(8, KICK, 1, { velocity: 0.9 }),
				htNote(9, SNARE, 1, { velocity: 0.55 }),
				htNote(10, SNARE, 1, { velocity: 0.78 }),
				htNote(11, KICK, 1, { velocity: 0.84 }),
				htNote(12, SNARE, 4, { velocity: 0.86, ratchet: 6 }),
				...[0, 2, 4, 6].map((step) => htNote(step, HAT, 1, { velocity: 0.44 })),
			];
		}
		if (bar < 7) {
			return htHalftimeBreak(bar % 2 === 1);
		}
		if (bar < 15) {
			return bar % 2 === 0 ? htAmenDoubleA() : htAmenDoubleB();
		}
		return bar % 2 === 0 ? htShatteredBreakA() : htShatteredBreakB();
	})
);

const htSubKickTrack = buildTrack(
	bars((bar) => {
		if (bar === 7) {
			return [htNote(0, KICK, 1, { velocity: 1 })];
		}
		if (bar === 15) {
			return [
				htNote(0, KICK, 1, { velocity: 1 }),
				htNote(2, KICK, 1, { velocity: 0.86 }),
			];
		}
		if (bar === 23 || bar === 31) {
			return [
				htNote(0, KICK, 1, { velocity: 1 }),
				htNote(3, KICK, 1, { velocity: 0.86 }),
			];
		}
		if (bar < 7) {
			const notes: Array<NoteEvent> = [
				htNote(0, KICK, 1, { velocity: 1 }),
				htNote(10, KICK, 1, { velocity: 0.85 }),
				htNote(11, KICK, 1, { velocity: 0.75 }),
			];
			if (bar >= 4) {
				notes.push(htNote(8, CLAP, 1, { velocity: 0.65 }));
			}
			if (bar === 0) {
				notes.push(htNote(0, CYM, 2, { velocity: 0.85 }));
			}
			return notes;
		}
		if (bar < 15) {
			const notes: Array<NoteEvent> = [
				htNote(0, KICK, 1, { velocity: 1 }),
				htNote(2, KICK, 1, { velocity: 0.85 }),
				htNote(10, KICK, 1, { velocity: 0.9 }),
			];
			if (bar === 8) {
				notes.push(htNote(0, CYM, 2, { velocity: 0.85 }));
			}
			return notes;
		}
		if (bar < 23) {
			const notes: Array<NoteEvent> = [
				htNote(0, KICK, 1, { velocity: 1 }),
				htNote(3, KICK, 1, { velocity: 0.86 }),
				htNote(10, KICK, 1, { velocity: 0.92 }),
			];
			if (bar === 16) {
				notes.push(htNote(0, CYM, 2, { velocity: 0.85 }));
			}
			return notes;
		}
		const notes: Array<NoteEvent> = [0, 4, 8, 12].map((step) =>
			htNote(step, KICK, 1, { velocity: step === 0 ? 1 : 0.9 })
		);
		if (bar === 24) {
			notes.push(htNote(0, CYM, 2, { velocity: 0.85 }));
		}
		return notes;
	})
);

export const HALFTIME_808_SECTIONS = [
	{ name: "Weight", startBar: 0, endBar: 15 },
	{ name: "Shatter", startBar: 16, endBar: 31 },
] as const;

export const modernHalftime808Song: SongProject = {
	id: "demo-modern-808-halftime-172",
	title: "808 Half-Time 172",
	author: "UltraBeep Demo",
	engine: "modern",
	bpm: 172,
	beatsPerBar: 4,
	stepsPerBeat: 4,
	totalBars: TOTAL_BARS,
	loopStartBar: 0,
	loopEndBar: TOTAL_BARS - 1,
	swing: 0,
	rootKey: "G",
	scale: "minor",
	masterVolume: 0.82,
	sections: HALFTIME_808_SECTIONS.map((section) => ({
		id: `ht-section-${section.name.toLowerCase()}`,
		name: section.name,
		startBar: section.startBar,
		endBar: section.endBar,
	})),
	updatedAt: 1795400300000,
	channels: [
		makeChannel(
			"ht-808",
			"Distorted 808",
			"pitch",
			"#fb7185",
			"modern-808",
			ht808Track,
			{ volume: 0.72 },
			{ drive: 0.62, cutoff: 2200, sidechain: 0.15 }
		),
		makeChannel(
			"ht-reese",
			"Reese Growl",
			"pitch",
			"#a78bfa",
			"modern-reese-bass",
			htReeseTrack,
			{ volume: 0.42 },
			{
				cutoff: 1150,
				resonance: 2.2,
				drive: 0.5,
				chorus: 0.25,
				sidechain: 0.48,
				lowCut: 120,
			}
		),
		makeChannel(
			"ht-breaks",
			"Heavy Breaks",
			"drum",
			"#facc15",
			"modern-crushed-breaks",
			htBreaksTrack,
			{ volume: 0.84 },
			{ tune: 1, drive: 0.58 }
		),
		makeChannel(
			"ht-kick",
			"Sub Kick",
			"drum",
			"#38bdf8",
			"modern-punch-kit",
			htSubKickTrack,
			{ volume: 0.82 },
			{ drive: 0.25 }
		),
	],
};

import { MUSICAL_KEYS, SCALE_DEFINITIONS } from "../constants/scalesAndNotes";
import type {
	MusicalKey,
	NoteArticulation,
	NoteEvent,
	NoteOrnament,
	ScaleType,
} from "../types/music";

/**
 * Articulation = how a note is played: its length (gate), its weight (accent)
 * and how it connects to its neighbours (legato). Classical notation groups
 * articulations by what they change — length (staccato, tenuto), weight
 * (accent, marcato) and connection (legato / slur). The synth reads the shape
 * below for every note; the written note in the piano roll never changes.
 */
export interface ArticulationShape {
	/** Fraction of the written duration that actually sounds (gate time) */
	gate: number;
	/** Multiplier on the note's peak level */
	gainMultiplier: number;
	/** Lowest sustain level while the note holds (tenuto keeps its weight) */
	minSustain: number;
	/** Multiplier on the filter cutoff at the attack, falling back quickly (accent "bite") */
	filterBoost: number;
	/** Multiplier on the instrument release (short notes stop cleanly) */
	releaseScale: number;
	/** Upper limit on the attack time in seconds (harder attack). undefined = instrument attack */
	maxAttackSeconds?: number;
}

const NORMAL_SHAPE: ArticulationShape = {
	gate: 1,
	gainMultiplier: 1,
	minSustain: 0,
	filterBoost: 1,
	releaseScale: 1,
};

export const ARTICULATION_SHAPES: Record<NoteArticulation, ArticulationShape> =
	{
		staccato: {
			gate: 0.45,
			gainMultiplier: 1,
			minSustain: 0,
			filterBoost: 1.15,
			releaseScale: 0.4,
		},
		tenuto: {
			gate: 1,
			gainMultiplier: 1.08,
			minSustain: 0.82,
			filterBoost: 1,
			releaseScale: 1,
		},
		accent: {
			gate: 1,
			gainMultiplier: 1.3,
			minSustain: 0,
			filterBoost: 2.2,
			releaseScale: 1,
			maxAttackSeconds: 0.003,
		},
		marcato: {
			gate: 0.72,
			gainMultiplier: 1.45,
			minSustain: 0,
			filterBoost: 2.8,
			releaseScale: 0.6,
			maxAttackSeconds: 0.002,
		},
		legato: {
			gate: 1,
			gainMultiplier: 1,
			minSustain: 0,
			filterBoost: 1,
			releaseScale: 1,
			maxAttackSeconds: 0.006,
		},
	};

export const NOTE_ARTICULATIONS: Array<NoteArticulation> = [
	"staccato",
	"tenuto",
	"accent",
	"marcato",
	"legato",
];

export const NOTE_ORNAMENTS: Array<NoteOrnament> = [
	"grace",
	"mordent",
	"trill",
];

export const isNoteArticulation = (value: unknown): value is NoteArticulation =>
	typeof value === "string" &&
	(NOTE_ARTICULATIONS as Array<string>).includes(value);

export const isNoteOrnament = (value: unknown): value is NoteOrnament =>
	typeof value === "string" &&
	(NOTE_ORNAMENTS as Array<string>).includes(value);

export const ARTICULATION_LABELS: Record<
	NoteArticulation | "normal",
	{ name: string; mark: string; description: string }
> = {
	normal: { name: "Normal", mark: "", description: "Plays as written" },
	staccato: {
		name: "Staccato",
		mark: "•",
		description: "Short and detached — about half its written length",
	},
	tenuto: {
		name: "Tenuto",
		mark: "–",
		description: "Held for the full length with a little weight",
	},
	accent: {
		name: "Accent",
		mark: ">",
		description: "Louder, with a brighter, harder attack",
	},
	marcato: {
		name: "Marcato",
		mark: "^",
		description: "Strongest accent, slightly detached",
	},
	legato: {
		name: "Legato",
		mark: "⌒",
		description:
			"Slurred from the previous touching note: no re-attack, quick glide",
	},
};

export const ORNAMENT_LABELS: Record<
	NoteOrnament | "none",
	{ name: string; mark: string; description: string }
> = {
	none: { name: "None", mark: "", description: "No ornament" },
	grace: {
		name: "Grace",
		mark: "g",
		description: "Quick flick from the scale step below",
	},
	mordent: {
		name: "Mordent",
		mark: "~",
		description: "Note → step above → note, then hold",
	},
	trill: {
		name: "Trill",
		mark: "tr",
		description: "Rapid alternation with the scale step above",
	},
};

export const resolveArticulationShape = (
	articulation: NoteArticulation | undefined
): ArticulationShape =>
	articulation
		? (ARTICULATION_SHAPES[articulation] ?? NORMAL_SHAPE)
		: NORMAL_SHAPE;

/** Sounding length of a note in steps after its articulation is applied. */
export const resolveGateSteps = (
	note: Pick<NoteEvent, "duration" | "articulation">
): number => {
	const shape = resolveArticulationShape(note.articulation);
	return Math.max(0.2, note.duration * shape.gate);
};

/** Extra information a note needs from its pattern to be played correctly. */
export interface NotePlaybackContext {
	/** Legato: the pitch this note slides from (the previous touching note) */
	slideFromPitch?: number;
	/** The note must stop this many steps after it starts (the next note slurs out of it) */
	cutAfterSteps?: number;
	/** Semitones up to the next scale step (ornaments) */
	upperNeighbor: number;
	/** Semitones down to the previous scale step (ornaments, negative) */
	lowerNeighbor: number;
}

export const DEFAULT_PLAYBACK_CONTEXT: NotePlaybackContext = {
	upperNeighbor: 2,
	lowerNeighbor: -2,
};

/**
 * Semitone distance to the neighbouring scale step above (+1) or below (-1).
 * Gaps wider than a whole tone (pentatonic / blues scales) are narrowed to a
 * whole tone so trills and grace notes stay tight, as they would on a real
 * instrument.
 */
export const getScaleNeighborInterval = (
	pitch: number,
	rootKey: MusicalKey,
	scale: ScaleType,
	direction: 1 | -1
): number => {
	const intervals = SCALE_DEFINITIONS[scale]?.intervals ?? [
		0, 2, 4, 5, 7, 9, 11,
	];
	const rootIndex = Math.max(0, MUSICAL_KEYS.indexOf(rootKey));
	const inScale = (midi: number): boolean =>
		intervals.includes((((midi - rootIndex) % 12) + 12) % 12);
	for (let distance = 1; distance <= 2; distance += 1) {
		if (inScale(pitch + direction * distance)) {
			return direction * distance;
		}
	}
	return direction * 2;
};

const notesTouch = (earlier: NoteEvent, later: NoteEvent): boolean =>
	earlier.step < later.step && earlier.step + earlier.duration >= later.step;

/**
 * The note a legato note slurs from: the latest earlier note in the same
 * pattern that is still sounding (or ends exactly) when the legato note starts.
 * Closest pitch wins a tie (chords).
 */
export const findLegatoSource = (
	notes: Array<NoteEvent>,
	legatoNote: NoteEvent
): NoteEvent | undefined => {
	let best: NoteEvent | undefined;
	for (const candidate of notes) {
		if (candidate.id === legatoNote.id || !notesTouch(candidate, legatoNote)) {
			continue;
		}
		if (
			!best ||
			candidate.step > best.step ||
			(candidate.step === best.step &&
				Math.abs(candidate.pitch - legatoNote.pitch) <
					Math.abs(best.pitch - legatoNote.pitch))
		) {
			best = candidate;
		}
	}
	return best;
};

/**
 * Works out what `note` needs from the rest of its pattern: the slide source
 * when it is legato, where it must stop when the next note slurs out of it,
 * and its scale neighbours for ornaments. Cheap when the pattern uses neither.
 */
export const buildNotePlaybackContext = (
	notes: Array<NoteEvent>,
	note: NoteEvent,
	key: { rootKey: MusicalKey; scale: ScaleType },
	isDrum = false
): NotePlaybackContext | undefined => {
	if (isDrum) {
		return undefined;
	}
	const hasLegato = notes.some(
		(candidate) => candidate.articulation === "legato"
	);
	if (!hasLegato && !note.ornament) {
		return undefined;
	}
	const context: NotePlaybackContext = {
		upperNeighbor: note.ornament
			? getScaleNeighborInterval(note.pitch, key.rootKey, key.scale, 1)
			: 2,
		lowerNeighbor: note.ornament
			? getScaleNeighborInterval(note.pitch, key.rootKey, key.scale, -1)
			: -2,
	};
	if (hasLegato) {
		if (note.articulation === "legato") {
			const source = findLegatoSource(notes, note);
			if (source) {
				context.slideFromPitch = source.pitch;
			}
		}
		for (const follower of notes) {
			if (
				follower.articulation === "legato" &&
				notesTouch(note, follower) &&
				findLegatoSource(notes, follower)?.id === note.id
			) {
				const cut = follower.step - note.step;
				context.cutAfterSteps =
					context.cutAfterSteps === undefined
						? cut
						: Math.min(context.cutAfterSteps, cut);
			}
		}
	}
	return context;
};

export interface PitchEvent {
	/** Seconds after the note start */
	time: number;
	/** Semitones relative to the written pitch */
	offset: number;
}

/**
 * Pitch steps an ornament plays, relative to the written pitch. The last event
 * always lands on the written pitch so bends / holds continue from there.
 */
export const buildOrnamentPitchEvents = (
	ornament: NoteOrnament,
	soundingSeconds: number,
	stepDurationSeconds: number,
	context: Pick<NotePlaybackContext, "upperNeighbor" | "lowerNeighbor">
): Array<PitchEvent> => {
	const flick = Math.max(0.03, Math.min(0.07, stepDurationSeconds * 0.5));
	if (ornament === "grace") {
		return soundingSeconds > flick * 1.5
			? [
					{ time: 0, offset: context.lowerNeighbor },
					{ time: flick, offset: 0 },
				]
			: [];
	}
	if (ornament === "mordent") {
		return soundingSeconds > flick * 2.5
			? [
					{ time: 0, offset: 0 },
					{ time: flick, offset: context.upperNeighbor },
					{ time: flick * 2, offset: 0 },
				]
			: [];
	}
	// Trill: alternate as fast as a 1/32 (or ~16 Hz at slow tempos), end on the note
	const rate = Math.max(0.035, Math.min(0.06, stepDurationSeconds * 0.5));
	const events: Array<PitchEvent> = [];
	let index = 0;
	for (let time = 0; time < soundingSeconds - rate * 0.5; time += rate) {
		events.push({ time, offset: index % 2 === 0 ? 0 : context.upperNeighbor });
		index += 1;
	}
	const last = events[events.length - 1];
	if (last && last.offset !== 0) {
		events.push({ time: last.time + rate, offset: 0 });
	}
	return events.length > 1 ? events : [];
};

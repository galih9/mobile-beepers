import type {
	ChannelType,
	MusicalKey,
	PianoRollRow,
	ScaleType,
} from "../types/music";

export const MUSICAL_KEYS: Array<MusicalKey> = [
	"C",
	"C#",
	"D",
	"D#",
	"E",
	"F",
	"F#",
	"G",
	"G#",
	"A",
	"A#",
	"B",
];

export const SCALE_DEFINITIONS: Record<
	ScaleType,
	{ label: string; intervals: Array<number> }
> = {
	minor: { label: "Natural Minor", intervals: [0, 2, 3, 5, 7, 8, 10] },
	major: { label: "Major", intervals: [0, 2, 4, 5, 7, 9, 11] },
	pentatonicMinor: { label: "Minor Pentatonic", intervals: [0, 3, 5, 7, 10] },
	pentatonicMajor: { label: "Major Pentatonic", intervals: [0, 2, 4, 7, 9] },
	dorian: { label: "Dorian", intervals: [0, 2, 3, 5, 7, 9, 10] },
	phrygian: { label: "Phrygian", intervals: [0, 1, 3, 5, 7, 8, 10] },
	harmonicMinor: { label: "Harmonic Minor", intervals: [0, 2, 3, 5, 7, 8, 11] },
	blues: { label: "Blues", intervals: [0, 3, 5, 6, 7, 10] },
	chromatic: {
		label: "Chromatic",
		intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
	},
};

export interface DrumPadDefinition {
	pitch: number;
	label: string;
	shortLabel: string;
	color: string;
}

export const DRUM_PAD_DEFINITIONS: Array<DrumPadDefinition> = [
	{ pitch: 0, label: "8-Bit Kick", shortLabel: "KICK", color: "#fb7185" },
	{ pitch: 1, label: "Noise Snare", shortLabel: "SNARE", color: "#fbbf24" },
	{ pitch: 2, label: "Closed Hat", shortLabel: "CHH", color: "#38bdf8" },
	{ pitch: 3, label: "Open Hat", shortLabel: "OHH", color: "#60a5fa" },
	{ pitch: 4, label: "Low Chip Tom", shortLabel: "LTOM", color: "#a78bfa" },
	{ pitch: 5, label: "High Chip Tom", shortLabel: "HTOM", color: "#c084fc" },
	{ pitch: 6, label: "Retro Clap", shortLabel: "CLAP", color: "#34d399" },
	{ pitch: 7, label: "Coin Blip", shortLabel: "BLIP", color: "#22d3ee" },
];

export const MELODIC_MIN_MIDI = 36; // C2
export const MELODIC_MAX_MIDI = 84; // C6

export const midiToFrequency = (midiNote: number): number => {
	return 440 * Math.pow(2, (midiNote - 69) / 12);
};

export const midiToNoteName = (midiNote: number): string => {
	const pitchClass = ((midiNote % 12) + 12) % 12;
	const octave = Math.floor(midiNote / 12) - 1;
	const noteLabel = MUSICAL_KEYS[pitchClass] ?? "C";
	return `${noteLabel}${octave}`;
};

export const isRootMidiNote = (
	midiNote: number,
	rootKey: MusicalKey
): boolean => {
	const rootIndex = MUSICAL_KEYS.indexOf(rootKey);
	const pitchClass = ((midiNote % 12) + 12) % 12;
	return pitchClass === rootIndex;
};

export const isMidiNoteInScale = (
	midiNote: number,
	rootKey: MusicalKey,
	scale: ScaleType
): boolean => {
	const rootIndex = MUSICAL_KEYS.indexOf(rootKey);
	const pitchClass = ((midiNote % 12) + 12) % 12;
	const relativeInterval = (pitchClass - rootIndex + 12) % 12;
	const scaleIntervals = SCALE_DEFINITIONS[scale].intervals;
	return scaleIntervals.includes(relativeInterval);
};

export const buildPianoRollRows = (
	channelType: ChannelType,
	rootKey: MusicalKey,
	scale: ScaleType,
	scaleLockOnly: boolean
): Array<PianoRollRow> => {
	if (channelType === "drum") {
		const drumRows: Array<PianoRollRow> = [];
		for (let pitch = DRUM_PAD_DEFINITIONS.length - 1; pitch >= 0; pitch -= 1) {
			const pad = DRUM_PAD_DEFINITIONS[pitch];
			if (pad) {
				drumRows.push({
					pitch: pad.pitch,
					label: pad.shortLabel,
					inScale: true,
					isRoot: pad.pitch === 0,
					isSharp: false,
					accentColor: pad.color,
				});
			}
		}
		return drumRows;
	}

	const rows: Array<PianoRollRow> = [];
	for (let midi = MELODIC_MAX_MIDI; midi >= MELODIC_MIN_MIDI; midi -= 1) {
		const inScale = isMidiNoteInScale(midi, rootKey, scale);
		if (scaleLockOnly && !inScale) {
			continue;
		}
		const noteName = midiToNoteName(midi);
		rows.push({
			pitch: midi,
			label: noteName,
			inScale,
			isRoot: isRootMidiNote(midi, rootKey),
			isSharp: noteName.includes("#"),
		});
	}
	return rows;
};

export const getScaleMidiNotesInRange = (
	rootKey: MusicalKey,
	scale: ScaleType,
	minMidi: number,
	maxMidi: number
): Array<number> => {
	const result: Array<number> = [];
	for (let midi = minMidi; midi <= maxMidi; midi += 1) {
		if (isMidiNoteInScale(midi, rootKey, scale)) {
			result.push(midi);
		}
	}
	return result;
};

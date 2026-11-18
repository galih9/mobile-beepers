export type MusicalKey =
	| "C"
	| "C#"
	| "D"
	| "D#"
	| "E"
	| "F"
	| "F#"
	| "G"
	| "G#"
	| "A"
	| "A#"
	| "B";

export type ScaleType =
	| "minor"
	| "major"
	| "pentatonicMinor"
	| "pentatonicMajor"
	| "dorian"
	| "phrygian"
	| "harmonicMinor"
	| "blues"
	| "chromatic";

export type WaveformType =
	| "pulse12"
	| "pulse25"
	| "pulse50"
	| "triangle"
	| "sawtooth"
	| "fm"
	| "supersaw"
	| "retroKit";

export type ArpMode =
	| "none"
	| "arpFast"
	| "arpMedium"
	| "octaveUp"
	| "fifth"
	| "majorChord"
	| "minorChord";

export type ChannelType = "pitch" | "drum";

export type MobileWorkspaceTab = "piano" | "matrix" | "synth";

export type EditorTool = "draw" | "erase" | "resize" | "slide";

export type LoopMode = "song" | "bar";

export interface NoteEvent {
	id: string;
	/** Step offset within the bar (0 to stepsPerBar - 1) */
	step: number;
	/** MIDI pitch (36-84) for melodic channels, or 0-7 for drum pads */
	pitch: number;
	/** Note length in steps (1 to stepsPerBar) */
	duration: number;
	/** Velocity multiplier (0.1 to 1.0) */
	velocity: number;
	/** Semitone pitch slide toward end of note (-12 to +12) */
	pitchBend: number;
}

export interface Pattern {
	/** Pattern index (1..N, where 0 in barSequence means silent/empty) */
	index: number;
	notes: Array<NoteEvent>;
}

export interface InstrumentConfiguration {
	presetId: string;
	waveform: WaveformType;
	volume: number;
	pan: number;
	attack: number;
	decay: number;
	sustain: number;
	release: number;
	filterCutoff: number;
	vibratoDepth: number;
	vibratoSpeed: number;
	arpMode: ArpMode;
	echoMix: number;
	echoTimeSeconds: number;
	detuneCents: number;
}

export interface Channel {
	id: string;
	name: string;
	type: ChannelType;
	color: string;
	muted: boolean;
	solo: boolean;
	instrument: InstrumentConfiguration;
	/** Pattern index assigned to each bar slot (0 = silent) */
	barSequence: Array<number>;
	/** Reusable pattern dictionary keyed by pattern index ("1", "2", ...) */
	patterns: Record<string, Pattern>;
}

export interface SongProject {
	id: string;
	title: string;
	author: string;
	bpm: number;
	beatsPerBar: number;
	stepsPerBeat: number;
	totalBars: number;
	loopStartBar: number;
	loopEndBar: number;
	swing: number;
	rootKey: MusicalKey;
	scale: ScaleType;
	masterVolume: number;
	channels: Array<Channel>;
	updatedAt: number;
}

export interface PianoRollRow {
	pitch: number;
	label: string;
	inScale: boolean;
	isRoot: boolean;
	isSharp: boolean;
	accentColor?: string;
}

export interface InstrumentPresetDefinition {
	id: string;
	name: string;
	category: ChannelType;
	description: string;
	configuration: InstrumentConfiguration;
}

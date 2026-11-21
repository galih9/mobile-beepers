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

export type MobileWorkspaceTab = "all" | "piano" | "matrix" | "synth";

export type EditorTool =
	| "select"
	| "draw"
	| "move"
	| "erase"
	| "slide"
	| "fade"
	| "stutter";

export type NoteBendStyle = "late" | "early" | "continuous";

export type NoteFadeMode = "none" | "fadeIn" | "fadeOut";

export type LoopMode = "song" | "bar" | "once";

export type StudioMode = "music" | "sfx";

export type SfxCategory = "combat" | "feedback" | "jingle";

export type SfxGeneratorArchetype =
	| "laser"
	| "hurt"
	| "attack"
	| "jump"
	| "coin"
	| "boom"
	| "blip"
	| "random";

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
	/** Semitone pitch slide toward end of note (-24 to +24) */
	pitchBend: number;
	/** Shape of pitch bend transition across the note */
	bendStyle?: NoteBendStyle;
	/** Per-note fade override */
	fadeMode?: NoteFadeMode;
	/** Optional per-note low-pass filter cutoff override in Hz (180 to 14000) */
	filterCutoff?: number;
	/** Optional low-pass filter cutoff target in Hz to sweep toward across note duration */
	filterSweepTo?: number;
	/**
	 * Stutter / ratchet count (1-8). The note is retriggered this many times,
	 * evenly spaced across its duration — breakcore snare rolls and glitch stutters.
	 * When combined with pitchBend the retriggers climb (or fall) in steps toward the bend target.
	 */
	ratchet?: number;
	/**
	 * Micro-timing nudge in steps (-0.5 to +0.5). Shifts the note slightly off the
	 * 16th grid — negative plays early (rushing), positive plays late (laid back).
	 * Used to humanize melodies; 0 / undefined = exactly on the grid.
	 */
	timingOffset?: number;
}

export interface NoteVelocityUpdate {
	id: string;
	velocity: number;
}

/** A named loop region of the song (e.g. "Command", "Clash", "Rush") */
export interface SongSection {
	id: string;
	name: string;
	/** First bar of the section (0-indexed, inclusive) */
	startBar: number;
	/** Last bar of the section (0-indexed, inclusive) */
	endBar: number;
}

export interface NoteBatchMoveUpdate {
	id: string;
	step: number;
	pitch: number;
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
	/** UltraBox-style Fade In / Out (-1 = full fade in, 0 = neutral, +1 = full fade out) */
	fadeInOut?: number;
	/** Bit-crushed overdrive amount (0 = clean, 1 = fully saturated / crushed) */
	drive?: number;
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
	/** Optional named sections — each can be looped / exported on its own */
	sections?: Array<SongSection>;
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

export interface BarMatrixSelection {
	startBar: number;
	endBar: number;
	startChannel: number;
	endChannel: number;
}

export interface CopiedBarSlot {
	channelOffset: number;
	channelType: ChannelType;
	channelName: string;
	barOffset: number;
	patternNumber: number;
	patternNotes?: Array<NoteEvent>;
}

export interface CopiedBarsClipboard {
	barCount: number;
	channelCount: number;
	slots: Array<CopiedBarSlot>;
}

export interface HistorySnapshot {
	song: SongProject;
	selectedChannelIndex?: number;
	selectedBarIndex?: number;
	barSelection?: BarMatrixSelection | null;
}

export interface InstrumentPresetDefinition {
	id: string;
	name: string;
	category: ChannelType;
	description: string;
	configuration: InstrumentConfiguration;
}

export interface SfxPresetDefinition {
	id: string;
	title: string;
	category: SfxCategory;
	badge: string;
	description: string;
	project: SongProject;
}

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
	| "piano"
	| "strings"
	| "choir"
	| "sub808"
	| "organ"
	| "acid"
	| "hoover"
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

/**
 * How a note is played (its "articulation"):
 * - staccato: short and detached (~45% of its written length)
 * - tenuto: held for its full length with a little weight, no decay dip
 * - accent: louder with a brighter, harder attack
 * - marcato: strongest accent, slightly detached
 * - legato: slurred from the previous touching note — no re-attack, quick glide
 *   from the previous pitch (mono-synth / 303-style slide)
 * undefined = normal (plays as written).
 */
export type NoteArticulation =
	| "staccato"
	| "tenuto"
	| "accent"
	| "marcato"
	| "legato";

/**
 * Ornaments decorate a note with fast neighbour notes, using the scale step
 * above / below in the song key:
 * - grace: a quick note one scale step below that flicks into the main note
 * - mordent: main → upper neighbour → main, then hold
 * - trill: rapid alternation with the upper neighbour for the whole note
 */
export type NoteOrnament = "grace" | "mordent" | "trill";

export type LoopMode = "song" | "bar" | "once";

/**
 * App mode (picked in Settings → Mode):
 * - modern: modern music maker — sampled piano / strings, supersaws, reese and
 *   sub bass, punchy kits, your own samples and break slicing, studio FX
 * - music: the retro chiptune composer
 * - sfx: retro SFX & short jingle creator
 */
export type StudioMode = "modern" | "music" | "sfx";

/** Sound engine used by songs. undefined = "chiptune" (older saves). */
export type SongEngine = "chiptune" | "modern";

/**
 * Modern-mode sound engines:
 * - grandPiano / strings / harp: real recorded samples (Salamander grand,
 *   violin + cello section, concert harp)
 * - superSaw / pad / pluck / softLead / ePiano / bell / houseOrgan / acid303 /
 *   hoover / vocalChop: polyphonic synths & classic electronic voices
 * - reeseBass / subBass / fmBass: bass synths
 * - drumKit / breakKit / houseKit / gabberKit: synthesized modern kits on the 8 drum pads
 * - sampler: your own sample played chromatically
 * - slicer: your own drum break chopped into equal slices (one per key)
 */
export type ModernEngine =
	| "grandPiano"
	| "strings"
	| "harp"
	| "superSaw"
	| "pad"
	| "pluck"
	| "softLead"
	| "ePiano"
	| "bell"
	| "houseOrgan"
	| "acid303"
	| "fmBass"
	| "hoover"
	| "vocalChop"
	| "reeseBass"
	| "subBass"
	| "drumKit"
	| "breakKit"
	| "houseKit"
	| "gabberKit"
	| "sampler"
	| "slicer";

/** Tempo-synced echo time */
export type DelayDivision = "32n" | "16n" | "8n" | "8n." | "4n";

export interface ModernInstrumentSettings {
	engine: ModernEngine;
	/** Low-pass filter cutoff in Hz (60 to 18000) */
	cutoff: number;
	/** Filter resonance / Q (0.5 to 14) */
	resonance: number;
	/** How far a filter envelope opens the cutoff on each note, in octaves (0 to 6) */
	filterEnv: number;
	/** Unison detune spread in cents for saw engines (0 to 60) */
	spread: number;
	/** Coarse tune in semitones (-24 to +24). Drum kits: pitch of the whole kit */
	tune: number;
	/** Warm tube-style saturation (0 = clean, 1 = heavy) */
	drive: number;
	/** Stereo chorus wet amount (0 to 1) */
	chorus: number;
	/** Tempo-synced stereo echo send (0 to 1) */
	delayMix: number;
	delayDivision: DelayDivision;
	/** Echo feedback (0 to 0.85) */
	delayFeedback: number;
	/** Send into the shared plate / hall reverb (0 to 1) */
	reverbSend: number;
	/** Sidechain ducking from the kick (0 = off, 1 = deep pump) */
	sidechain: number;
	/** High-pass "low cut" in Hz (20 to 1200) — keeps pads out of the bass */
	lowCut: number;
	/** User sample id (sampler / slicer engines) */
	sampleId?: string;
	/** Display name of the user sample */
	sampleName?: string;
	/** Slicer: number of equal slices (4, 8, 16 or 32) */
	sliceCount?: number;
	/** Slicer: how many bars the whole break lasts (used by fit-to-tempo) */
	sliceBars?: number;
	/** Slicer: re-pitch the break so it lasts exactly sliceBars at the song tempo */
	fitToTempo?: boolean;
	/** Sampler: MIDI note at which the sample plays at its original pitch */
	sampleRootMidi?: number;
}

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
	/** How the note is played (staccato, tenuto, accent, marcato, legato). undefined = normal */
	articulation?: NoteArticulation;
	/** Optional ornament (grace note, mordent, trill) */
	ornament?: NoteOrnament;
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
	/**
	 * Send level into the shared cinematic hall reverb (0 = dry, 1 = drenched).
	 * ~0.2 adds room, ~0.45 is a big hall, 0.7+ is a distant, washed-out ambience.
	 */
	reverbMix?: number;
	/**
	 * Per-channel glue compressor (0 = off, 1 = slammed). Squashes the whole
	 * channel on one bus — fat, punchy breaks and 808s.
	 */
	punch?: number;
	/**
	 * Modern-mode engine and FX settings. When present the channel plays through
	 * the modern engine (samples, supersaws, studio FX) instead of the retro
	 * chip synth; volume, pan and the ADSR fields above are still used.
	 */
	modern?: ModernInstrumentSettings;
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
	/** "modern" songs belong to the modern music maker. undefined = chiptune */
	engine?: SongEngine;
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

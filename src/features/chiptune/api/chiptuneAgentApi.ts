import {
	ARTICULATION_LABELS,
	ARTICULATION_SHAPES,
	isNoteArticulation,
	isNoteOrnament,
	NOTE_ARTICULATIONS,
	NOTE_ORNAMENTS,
	ORNAMENT_LABELS,
	type ArticulationShape,
} from "../audio/articulation";
import {
	renderSongToMidiBlob,
	renderSongToMidiBytes,
	type MidiExportOptions,
} from "../audio/midiExporter";
import { MAX_NOTE_RATCHET } from "../audio/noteRatchet";
import { playPreviewNote } from "../audio/channelPreview";
import {
	measureAudioBufferLevels,
	renderSongToAudioBuffer,
	renderSongToWavBlob,
} from "../audio/wavExporter";
import { ALL_DEMO_SONGS } from "../constants/demoSongs";
import {
	MODERN_ENGINE_LABELS,
	MODERN_INSTRUMENT_PRESETS,
} from "../constants/modernPresets";
import {
	MAX_CHANNELS,
	MAX_PATTERN_INDEX,
	MAX_SONG_BARS,
} from "../constants/limits";
import {
	getPresetConfigurationById,
	INSTRUMENT_PRESETS,
} from "../constants/instrumentPresets";
import { CHANNEL_COLOR_PALETTE } from "../constants/patternGenerator";
import { SFX_PRESETS } from "../constants/sfxPresets";
import {
	DRUM_PAD_DEFINITIONS,
	type DrumPadDefinition,
	MELODIC_MAX_MIDI,
	MELODIC_MIN_MIDI,
	midiToNoteName,
	MUSICAL_KEYS,
	SCALE_DEFINITIONS,
} from "../constants/scalesAndNotes";
import {
	generateRiffInChannelPattern,
	getActivePatternForChannel,
	getNextAvailablePatternIndex,
	getStepsPerBar,
	clampNoteVelocity,
	clampTimingOffset,
	humanizeNotesInSong,
	normalizeSongSections,
	quantizeNotesInSong,
	setBarPatternIndexInSong,
	transposeChannelPattern,
	updateChannelPatternNotes,
	updateNotePropertiesInSong,
	type HumanizeOptions,
	type NotePropertyUpdate,
} from "../store/songHelpers";
import type { ChiptuneStoreState } from "../store/storeTypes";
import { useChiptuneStore } from "../store/useChiptuneStore";
import type {
	Channel,
	ChannelType,
	EditorTool,
	InstrumentConfiguration,
	InstrumentPresetDefinition,
	LoopMode,
	MusicalKey,
	ModernEngine,
	ModernInstrumentSettings,
	NoteArticulation,
	NoteBendStyle,
	NoteEvent,
	NoteFadeMode,
	NoteOrnament,
	Pattern,
	ScaleType,
	SfxCategory,
	SfxGeneratorArchetype,
	SongProject,
	SongSection,
	StudioMode,
} from "../types/music";

export interface AgentNoteInput {
	step: number;
	pitch?: number;
	note?: string;
	duration?: number;
	velocity?: number;
	pitchBend?: number;
	bendStyle?: NoteBendStyle;
	fadeMode?: NoteFadeMode;
	filterCutoff?: number;
	filterSweepTo?: number;
	/** Stutter retriggers across the note (1-8). Combine with pitchBend for stepped risers. */
	ratchet?: number;
	/** Micro-timing nudge in steps (-0.5 early … +0.5 late). Humanizes off the grid. */
	timingOffset?: number;
	/** staccato | tenuto | accent | marcato | legato (omit = normal) */
	articulation?: NoteArticulation;
	/** grace | mordent | trill (uses the scale step above / below) */
	ornament?: NoteOrnament;
}

export interface AgentSectionInput {
	id?: string;
	name: string;
	startBar: number;
	endBar: number;
}

export interface AgentLevelReport {
	durationSeconds: number;
	/** Highest absolute sample (1.0 = full scale) */
	peak: number;
	peakDb: number;
	rmsDb: number;
	/** Samples at or above full scale (clipping) */
	clippedSamples: number;
}

export interface AgentChannelSpecification {
	name?: string;
	type?: ChannelType;
	presetId?: string;
	color?: string;
	muted?: boolean;
	solo?: boolean;
	instrument?: Partial<InstrumentConfiguration>;
	barSequence?: Array<number>;
	patterns?: Record<string, Array<AgentNoteInput>>;
}

export interface AgentSongSpecification {
	title?: string;
	author?: string;
	bpm?: number;
	beatsPerBar?: number;
	stepsPerBeat?: number;
	totalBars?: number;
	loopStartBar?: number;
	loopEndBar?: number;
	swing?: number;
	rootKey?: MusicalKey;
	scale?: ScaleType;
	masterVolume?: number;
	/** Optional named loop regions (e.g. game-music sections) */
	sections?: Array<AgentSectionInput>;
	channels: Array<AgentChannelSpecification>;
}

export interface AgentApiHelp {
	globalNames: Array<string>;
	methods: Record<string, string>;
	keys: Array<MusicalKey>;
	scales: Array<ScaleType>;
	presets: Array<{ id: string; name: string; category: ChannelType }>;
	modernPresets: Array<{
		id: string;
		name: string;
		category: ChannelType;
		engine: ModernEngine | undefined;
		engineLabel: string | undefined;
	}>;
	drumPads: Array<{ pitch: number; shortLabel: string; label: string }>;
	exampleComposeSong: AgentSongSpecification;
}

const NOTE_OFFSET_MAP: Record<string, number> = {
	C: 0,
	"C#": 1,
	DB: 1,
	D: 2,
	"D#": 3,
	EB: 3,
	E: 4,
	F: 5,
	"F#": 6,
	GB: 6,
	G: 7,
	"G#": 8,
	AB: 8,
	A: 9,
	"A#": 10,
	BB: 10,
	B: 11,
};

const DRUM_NAME_MAP: Record<string, number> = {
	KICK: 0,
	"8-BIT KICK": 0,
	BD: 0,
	SNARE: 1,
	"NOISE SNARE": 1,
	SD: 1,
	CHH: 2,
	"CLOSED HAT": 2,
	HIHAT: 2,
	HH: 2,
	OHH: 3,
	"OPEN HAT": 3,
	LTOM: 4,
	"LOW CHIP TOM": 4,
	"LOW TOM": 4,
	HTOM: 5,
	"HIGH CHIP TOM": 5,
	"HIGH TOM": 5,
	CLAP: 6,
	"RETRO CLAP": 6,
	BLIP: 7,
	"COIN BLIP": 7,
	COIN: 7,
	RIDE: 2,
	CRASH: 3,
	ZAP: 7,
};

const clampNumber = (value: number, min: number, max: number): number => {
	return Math.max(min, Math.min(max, value));
};

export const noteNameToMidi = (noteName: string): number => {
	const trimmed = noteName.trim().toUpperCase();
	const drumMatch = DRUM_NAME_MAP[trimmed];
	if (drumMatch !== undefined) {
		return drumMatch;
	}

	const match = /^([A-G][#B]?)(-?\d+)$/.exec(trimmed);
	if (!match) {
		throw new Error(`Invalid note or drum name: "${noteName}"`);
	}
	const pitchName = match[1] ?? "";
	const octaveText = match[2] ?? "";
	const semitone = NOTE_OFFSET_MAP[pitchName];
	const octave = Number.parseInt(octaveText, 10);
	if (semitone === undefined || !Number.isFinite(octave)) {
		throw new Error(`Invalid note name: "${noteName}"`);
	}
	return (octave + 1) * 12 + semitone;
};

const resolvePitchValue = (
	pitchOrNote: number | string,
	channelType: ChannelType
): number => {
	const rawPitch =
		typeof pitchOrNote === "string"
			? noteNameToMidi(pitchOrNote)
			: Math.round(pitchOrNote);
	if (!Number.isFinite(rawPitch)) {
		throw new Error(`Invalid pitch value: ${String(pitchOrNote)}`);
	}
	return channelType === "drum"
		? clampNumber(rawPitch, 0, 7)
		: clampNumber(rawPitch, MELODIC_MIN_MIDI, MELODIC_MAX_MIDI);
};

const normalizeAgentNote = (
	input: AgentNoteInput,
	channelType: ChannelType,
	stepsPerBar: number
): NoteEvent => {
	const pitchSource = input.pitch !== undefined ? input.pitch : input.note;
	if (pitchSource === undefined) {
		throw new Error("Note input must specify either 'pitch' or 'note'.");
	}
	const step = clampNumber(Math.round(input.step), 0, stepsPerBar - 1);
	const pitch = resolvePitchValue(pitchSource, channelType);
	const duration = clampNumber(
		Math.round(input.duration ?? (channelType === "drum" ? 1 : 2)),
		1,
		stepsPerBar - step
	);
	const velocity = clampNumber(input.velocity ?? 0.9, 0.1, 1);
	const pitchBend = clampNumber(Math.round(input.pitchBend ?? 0), -24, 24);

	const filterCutoff =
		input.filterCutoff !== undefined && Number.isFinite(input.filterCutoff)
			? clampNumber(Math.round(input.filterCutoff), 180, 14000)
			: undefined;
	const filterSweepTo =
		input.filterSweepTo !== undefined && Number.isFinite(input.filterSweepTo)
			? clampNumber(Math.round(input.filterSweepTo), 180, 14000)
			: undefined;
	const ratchet =
		input.ratchet !== undefined && Number.isFinite(input.ratchet)
			? clampNumber(Math.round(input.ratchet), 1, MAX_NOTE_RATCHET)
			: 1;
	const timingOffset =
		input.timingOffset !== undefined
			? clampTimingOffset(input.timingOffset)
			: 0;

	return {
		id: `note-${step}-${pitch}-${Math.random().toString(36).slice(2, 8)}`,
		step,
		pitch,
		duration,
		velocity,
		pitchBend,
		...(input.bendStyle ? { bendStyle: input.bendStyle } : {}),
		...(input.fadeMode ? { fadeMode: input.fadeMode } : {}),
		...(filterCutoff !== undefined ? { filterCutoff } : {}),
		...(filterSweepTo !== undefined ? { filterSweepTo } : {}),
		...(ratchet > 1 ? { ratchet } : {}),
		...(timingOffset !== 0 ? { timingOffset } : {}),
		...(isNoteArticulation(input.articulation)
			? { articulation: input.articulation }
			: {}),
		...(channelType === "pitch" && isNoteOrnament(input.ornament)
			? { ornament: input.ornament }
			: {}),
	};
};

export interface ChiptuneAgentApi {
	getHelp: () => AgentApiHelp;
	getState: () => ChiptuneStoreState;
	getSong: () => SongProject;
	listPresets: () => Array<InstrumentPresetDefinition>;
	/** Modern-mode presets (sampled piano / strings, synths, kits, sampler, slicer) */
	listModernPresets: () => Array<InstrumentPresetDefinition>;
	/** Merge modern engine / FX settings on a modern channel */
	updateModernSettings: (
		channelIndex: number,
		updates: Partial<ModernInstrumentSettings>
	) => void;
	listScales: () => typeof SCALE_DEFINITIONS;
	listKeys: () => Array<MusicalKey>;
	listDrumPads: () => Array<DrumPadDefinition>;
	listDemoSongs: () => Array<{
		id: string;
		title: string;
		engine: "chiptune" | "modern";
		bpm: number;
		rootKey: MusicalKey;
		scale: ScaleType;
		totalBars: number;
		channelCount: number;
	}>;
	getScaleNotes: (
		rootKey?: MusicalKey,
		scale?: ScaleType
	) => Array<{ midi: number; note: string }>;
	noteNameToMidi: (noteName: string) => number;
	midiToNoteName: (midi: number) => string;

	play: () => void;
	stop: () => void;
	togglePlay: () => boolean;
	getStudioMode: () => StudioMode;
	setStudioMode: (mode: StudioMode) => StudioMode;
	listSfxPresets: () => Array<{
		id: string;
		title: string;
		category: SfxCategory;
		badge: string;
		description: string;
		totalBars: number;
		bpm: number;
	}>;
	loadSfxPreset: (presetId: string) => SongProject;
	generateSfx: (archetype?: SfxGeneratorArchetype) => Array<NoteEvent>;
	setLoopMode: (mode: LoopMode) => void;
	setFollowPlayhead: (follow: boolean) => void;
	selectChannel: (channelIndex: number) => void;
	selectBar: (barIndex: number) => void;
	setTool: (tool: EditorTool) => void;
	setZoom: (zoom: number) => number;

	createNewProject: (
		title?: string,
		options?: Partial<
			Pick<
				SongProject,
				"bpm" | "rootKey" | "scale" | "totalBars" | "swing" | "masterVolume"
			>
		>
	) => SongProject;
	updateSongMetadata: (
		updates: Partial<
			Pick<
				SongProject,
				"title" | "bpm" | "rootKey" | "scale" | "swing" | "masterVolume"
			>
		>
	) => SongProject;
	setTotalBars: (totalBars: number) => number;
	setLoopRange: (
		loopStartBar: number,
		loopEndBar: number
	) => { loopStartBar: number; loopEndBar: number };
	addChannel: (
		channelType: ChannelType,
		options?: { name?: string; presetId?: string }
	) => Channel | null;
	removeChannel: (channelIndex: number) => void;
	applyPreset: (channelIndex: number, presetId: string) => void;
	updateChannelInstrument: (
		channelIndex: number,
		updates: Partial<InstrumentConfiguration>
	) => void;
	setBarPattern: (
		channelIndex: number,
		barIndex: number,
		patternIndex: number
	) => void;
	setChannelBarSequence: (
		channelIndex: number,
		barSequence: Array<number>
	) => void;

	addNote: (
		input: AgentNoteInput & { channelIndex?: number; barIndex?: number }
	) => NoteEvent;
	removeNote: (
		step: number,
		pitchOrNote: number | string,
		channelIndex?: number,
		barIndex?: number
	) => void;
	setBarNotes: (
		channelIndex: number,
		barIndex: number,
		notes: Array<AgentNoteInput>
	) => Array<NoteEvent>;
	setPatternNotes: (
		channelIndex: number,
		patternIndex: number,
		notes: Array<AgentNoteInput>
	) => Array<NoteEvent>;
	clearPattern: (channelIndex?: number, barIndex?: number) => void;
	generateRiff: (channelIndex?: number, barIndex?: number) => Array<NoteEvent>;
	transposePattern: (
		semitones: number,
		channelIndex?: number,
		barIndex?: number
	) => Array<NoteEvent>;
	previewNote: (pitchOrNote: number | string, channelIndex?: number) => void;

	composeSong: (specification: AgentSongSpecification) => SongProject;
	exportSongJson: () => string;
	importSongJson: (jsonOrProject: string | SongProject) => SongProject;
	exportWavBlob: (
		loopCount?: number,
		options?: { seamlessLoop?: boolean }
	) => Promise<Blob>;
	exportMidiBlob: (options?: MidiExportOptions) => Blob;
	exportMidiBytes: (options?: MidiExportOptions) => Uint8Array;

	setNoteVelocity: (
		step: number,
		pitchOrNote: number | string,
		velocity: number,
		channelIndex?: number,
		barIndex?: number
	) => NoteEvent | null;
	setNoteTiming: (
		step: number,
		pitchOrNote: number | string,
		timingOffset: number,
		channelIndex?: number,
		barIndex?: number
	) => NoteEvent | null;
	scalePatternVelocity: (
		factor: number,
		channelIndex?: number,
		barIndex?: number
	) => Array<NoteEvent>;
	humanizePattern: (
		options?: HumanizeOptions,
		channelIndex?: number,
		barIndex?: number
	) => Array<NoteEvent>;
	quantizePattern: (
		channelIndex?: number,
		barIndex?: number
	) => Array<NoteEvent>;
	listArticulations: () => {
		articulations: Array<{
			id: NoteArticulation;
			name: string;
			description: string;
			shape: ArticulationShape;
		}>;
		ornaments: Array<{ id: NoteOrnament; name: string; description: string }>;
	};
	setNoteArticulation: (
		step: number,
		pitchOrNote: number | string,
		articulation: NoteArticulation | null,
		channelIndex?: number,
		barIndex?: number
	) => NoteEvent | null;
	setNoteOrnament: (
		step: number,
		pitchOrNote: number | string,
		ornament: NoteOrnament | null,
		channelIndex?: number,
		barIndex?: number
	) => NoteEvent | null;
	setPatternArticulation: (
		articulation: NoteArticulation | null,
		options?: {
			noteIds?: Array<string>;
			channelIndex?: number;
			barIndex?: number;
		}
	) => Array<NoteEvent>;
	listSections: () => Array<SongSection>;
	setSections: (sections: Array<AgentSectionInput>) => Array<SongSection>;
	loopSection: (
		nameOrId: string
	) => { loopStartBar: number; loopEndBar: number } | null;
	exportSectionWav: (nameOrId: string, loopCount?: number) => Promise<Blob>;
	measureLevels: (options?: {
		section?: string;
		loopCount?: number;
	}) => Promise<AgentLevelReport>;
}

const getValidatedChannelAndBar = (
	channelIndex?: number,
	barIndex?: number
): { state: ChiptuneStoreState; targetChannel: number; targetBar: number } => {
	const state = useChiptuneStore.getState();
	const targetChannel = clampNumber(
		channelIndex ?? state.selectedChannelIndex,
		0,
		Math.max(0, state.song.channels.length - 1)
	);
	const targetBar = clampNumber(
		barIndex ?? state.selectedBarIndex,
		0,
		Math.max(0, state.song.totalBars - 1)
	);
	return { state, targetChannel, targetBar };
};

const findSongSection = (
	song: SongProject,
	nameOrId: string
): SongSection | undefined => {
	const target = nameOrId.trim().toLowerCase();
	return song.sections?.find(
		(section) =>
			section.id === nameOrId || section.name.trim().toLowerCase() === target
	);
};

const getPatternNotesAt = (
	channelIndex: number,
	barIndex: number
): Array<NoteEvent> => {
	const channel = useChiptuneStore.getState().song.channels[channelIndex];
	const patternIndex = channel?.barSequence[barIndex] ?? 0;
	return structuredClone(channel?.patterns[String(patternIndex)]?.notes ?? []);
};

/** Sets one property (by note covering `step` at `pitch`) via the shared helper. */
const updateNoteAt = (
	step: number,
	pitchOrNote: number | string,
	update: Omit<NotePropertyUpdate, "id">,
	channelIndex?: number,
	barIndex?: number
): NoteEvent | null => {
	const { state, targetChannel, targetBar } = getValidatedChannelAndBar(
		channelIndex,
		barIndex
	);
	const channel = state.song.channels[targetChannel];
	if (!channel) {
		return null;
	}
	const resolvedPitch = resolvePitchValue(pitchOrNote, channel.type);
	const target = getPatternNotesAt(targetChannel, targetBar).find(
		(note) =>
			note.pitch === resolvedPitch &&
			step >= note.step &&
			step < note.step + note.duration
	);
	if (!target) {
		return null;
	}
	useChiptuneStore.setState((currentState) => ({
		song: updateNotePropertiesInSong(
			currentState.song,
			targetChannel,
			targetBar,
			[{ id: target.id, ...update }]
		),
	}));
	return (
		getPatternNotesAt(targetChannel, targetBar).find(
			(note) => note.id === target.id
		) ?? null
	);
};

export const chiptuneAgentApi: ChiptuneAgentApi = {
	getHelp: (): AgentApiHelp => ({
		globalNames: ["window.chiptuneApi", "window.ultrabeepApi"],
		methods: {
			composeSong:
				"Build and load a complete multi-channel, multi-bar song in one call using note names ('C4', 'KICK') and presets.",
			createNewProject:
				"Reset to a blank song with optional title, bpm, rootKey, scale, totalBars, swing, and masterVolume.",
			addChannel: "Add a 'pitch' or 'drum' channel with optional name/preset.",
			setBarNotes:
				"Set all notes for a given channelIndex and barIndex (creates/updates pattern automatically).",
			setPatternNotes:
				"Set all notes for a reusable pattern slot (patternIndex >= 1) on a channel.",
			setBarPattern: `Assign a pattern index (0 = silent, 1..${MAX_PATTERN_INDEX} = pattern) to a bar slot.`,
			addNote:
				"Add or replace a single note using numeric MIDI pitch or note name string.",
			noteOptions:
				"Every note accepts step, note/pitch, duration, velocity (0.1-1 per-note volume), pitchBend (semitones; also re-pitches drum hits), bendStyle, fadeMode, filterCutoff, filterSweepTo, ratchet (1-8 stutter retriggers; with pitchBend it becomes a stepped riser) and timingOffset (-0.5..+0.5 steps off the grid; negative = early).",
			setNoteVelocity:
				"setNoteVelocity(step, pitchOrNote, velocity, channelIndex?, barIndex?) sets one note's volume (0.1-1).",
			setNoteTiming:
				"setNoteTiming(step, pitchOrNote, timingOffset, channelIndex?, barIndex?) nudges one note off the grid (-0.5..+0.5 steps).",
			scalePatternVelocity:
				"scalePatternVelocity(factor, channelIndex?, barIndex?) multiplies every note volume in a pattern (e.g. 0.8 = quieter, keeps accents).",
			humanizePattern:
				"humanizePattern({ velocityAmount?, timingAmount?, noteIds?, seed? }, channelIndex?, barIndex?) adds small random volume/timing variation (defaults ±0.08).",
			quantizePattern:
				"quantizePattern(channelIndex?, barIndex?) removes timing nudges (snap to grid).",
			articulation:
				"Notes accept articulation: 'staccato' (short, ~45% length), 'tenuto' (full length, held weight), 'accent' (louder + brighter attack), 'marcato' (strongest accent, slightly short) or 'legato' (slurs from the previous touching note in the same pattern: no re-attack + quick glide; the previous note is cut where the legato note starts). Drums honour accent/marcato as louder hits.",
			ornament:
				"Pitched notes accept ornament: 'grace' (flick from the scale step below), 'mordent' (note → step above → note) or 'trill' (fast alternation with the step above for the whole note). Neighbours follow the song key/scale.",
			setNoteArticulation:
				"setNoteArticulation(step, pitchOrNote, articulation | null, channelIndex?, barIndex?) sets or clears one note's articulation.",
			setNoteOrnament:
				"setNoteOrnament(step, pitchOrNote, ornament | null, channelIndex?, barIndex?) sets or clears one note's ornament.",
			setPatternArticulation:
				"setPatternArticulation(articulation | null, { noteIds?, channelIndex?, barIndex? }) sets the articulation of every note (or the given ids) in a pattern.",
			listArticulations:
				"listArticulations() returns every articulation (with its gate / gain / filter shape) and ornament.",
			setSections:
				"setSections([{ name, startBar, endBar }]) defines named loop regions (0-indexed, inclusive) — e.g. game-music sections. composeSong also accepts sections.",
			loopSection: "loopSection(nameOrId) sets the loop range to a section.",
			exportSectionWav:
				"exportSectionWav(nameOrId, loopCount?) renders one section as a seamless loop WAV (reverb/release tails folded onto the start, trimmed to the exact loop length) without changing the loop range.",
			instrumentReverb:
				"updateChannelInstrument(channelIndex, { reverbMix: 0..1 }) sends the channel into the shared cinematic hall reverb (~3.4 s tail) — ~0.2 room, ~0.45 big hall, 0.7+ distant wash.",
			instrumentPunch:
				"updateChannelInstrument(channelIndex, { punch: 0..1 }) runs the whole channel through one glue compressor (+ make-up gain) — ~0.5 tight, ~0.7 crushed sampled-break feel, 1 slammed.",
			heavyBreakcore:
				"Presets breakcore-heavy-break-kit (drum: 0 kick, 1 snare w/ room tail, 2 hat, 3 crash, 4/5 toms, 6 open hat, 7 kick+snare chop), breakcore-808 (waveform 'sub808': kick+bass in one, play on chord roots), breakcore-dream-saw (long emotional lead), breakcore-vocal-chop (short choir chops).",
			cinematicWaveforms:
				"Waveforms 'piano' (felt piano, natural decay — use sustain 1), 'strings' (five drifting saw players — slow attack for pads, short + staccato for ostinatos) and 'choir' (formant 'aah' with breath). Presets: cinematic-felt-piano, cinematic-strings, cinematic-low-strings, cinematic-airy-choir, cinematic-music-box, cinematic-perc-kit.",
			measureLevels:
				"measureLevels({ section?, loopCount? }) renders offline and returns peak, peakDb, rmsDb and clipped sample count.",
			instrumentDrive:
				"updateChannelInstrument(channelIndex, { drive: 0..1 }) adds bit-crushed overdrive — ~0.25 grit, ~0.6 reese crunch, 0.85+ gabber distortion.",
			play: "Start live playback.",
			stop: "Stop live playback.",
			setStudioMode:
				"Switch between 'modern' (modern music maker: sampled piano / strings / harp, supersaw, pad, pluck, FM keys, reese / sub bass, punchy + jungle break kits, user sampler and break slicer, studio FX), 'music' (retro chiptune composer) and 'sfx' (retro SFX & short track creator). Each mode keeps its own project.",
			modernMode:
				"In 'modern' mode apply presets from listModernPresets() and tweak them with updateModernSettings(channelIndex, { cutoff, resonance, filterEnv, spread, tune, drive, chorus, delayMix, delayDivision, delayFeedback, reverbSend, sidechain, lowCut }). Volume, pan and attack/decay/sustain/release stay on updateChannelInstrument. Drum kits use pads 0-7 (kick, snare, closed hat, open hat, low tom, high tom, clap, crash/ride); a kit kick ducks every channel with sidechain > 0. Slicer channels: C3 (48) = slice 1, one slice per semitone.",
			loadSfxPreset:
				"Load a built-in retro SFX or short jingle preset ('sfx-ray-gun', 'sfx-hurt', 'sfx-attack', 'sfx-winning', 'sfx-defeated', etc.).",
			generateSfx:
				"Generate procedural SFX notes ('laser', 'hurt', 'attack', 'jump', 'coin', 'random') on the selected channel and bar.",
			exportSongJson: "Serialize current SongProject to JSON.",
			exportWavBlob:
				"exportWavBlob(loopCount?, { seamlessLoop? }) renders the current SongProject offline into a stereo WAV Blob. seamlessLoop: true folds the tail onto the start for a gapless game loop.",
			exportMidiBlob:
				"Export current SongProject to a standard multi-track MIDI Blob (SMF Format 1).",
			exportMidiBytes:
				"Export current SongProject to a standard multi-track MIDI Uint8Array (SMF Format 1).",
		},
		keys: MUSICAL_KEYS,
		scales: Object.keys(SCALE_DEFINITIONS) as Array<ScaleType>,
		presets: INSTRUMENT_PRESETS.map((preset) => ({
			id: preset.id,
			name: preset.name,
			category: preset.category,
		})),
		modernPresets: MODERN_INSTRUMENT_PRESETS.map((preset) => ({
			id: preset.id,
			name: preset.name,
			category: preset.category,
			engine: preset.configuration.modern?.engine,
			engineLabel: preset.configuration.modern
				? MODERN_ENGINE_LABELS[preset.configuration.modern.engine]
				: undefined,
		})),
		drumPads: DRUM_PAD_DEFINITIONS.map((pad) => ({
			pitch: pad.pitch,
			shortLabel: pad.shortLabel,
			label: pad.label,
		})),
		exampleComposeSong: {
			title: "Agent Chiptune",
			bpm: 140,
			rootKey: "C",
			scale: "minor",
			totalBars: 4,
			loopStartBar: 0,
			loopEndBar: 3,
			channels: [
				{
					name: "Lead",
					type: "pitch",
					presetId: "nes-pulse-25",
					barSequence: [1, 1, 2, 2],
					patterns: {
						"1": [
							{ step: 0, note: "C4", duration: 2 },
							{ step: 4, note: "D#4", duration: 2 },
							{ step: 8, note: "G4", duration: 4 },
						],
						"2": [
							{ step: 0, note: "G#4", duration: 2 },
							{ step: 4, note: "G4", duration: 2 },
							{ step: 8, note: "F4", duration: 4 },
						],
					},
				},
				{
					name: "Drums",
					type: "drum",
					presetId: "retro-8bit-kit",
					barSequence: [1, 1, 1, 1],
					patterns: {
						"1": [
							{ step: 0, note: "KICK" },
							{ step: 4, note: "SNARE" },
							{ step: 8, note: "KICK" },
							{ step: 12, note: "SNARE" },
						],
					},
				},
			],
		},
	}),

	getState: (): ChiptuneStoreState => useChiptuneStore.getState(),

	getSong: (): SongProject => structuredClone(useChiptuneStore.getState().song),

	listPresets: (): Array<InstrumentPresetDefinition> => INSTRUMENT_PRESETS,

	listModernPresets: (): Array<InstrumentPresetDefinition> =>
		MODERN_INSTRUMENT_PRESETS,

	updateModernSettings: (channelIndex, updates): void => {
		useChiptuneStore.getState().updateModernSettings(channelIndex, updates);
	},

	listScales: (): typeof SCALE_DEFINITIONS => SCALE_DEFINITIONS,

	listKeys: (): Array<MusicalKey> => MUSICAL_KEYS,

	listDrumPads: (): Array<DrumPadDefinition> => DRUM_PAD_DEFINITIONS,

	listDemoSongs: (): Array<{
		id: string;
		title: string;
		engine: "chiptune" | "modern";
		bpm: number;
		rootKey: MusicalKey;
		scale: ScaleType;
		totalBars: number;
		channelCount: number;
	}> =>
		ALL_DEMO_SONGS.map((demo) => ({
			id: demo.id,
			title: demo.title,
			engine: demo.engine ?? "chiptune",
			bpm: demo.bpm,
			rootKey: demo.rootKey,
			scale: demo.scale,
			totalBars: demo.totalBars,
			channelCount: demo.channels.length,
		})),

	getScaleNotes: (
		rootKey?: MusicalKey,
		scale?: ScaleType
	): Array<{ midi: number; note: string }> => {
		const song = useChiptuneStore.getState().song;
		const resolvedKey = rootKey ?? song.rootKey;
		const resolvedScale = scale ?? song.scale;
		const intervals = SCALE_DEFINITIONS[resolvedScale].intervals;
		const rootIndex = MUSICAL_KEYS.indexOf(resolvedKey);
		const notes: Array<{ midi: number; note: string }> = [];

		for (let midi = MELODIC_MIN_MIDI; midi <= MELODIC_MAX_MIDI; midi += 1) {
			const pitchClass = ((midi % 12) + 12) % 12;
			const relative = (pitchClass - rootIndex + 12) % 12;
			if (intervals.includes(relative)) {
				notes.push({ midi, note: midiToNoteName(midi) });
			}
		}
		return notes;
	},

	noteNameToMidi,
	midiToNoteName,

	play: (): void => {
		useChiptuneStore.getState().setIsPlaying(true);
	},

	stop: (): void => {
		useChiptuneStore.getState().setIsPlaying(false);
	},

	togglePlay: (): boolean => {
		const current = useChiptuneStore.getState().isPlaying;
		useChiptuneStore.getState().setIsPlaying(!current);
		return !current;
	},

	getStudioMode: (): StudioMode => useChiptuneStore.getState().studioMode,

	setStudioMode: (mode): StudioMode => {
		useChiptuneStore.getState().setStudioMode(mode);
		return useChiptuneStore.getState().studioMode;
	},

	listSfxPresets: (): Array<{
		id: string;
		title: string;
		category: SfxCategory;
		badge: string;
		description: string;
		totalBars: number;
		bpm: number;
	}> =>
		SFX_PRESETS.map((preset) => ({
			id: preset.id,
			title: preset.title,
			category: preset.category,
			badge: preset.badge,
			description: preset.description,
			totalBars: preset.project.totalBars,
			bpm: preset.project.bpm,
		})),

	loadSfxPreset: (presetId): SongProject => {
		useChiptuneStore.getState().loadSfxPreset(presetId);
		return structuredClone(useChiptuneStore.getState().song);
	},

	generateSfx: (archetype = "random"): Array<NoteEvent> => {
		useChiptuneStore.getState().generateSfxPattern(archetype);
		const nextState = useChiptuneStore.getState();
		const pattern = getActivePatternForChannel(
			nextState.song.channels[nextState.selectedChannelIndex],
			nextState.selectedBarIndex
		);
		return structuredClone(pattern?.notes ?? []);
	},

	setLoopMode: (mode): void => {
		useChiptuneStore.getState().setLoopMode(mode);
	},

	setFollowPlayhead: (follow): void => {
		useChiptuneStore.getState().setFollowPlayhead(follow);
	},

	selectChannel: (channelIndex): void => {
		useChiptuneStore.getState().setSelectedChannelIndex(channelIndex);
	},

	selectBar: (barIndex): void => {
		useChiptuneStore.getState().setSelectedBarIndex(barIndex);
	},

	setTool: (tool): void => {
		useChiptuneStore.getState().setActiveTool(tool);
	},

	setZoom: (zoom): number => {
		useChiptuneStore.getState().setPianoRollZoom(zoom);
		return useChiptuneStore.getState().pianoRollZoom;
	},

	createNewProject: (title, options): SongProject => {
		const store = useChiptuneStore.getState();
		store.createNewProject();
		if (options?.totalBars !== undefined) {
			useChiptuneStore.getState().setTotalBars(options.totalBars);
		}
		const metadataUpdates: Partial<
			Pick<
				SongProject,
				"title" | "bpm" | "rootKey" | "scale" | "swing" | "masterVolume"
			>
		> = {
			...(title !== undefined ? { title } : {}),
			...(options?.bpm !== undefined ? { bpm: options.bpm } : {}),
			...(options?.rootKey !== undefined ? { rootKey: options.rootKey } : {}),
			...(options?.scale !== undefined ? { scale: options.scale } : {}),
			...(options?.swing !== undefined ? { swing: options.swing } : {}),
			...(options?.masterVolume !== undefined
				? { masterVolume: options.masterVolume }
				: {}),
		};
		if (Object.keys(metadataUpdates).length > 0) {
			useChiptuneStore.getState().updateSongMetadata(metadataUpdates);
		}
		return structuredClone(useChiptuneStore.getState().song);
	},

	updateSongMetadata: (updates): SongProject => {
		useChiptuneStore.getState().updateSongMetadata(updates);
		return structuredClone(useChiptuneStore.getState().song);
	},

	setTotalBars: (totalBars): number => {
		useChiptuneStore.getState().setTotalBars(totalBars);
		return useChiptuneStore.getState().song.totalBars;
	},

	setLoopRange: (
		loopStartBar,
		loopEndBar
	): { loopStartBar: number; loopEndBar: number } => {
		useChiptuneStore.getState().setLoopRange(loopStartBar, loopEndBar);
		const updatedSong = useChiptuneStore.getState().song;
		return {
			loopStartBar: updatedSong.loopStartBar,
			loopEndBar: updatedSong.loopEndBar,
		};
	},

	addChannel: (channelType, options): Channel | null => {
		const beforeLength = useChiptuneStore.getState().song.channels.length;
		useChiptuneStore.getState().addChannel(channelType);
		const afterState = useChiptuneStore.getState();
		if (afterState.song.channels.length === beforeLength) {
			return null;
		}
		const newIndex = afterState.song.channels.length - 1;
		if (options?.presetId) {
			afterState.applyInstrumentPreset(newIndex, options.presetId);
		}
		if (options?.name) {
			useChiptuneStore.setState((state) => ({
				song: {
					...state.song,
					updatedAt: Date.now(),
					channels: state.song.channels.map((channel, index) =>
						index === newIndex
							? { ...channel, name: options.name ?? channel.name }
							: channel
					),
				},
			}));
		}
		return structuredClone(
			useChiptuneStore.getState().song.channels[newIndex] ?? null
		);
	},

	removeChannel: (channelIndex): void => {
		useChiptuneStore.getState().removeChannel(channelIndex);
	},

	applyPreset: (channelIndex, presetId): void => {
		useChiptuneStore.getState().applyInstrumentPreset(channelIndex, presetId);
	},

	updateChannelInstrument: (channelIndex, updates): void => {
		useChiptuneStore.getState().updateChannelInstrument(channelIndex, updates);
	},

	setBarPattern: (channelIndex, barIndex, patternIndex): void => {
		useChiptuneStore
			.getState()
			.setBarPatternIndex(channelIndex, barIndex, patternIndex);
	},

	setChannelBarSequence: (channelIndex, barSequence): void => {
		useChiptuneStore.setState((state) => {
			const channel = state.song.channels[channelIndex];
			if (!channel) {
				return state;
			}
			const normalizedSequence = Array.from(
				{ length: state.song.totalBars },
				(_, barIndex) =>
					clampNumber(barSequence[barIndex] ?? 0, 0, MAX_PATTERN_INDEX)
			);
			const nextPatterns: Record<string, Pattern> = { ...channel.patterns };
			for (const patternNumber of normalizedSequence) {
				if (patternNumber > 0 && !nextPatterns[String(patternNumber)]) {
					nextPatterns[String(patternNumber)] = {
						index: patternNumber,
						notes: [],
					};
				}
			}
			return {
				song: {
					...state.song,
					updatedAt: Date.now(),
					channels: state.song.channels.map((existingChannel, index) =>
						index === channelIndex
							? {
									...existingChannel,
									barSequence: normalizedSequence,
									patterns: nextPatterns,
								}
							: existingChannel
					),
				},
			};
		});
	},

	addNote: (input): NoteEvent => {
		const { state, targetChannel, targetBar } = getValidatedChannelAndBar(
			input.channelIndex,
			input.barIndex
		);
		const channel = state.song.channels[targetChannel];
		if (!channel) {
			throw new Error(`Channel ${targetChannel} does not exist.`);
		}
		const stepsPerBar = getStepsPerBar(state.song);
		const normalized = normalizeAgentNote(input, channel.type, stepsPerBar);

		useChiptuneStore.setState((currentState) => ({
			song: updateChannelPatternNotes(
				currentState.song,
				targetChannel,
				targetBar,
				(notes) => [
					...notes.filter(
						(existing) =>
							!(
								existing.pitch === normalized.pitch &&
								existing.step === normalized.step
							)
					),
					normalized,
				]
			),
		}));

		return normalized;
	},

	removeNote: (step, pitchOrNote, channelIndex, barIndex): void => {
		const { state, targetChannel, targetBar } = getValidatedChannelAndBar(
			channelIndex,
			barIndex
		);
		const channel = state.song.channels[targetChannel];
		if (!channel) {
			return;
		}
		const resolvedPitch = resolvePitchValue(pitchOrNote, channel.type);
		useChiptuneStore.setState((currentState) => ({
			song: updateChannelPatternNotes(
				currentState.song,
				targetChannel,
				targetBar,
				(notes) =>
					notes.filter(
						(note) =>
							!(
								note.pitch === resolvedPitch &&
								step >= note.step &&
								step < note.step + note.duration
							)
					)
			),
		}));
	},

	setBarNotes: (channelIndex, barIndex, notes): Array<NoteEvent> => {
		const { state, targetChannel, targetBar } = getValidatedChannelAndBar(
			channelIndex,
			barIndex
		);
		const channel = state.song.channels[targetChannel];
		if (!channel) {
			throw new Error(`Channel ${channelIndex} does not exist.`);
		}
		const stepsPerBar = getStepsPerBar(state.song);
		const normalizedNotes = notes.map((noteInput) =>
			normalizeAgentNote(noteInput, channel.type, stepsPerBar)
		);

		useChiptuneStore.setState((currentState) => {
			let updatedSong = currentState.song;
			const targetChannelRecord = updatedSong.channels[targetChannel];
			if (
				targetChannelRecord &&
				(targetChannelRecord.barSequence[targetBar] ?? 0) <= 0
			) {
				const nextPatternIndex =
					getNextAvailablePatternIndex(targetChannelRecord);
				updatedSong = setBarPatternIndexInSong(
					updatedSong,
					targetChannel,
					targetBar,
					nextPatternIndex
				);
			}
			return {
				song: updateChannelPatternNotes(
					updatedSong,
					targetChannel,
					targetBar,
					() => normalizedNotes
				),
			};
		});

		return normalizedNotes;
	},

	setPatternNotes: (channelIndex, patternIndex, notes): Array<NoteEvent> => {
		const state = useChiptuneStore.getState();
		const channel = state.song.channels[channelIndex];
		if (!channel) {
			throw new Error(`Channel ${channelIndex} does not exist.`);
		}
		const clampedPatternIndex = clampNumber(
			Math.round(patternIndex),
			1,
			MAX_PATTERN_INDEX
		);
		const stepsPerBar = getStepsPerBar(state.song);
		const normalizedNotes = notes.map((noteInput) =>
			normalizeAgentNote(noteInput, channel.type, stepsPerBar)
		);

		useChiptuneStore.setState((currentState) => ({
			song: {
				...currentState.song,
				updatedAt: Date.now(),
				channels: currentState.song.channels.map((existingChannel, index) =>
					index === channelIndex
						? {
								...existingChannel,
								patterns: {
									...existingChannel.patterns,
									[String(clampedPatternIndex)]: {
										index: clampedPatternIndex,
										notes: normalizedNotes,
									},
								},
							}
						: existingChannel
				),
			},
		}));

		return normalizedNotes;
	},

	clearPattern: (channelIndex, barIndex): void => {
		const { targetChannel, targetBar } = getValidatedChannelAndBar(
			channelIndex,
			barIndex
		);
		useChiptuneStore.setState((currentState) => ({
			song: updateChannelPatternNotes(
				currentState.song,
				targetChannel,
				targetBar,
				() => []
			),
		}));
	},

	generateRiff: (channelIndex, barIndex): Array<NoteEvent> => {
		const { targetChannel, targetBar } = getValidatedChannelAndBar(
			channelIndex,
			barIndex
		);
		useChiptuneStore.setState((currentState) => ({
			song: generateRiffInChannelPattern(
				currentState.song,
				targetChannel,
				targetBar
			),
		}));
		const nextState = useChiptuneStore.getState();
		const pattern = getActivePatternForChannel(
			nextState.song.channels[targetChannel],
			targetBar
		);
		return structuredClone(pattern?.notes ?? []);
	},

	transposePattern: (semitones, channelIndex, barIndex): Array<NoteEvent> => {
		const { targetChannel, targetBar } = getValidatedChannelAndBar(
			channelIndex,
			barIndex
		);
		useChiptuneStore.setState((currentState) => ({
			song: transposeChannelPattern(
				currentState.song,
				targetChannel,
				targetBar,
				semitones
			),
		}));
		const nextState = useChiptuneStore.getState();
		const pattern = getActivePatternForChannel(
			nextState.song.channels[targetChannel],
			targetBar
		);
		return structuredClone(pattern?.notes ?? []);
	},

	previewNote: (pitchOrNote, channelIndex): void => {
		const state = useChiptuneStore.getState();
		const targetIndex = clampNumber(
			channelIndex ?? state.selectedChannelIndex,
			0,
			Math.max(0, state.song.channels.length - 1)
		);
		const channel = state.song.channels[targetIndex];
		if (!channel) {
			return;
		}
		const resolvedPitch = resolvePitchValue(pitchOrNote, channel.type);
		const stepDuration = 60 / state.song.bpm / state.song.stepsPerBeat;
		playPreviewNote(resolvedPitch, channel, undefined, stepDuration);
	},

	composeSong: (specification): SongProject => {
		const beatsPerBar = clampNumber(
			Math.round(specification.beatsPerBar ?? 4),
			2,
			8
		);
		const stepsPerBeat = clampNumber(
			Math.round(specification.stepsPerBeat ?? 4),
			2,
			8
		);
		const stepsPerBar = beatsPerBar * stepsPerBeat;
		const maxSequenceLength = specification.channels.reduce(
			(longest, channelSpecification) =>
				Math.max(longest, channelSpecification.barSequence?.length ?? 0),
			0
		);
		const totalBars = clampNumber(
			Math.round(
				specification.totalBars ?? Math.max(1, maxSequenceLength || 8)
			),
			1,
			MAX_SONG_BARS
		);
		const loopStartBar = clampNumber(
			Math.round(specification.loopStartBar ?? 0),
			0,
			totalBars - 1
		);
		const loopEndBar = clampNumber(
			Math.round(specification.loopEndBar ?? totalBars - 1),
			loopStartBar,
			totalBars - 1
		);

		const channels: Array<Channel> = specification.channels
			.slice(0, MAX_CHANNELS)
			.map((channelSpecification, index) => {
				const preset = channelSpecification.presetId
					? getPresetConfigurationById(channelSpecification.presetId)
					: getPresetConfigurationById(
							channelSpecification.type === "drum"
								? "retro-8bit-kit"
								: "nes-pulse-25"
						);
				const resolvedType: ChannelType =
					channelSpecification.type ?? preset.category;
				const barSequence = Array.from({ length: totalBars }, (_, barIndex) =>
					clampNumber(
						Math.round(
							channelSpecification.barSequence?.[barIndex] ??
								(barIndex === 0 ? 1 : 0)
						),
						0,
						MAX_PATTERN_INDEX
					)
				);

				const patterns: Record<string, Pattern> = {};
				if (channelSpecification.patterns) {
					for (const [patternKey, patternNotes] of Object.entries(
						channelSpecification.patterns
					)) {
						const parsedIndex = Number.parseInt(patternKey, 10);
						if (!Number.isFinite(parsedIndex) || parsedIndex <= 0) {
							continue;
						}
						patterns[String(parsedIndex)] = {
							index: parsedIndex,
							notes: patternNotes.map((noteInput) =>
								normalizeAgentNote(noteInput, resolvedType, stepsPerBar)
							),
						};
					}
				}
				for (const patternNumber of barSequence) {
					if (patternNumber > 0 && !patterns[String(patternNumber)]) {
						patterns[String(patternNumber)] = {
							index: patternNumber,
							notes: [],
						};
					}
				}

				return {
					id: `channel-agent-${Date.now()}-${index}`,
					name:
						channelSpecification.name ??
						(resolvedType === "drum"
							? `Drums ${index + 1}`
							: `Synth ${index + 1}`),
					type: resolvedType,
					color:
						channelSpecification.color ??
						CHANNEL_COLOR_PALETTE[index % CHANNEL_COLOR_PALETTE.length] ??
						"#00c7ff",
					muted: channelSpecification.muted ?? false,
					solo: channelSpecification.solo ?? false,
					instrument: {
						...preset.configuration,
						...channelSpecification.instrument,
					},
					barSequence,
					patterns,
				};
			});

		if (channels.length === 0) {
			throw new Error("composeSong requires at least one channel.");
		}

		const composedProject: SongProject = {
			id: `song-agent-${Date.now()}`,
			title: specification.title ?? "AI Chiptune Track",
			author: specification.author ?? "AI Agent",
			bpm: clampNumber(Math.round(specification.bpm ?? 132), 50, 240),
			beatsPerBar,
			stepsPerBeat,
			totalBars,
			loopStartBar,
			loopEndBar,
			swing: clampNumber(specification.swing ?? 0, 0, 0.6),
			rootKey: specification.rootKey ?? "C",
			scale: specification.scale ?? "minor",
			masterVolume: clampNumber(specification.masterVolume ?? 0.85, 0.05, 1),
			channels,
			...(specification.sections && specification.sections.length > 0
				? {
						sections: normalizeSongSections(specification.sections, totalBars),
					}
				: {}),
			updatedAt: Date.now(),
		};

		useChiptuneStore.getState().importSongProject(composedProject);
		return structuredClone(useChiptuneStore.getState().song);
	},

	exportSongJson: (): string => {
		return JSON.stringify(useChiptuneStore.getState().song, null, 2);
	},

	importSongJson: (jsonOrProject): SongProject => {
		const parsed =
			typeof jsonOrProject === "string"
				? (JSON.parse(jsonOrProject) as SongProject)
				: jsonOrProject;
		if (!parsed || !Array.isArray(parsed.channels)) {
			throw new Error("Invalid SongProject payload.");
		}
		useChiptuneStore.getState().importSongProject(parsed);
		return structuredClone(useChiptuneStore.getState().song);
	},

	exportWavBlob: async (loopCount = 1, options = {}): Promise<Blob> => {
		return renderSongToWavBlob(
			useChiptuneStore.getState().song,
			loopCount,
			options
		);
	},

	exportMidiBlob: (options?: MidiExportOptions): Blob => {
		return renderSongToMidiBlob(useChiptuneStore.getState().song, options);
	},

	setNoteVelocity: (
		step,
		pitchOrNote,
		velocity,
		channelIndex,
		barIndex
	): NoteEvent | null =>
		updateNoteAt(
			step,
			pitchOrNote,
			{ velocity: clampNoteVelocity(velocity) },
			channelIndex,
			barIndex
		),

	setNoteTiming: (
		step,
		pitchOrNote,
		timingOffset,
		channelIndex,
		barIndex
	): NoteEvent | null =>
		updateNoteAt(
			step,
			pitchOrNote,
			{ timingOffset: clampTimingOffset(timingOffset) },
			channelIndex,
			barIndex
		),

	scalePatternVelocity: (factor, channelIndex, barIndex): Array<NoteEvent> => {
		const { targetChannel, targetBar } = getValidatedChannelAndBar(
			channelIndex,
			barIndex
		);
		const safeFactor = Number.isFinite(factor) ? Math.max(0, factor) : 1;
		useChiptuneStore.setState((currentState) => ({
			song: updateNotePropertiesInSong(
				currentState.song,
				targetChannel,
				targetBar,
				getPatternNotesAt(targetChannel, targetBar).map((note) => ({
					id: note.id,
					velocity: note.velocity * safeFactor,
				}))
			),
		}));
		return getPatternNotesAt(targetChannel, targetBar);
	},

	listArticulations: () => ({
		articulations: NOTE_ARTICULATIONS.map((id) => ({
			id,
			name: ARTICULATION_LABELS[id].name,
			description: ARTICULATION_LABELS[id].description,
			shape: ARTICULATION_SHAPES[id],
		})),
		ornaments: NOTE_ORNAMENTS.map((id) => ({
			id,
			name: ORNAMENT_LABELS[id].name,
			description: ORNAMENT_LABELS[id].description,
		})),
	}),

	setNoteArticulation: (
		step,
		pitchOrNote,
		articulation,
		channelIndex,
		barIndex
	): NoteEvent | null =>
		updateNoteAt(
			step,
			pitchOrNote,
			{ articulation: isNoteArticulation(articulation) ? articulation : null },
			channelIndex,
			barIndex
		),

	setNoteOrnament: (
		step,
		pitchOrNote,
		ornament,
		channelIndex,
		barIndex
	): NoteEvent | null =>
		updateNoteAt(
			step,
			pitchOrNote,
			{ ornament: isNoteOrnament(ornament) ? ornament : null },
			channelIndex,
			barIndex
		),

	setPatternArticulation: (articulation, options = {}): Array<NoteEvent> => {
		const { targetChannel, targetBar } = getValidatedChannelAndBar(
			options.channelIndex,
			options.barIndex
		);
		const idFilter = options.noteIds ? new Set(options.noteIds) : null;
		useChiptuneStore.setState((currentState) => ({
			song: updateNotePropertiesInSong(
				currentState.song,
				targetChannel,
				targetBar,
				getPatternNotesAt(targetChannel, targetBar)
					.filter((note) => !idFilter || idFilter.has(note.id))
					.map((note) => ({
						id: note.id,
						articulation: isNoteArticulation(articulation)
							? articulation
							: null,
					}))
			),
		}));
		return getPatternNotesAt(targetChannel, targetBar);
	},

	humanizePattern: (options, channelIndex, barIndex): Array<NoteEvent> => {
		const { targetChannel, targetBar } = getValidatedChannelAndBar(
			channelIndex,
			barIndex
		);
		useChiptuneStore.setState((currentState) => ({
			song: humanizeNotesInSong(
				currentState.song,
				targetChannel,
				targetBar,
				options
			),
		}));
		return getPatternNotesAt(targetChannel, targetBar);
	},

	quantizePattern: (channelIndex, barIndex): Array<NoteEvent> => {
		const { targetChannel, targetBar } = getValidatedChannelAndBar(
			channelIndex,
			barIndex
		);
		useChiptuneStore.setState((currentState) => ({
			song: quantizeNotesInSong(currentState.song, targetChannel, targetBar),
		}));
		return getPatternNotesAt(targetChannel, targetBar);
	},

	listSections: (): Array<SongSection> =>
		structuredClone(useChiptuneStore.getState().song.sections ?? []),

	setSections: (sections): Array<SongSection> => {
		useChiptuneStore.getState().setSongSections(sections);
		return structuredClone(useChiptuneStore.getState().song.sections ?? []);
	},

	loopSection: (
		nameOrId
	): { loopStartBar: number; loopEndBar: number } | null => {
		const section = findSongSection(useChiptuneStore.getState().song, nameOrId);
		if (!section) {
			return null;
		}
		useChiptuneStore.getState().loopSection(section.id);
		const updatedSong = useChiptuneStore.getState().song;
		return {
			loopStartBar: updatedSong.loopStartBar,
			loopEndBar: updatedSong.loopEndBar,
		};
	},

	exportSectionWav: async (nameOrId, loopCount = 1): Promise<Blob> => {
		const song = useChiptuneStore.getState().song;
		const section = findSongSection(song, nameOrId);
		if (!section) {
			throw new Error(`Section "${nameOrId}" does not exist.`);
		}
		return renderSongToWavBlob(
			{ ...song, loopStartBar: section.startBar, loopEndBar: section.endBar },
			loopCount,
			{ seamlessLoop: true }
		);
	},

	measureLevels: async (options): Promise<AgentLevelReport> => {
		const song = useChiptuneStore.getState().song;
		const section = options?.section
			? findSongSection(song, options.section)
			: undefined;
		if (options?.section && !section) {
			throw new Error(`Section "${options.section}" does not exist.`);
		}
		const renderTarget = section
			? { ...song, loopStartBar: section.startBar, loopEndBar: section.endBar }
			: song;
		const audioBuffer = await renderSongToAudioBuffer(
			renderTarget,
			options?.loopCount ?? 1
		);
		return measureAudioBufferLevels(audioBuffer);
	},

	exportMidiBytes: (options?: MidiExportOptions): Uint8Array => {
		return renderSongToMidiBytes(useChiptuneStore.getState().song, options);
	},
};

declare global {
	interface Window {
		chiptuneApi?: ChiptuneAgentApi;
		ultrabeepApi?: ChiptuneAgentApi;
	}
}

export const registerChiptuneAgentApi = (): ChiptuneAgentApi => {
	if (typeof window !== "undefined") {
		window.chiptuneApi = chiptuneAgentApi;
		window.ultrabeepApi = chiptuneAgentApi;
	}
	return chiptuneAgentApi;
};

if (typeof window !== "undefined") {
	registerChiptuneAgentApi();
}

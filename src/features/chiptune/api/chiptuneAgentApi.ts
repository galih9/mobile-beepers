import {
	renderSongToMidiBlob,
	renderSongToMidiBytes,
	type MidiExportOptions,
} from "../audio/midiExporter";
import { playPreviewNote } from "../audio/voiceSynthesizer";
import { renderSongToWavBlob } from "../audio/wavExporter";
import { DEMO_SONGS } from "../constants/demoSongs";
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
	setBarPatternIndexInSong,
	transposeChannelPattern,
	updateChannelPatternNotes,
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
	NoteBendStyle,
	NoteEvent,
	NoteFadeMode,
	Pattern,
	ScaleType,
	SfxCategory,
	SfxGeneratorArchetype,
	SongProject,
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
	channels: Array<AgentChannelSpecification>;
}

export interface AgentApiHelp {
	globalNames: Array<string>;
	methods: Record<string, string>;
	keys: Array<MusicalKey>;
	scales: Array<ScaleType>;
	presets: Array<{ id: string; name: string; category: ChannelType }>;
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

	return {
		id: `note-${step}-${pitch}-${Math.random().toString(36).slice(2, 8)}`,
		step,
		pitch,
		duration,
		velocity,
		pitchBend,
		...(input.bendStyle ? { bendStyle: input.bendStyle } : {}),
		...(input.fadeMode ? { fadeMode: input.fadeMode } : {}),
	};
};

export interface ChiptuneAgentApi {
	getHelp: () => AgentApiHelp;
	getState: () => ChiptuneStoreState;
	getSong: () => SongProject;
	listPresets: () => Array<InstrumentPresetDefinition>;
	listScales: () => typeof SCALE_DEFINITIONS;
	listKeys: () => Array<MusicalKey>;
	listDrumPads: () => Array<DrumPadDefinition>;
	listDemoSongs: () => Array<{
		id: string;
		title: string;
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
	exportWavBlob: (loopCount?: number) => Promise<Blob>;
	exportMidiBlob: (options?: MidiExportOptions) => Blob;
	exportMidiBytes: (options?: MidiExportOptions) => Uint8Array;
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
			setBarPattern:
				"Assign a pattern index (0 = silent, 1..32 = pattern) to a bar slot.",
			addNote:
				"Add or replace a single note using numeric MIDI pitch or note name string.",
			play: "Start live playback.",
			stop: "Stop live playback.",
			setStudioMode:
				"Switch between 'music' (default multi-bar composer) and 'sfx' (retro SFX & short track creator).",
			loadSfxPreset:
				"Load a built-in retro SFX or short jingle preset ('sfx-ray-gun', 'sfx-hurt', 'sfx-attack', 'sfx-winning', 'sfx-defeated', etc.).",
			generateSfx:
				"Generate procedural SFX notes ('laser', 'hurt', 'attack', 'jump', 'coin', 'random') on the selected channel and bar.",
			exportSongJson: "Serialize current SongProject to JSON.",
			exportWavBlob:
				"Render current SongProject offline into a stereo WAV Blob.",
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

	listScales: (): typeof SCALE_DEFINITIONS => SCALE_DEFINITIONS,

	listKeys: (): Array<MusicalKey> => MUSICAL_KEYS,

	listDrumPads: (): Array<DrumPadDefinition> => DRUM_PAD_DEFINITIONS,

	listDemoSongs: (): Array<{
		id: string;
		title: string;
		bpm: number;
		rootKey: MusicalKey;
		scale: ScaleType;
		totalBars: number;
		channelCount: number;
	}> =>
		DEMO_SONGS.map((demo) => ({
			id: demo.id,
			title: demo.title,
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
				(_, barIndex) => clampNumber(barSequence[barIndex] ?? 0, 0, 32)
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
		const clampedPatternIndex = clampNumber(Math.round(patternIndex), 1, 32);
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
			32
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
			.slice(0, 8)
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
						32
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

	exportWavBlob: async (loopCount = 1): Promise<Blob> => {
		return renderSongToWavBlob(useChiptuneStore.getState().song, loopCount);
	},

	exportMidiBlob: (options?: MidiExportOptions): Blob => {
		return renderSongToMidiBlob(useChiptuneStore.getState().song, options);
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

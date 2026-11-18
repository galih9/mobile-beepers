import type {
	ChannelType,
	EditorTool,
	InstrumentConfiguration,
	LoopMode,
	MobileWorkspaceTab,
	NoteBatchMoveUpdate,
	NoteBendStyle,
	NoteEvent,
	SfxGeneratorArchetype,
	SongProject,
	StudioMode,
} from "../types/music";

export interface PersistedChiptuneState {
	studioMode?: StudioMode;
	song: SongProject;
	musicProjectBackup?: SongProject | null;
	sfxProjectBackup?: SongProject | null;
	savedSongs: Array<SongProject>;
	scaleLockOnly: boolean;
	showGhostNotes: boolean;
	defaultNoteDuration: number;
	followPlayhead: boolean;
}

export interface ChiptuneStoreState {
	studioMode: StudioMode;
	song: SongProject;
	musicProjectBackup: SongProject | null;
	sfxProjectBackup: SongProject | null;
	savedSongs: Array<SongProject>;
	selectedChannelIndex: number;
	selectedBarIndex: number;
	activeWorkspaceTab: MobileWorkspaceTab;
	activeTool: EditorTool;
	defaultNoteDuration: number;
	pianoRollZoom: number;
	scaleLockOnly: boolean;
	showGhostNotes: boolean;
	followPlayhead: boolean;
	isPlaying: boolean;
	loopMode: LoopMode;
	playbackBar: number;
	playbackStep: number;

	setActiveWorkspaceTab: (tab: MobileWorkspaceTab) => void;
	setActiveTool: (tool: EditorTool) => void;
	setDefaultNoteDuration: (duration: number) => void;
	setPianoRollZoom: (zoom: number) => void;
	toggleScaleLockOnly: () => void;
	toggleShowGhostNotes: () => void;
	setFollowPlayhead: (follow: boolean) => void;
	toggleFollowPlayhead: () => void;
	setSelectedChannelIndex: (index: number) => void;
	setSelectedBarIndex: (index: number) => void;
	setIsPlaying: (playing: boolean) => void;
	setLoopMode: (mode: LoopMode) => void;
	setPlaybackPosition: (barIndex: number, stepIndex: number) => void;

	updateSongMetadata: (
		updates: Partial<
			Pick<
				SongProject,
				"title" | "bpm" | "rootKey" | "scale" | "swing" | "masterVolume"
			>
		>
	) => void;
	setTotalBars: (totalBars: number) => void;
	setLoopRange: (loopStartBar: number, loopEndBar: number) => void;
	addChannel: (channelType: ChannelType) => void;
	removeChannel: (channelIndex: number) => void;
	reorderChannels: (fromIndex: number, toIndex: number) => void;
	toggleChannelMute: (channelIndex: number) => void;
	toggleChannelSolo: (channelIndex: number) => void;
	setBarPatternIndex: (
		channelIndex: number,
		barIndex: number,
		patternIndex: number
	) => void;
	clonePatternToBar: (channelIndex: number, barIndex: number) => void;
	copyBarPatternSlot: (
		sourceChannelIndex: number,
		sourceBarIndex: number,
		targetChannelIndex: number,
		targetBarIndex: number
	) => void;

	addOrReplaceNote: (noteInput: Omit<NoteEvent, "id">) => void;
	removeNoteAt: (step: number, pitch: number) => void;
	resizeNoteAt: (step: number, pitch: number, duration: number) => void;
	moveNoteAt: (
		fromStep: number,
		fromPitch: number,
		toStep: number,
		toPitch: number
	) => void;
	moveNotesBatch: (
		updates: Array<NoteBatchMoveUpdate>,
		deduplicateUnselected?: boolean
	) => void;
	cycleNotePitchBend: (step: number, pitch: number) => void;
	setNotePitchBendAt: (
		step: number,
		pitch: number,
		pitchBend: number,
		bendStyle?: NoteBendStyle
	) => void;
	cycleNoteFadeAt: (step: number, pitch: number) => void;
	clearCurrentPattern: () => void;
	transposeCurrentPattern: (semitones: number) => void;
	generateRiffForCurrentPattern: () => void;

	updateChannelInstrument: (
		channelIndex: number,
		updates: Partial<InstrumentConfiguration>
	) => void;
	applyInstrumentPreset: (channelIndex: number, presetId: string) => void;

	setStudioMode: (mode: StudioMode) => void;
	loadSfxPreset: (presetId: string) => void;
	createNewSfxProject: () => void;
	generateSfxPattern: (archetype?: SfxGeneratorArchetype) => void;

	loadDemoSong: (demoId: string) => void;
	createNewProject: () => void;
	importSongProject: (project: SongProject) => void;
	saveCurrentSongToLibrary: () => void;
	loadSavedSong: (songId: string) => void;
	deleteSavedSong: (songId: string) => void;
	resetEverything: () => void;
}

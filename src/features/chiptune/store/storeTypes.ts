import type {
	ChannelType,
	EditorTool,
	InstrumentConfiguration,
	LoopMode,
	MobileWorkspaceTab,
	NoteEvent,
	SongProject,
} from "../types/music";

export interface PersistedChiptuneState {
	song: SongProject;
	savedSongs: Array<SongProject>;
	scaleLockOnly: boolean;
	showGhostNotes: boolean;
	defaultNoteDuration: number;
}

export interface ChiptuneStoreState {
	song: SongProject;
	savedSongs: Array<SongProject>;
	selectedChannelIndex: number;
	selectedBarIndex: number;
	activeWorkspaceTab: MobileWorkspaceTab;
	activeTool: EditorTool;
	defaultNoteDuration: number;
	scaleLockOnly: boolean;
	showGhostNotes: boolean;
	isPlaying: boolean;
	loopMode: LoopMode;
	playbackBar: number;
	playbackStep: number;

	setActiveWorkspaceTab: (tab: MobileWorkspaceTab) => void;
	setActiveTool: (tool: EditorTool) => void;
	setDefaultNoteDuration: (duration: number) => void;
	toggleScaleLockOnly: () => void;
	toggleShowGhostNotes: () => void;
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
	toggleChannelMute: (channelIndex: number) => void;
	toggleChannelSolo: (channelIndex: number) => void;
	setBarPatternIndex: (
		channelIndex: number,
		barIndex: number,
		patternIndex: number
	) => void;
	clonePatternToBar: (channelIndex: number, barIndex: number) => void;

	addOrReplaceNote: (noteInput: Omit<NoteEvent, "id">) => void;
	removeNoteAt: (step: number, pitch: number) => void;
	resizeNoteAt: (step: number, pitch: number, duration: number) => void;
	cycleNotePitchBend: (step: number, pitch: number) => void;
	clearCurrentPattern: () => void;
	transposeCurrentPattern: (semitones: number) => void;
	generateRiffForCurrentPattern: () => void;

	updateChannelInstrument: (
		channelIndex: number,
		updates: Partial<InstrumentConfiguration>
	) => void;
	applyInstrumentPreset: (channelIndex: number, presetId: string) => void;

	loadDemoSong: (demoId: string) => void;
	createNewProject: () => void;
	importSongProject: (project: SongProject) => void;
	saveCurrentSongToLibrary: () => void;
	loadSavedSong: (songId: string) => void;
	deleteSavedSong: (songId: string) => void;
}

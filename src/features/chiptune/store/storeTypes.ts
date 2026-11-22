import type {
	BarMatrixSelection,
	ChannelType,
	CopiedBarsClipboard,
	EditorTool,
	HistorySnapshot,
	InstrumentConfiguration,
	LoopMode,
	MobileWorkspaceTab,
	ModernInstrumentSettings,
	NoteArticulation,
	NoteBatchMoveUpdate,
	NoteBendStyle,
	NoteEvent,
	SfxGeneratorArchetype,
	SongProject,
	SongSection,
	StudioMode,
} from "../types/music";
import type { ThemeMode } from "../constants/themes";
import type {
	ToolbarItemId,
	ToolbarPreset,
	ToolbarVisibility,
} from "../constants/toolbarItems";
import type { HumanizeOptions, NotePropertyUpdate } from "./songHelpers";

/** User-resized pane sizes in px (null = default responsive size) */
export interface PaneLayout {
	asideWidth: number | null;
	matrixHeight: number | null;
}

export interface PersistedChiptuneState {
	studioMode?: StudioMode;
	song: SongProject;
	musicProjectBackup?: SongProject | null;
	sfxProjectBackup?: SongProject | null;
	modernProjectBackup?: SongProject | null;
	savedSongs: Array<SongProject>;
	scaleLockOnly: boolean;
	showGhostNotes: boolean;
	defaultNoteDuration: number;
	defaultNoteVelocity?: number;
	showVelocityLane?: boolean;
	themeMode?: ThemeMode;
	toolbarVisibility?: ToolbarVisibility;
	paneLayout?: PaneLayout;
	showNoteVelocityLabels?: boolean;
	followPlayhead: boolean;
}

export interface ChiptuneStoreState {
	studioMode: StudioMode;
	song: SongProject;
	musicProjectBackup: SongProject | null;
	sfxProjectBackup: SongProject | null;
	/** Project parked while another mode is open (each mode keeps its own) */
	modernProjectBackup: SongProject | null;
	savedSongs: Array<SongProject>;
	selectedChannelIndex: number;
	selectedBarIndex: number;
	activeWorkspaceTab: MobileWorkspaceTab;
	activeTool: EditorTool;
	defaultNoteDuration: number;
	/** Volume (velocity 0.1–1) given to newly drawn notes */
	defaultNoteVelocity: number;
	/** Whether the per-note volume lane is shown under the piano roll */
	showVelocityLane: boolean;
	/** Ids of notes selected in the piano roll (current pattern) */
	selectedNoteIds: Array<string>;
	/** Studio colour theme (kept across resets) */
	themeMode: ThemeMode;
	/** Which optional toolbar controls are shown (kept across resets) */
	toolbarVisibility: ToolbarVisibility;
	/** Articulation given to newly drawn notes (null = normal) */
	defaultNoteArticulation: NoteArticulation | null;
	/** Resized pane sizes (kept across resets) */
	paneLayout: PaneLayout;
	/** Print each note's volume (%) on the note in the piano roll */
	showNoteVelocityLabels: boolean;
	pianoRollZoom: number;
	scaleLockOnly: boolean;
	showGhostNotes: boolean;
	followPlayhead: boolean;
	isPlaying: boolean;
	loopMode: LoopMode;
	playbackBar: number;
	playbackStep: number;
	past: Array<HistorySnapshot>;
	future: Array<HistorySnapshot>;
	canUndo: boolean;
	canRedo: boolean;
	barSelection: BarMatrixSelection | null;
	copiedBarsClipboard: CopiedBarsClipboard | null;

	undo: () => void;
	redo: () => void;
	setBarSelection: (selection: BarMatrixSelection | null) => void;
	clearBarSelection: () => void;
	selectAllBars: () => void;
	copySelectedBars: () => void;
	pasteBarsAt: (targetBarIndex: number, targetChannelIndex?: number) => void;
	moveSelectedBarsTo: (
		targetBarIndex: number,
		targetChannelIndex?: number
	) => void;
	duplicateSelectedBarsTo: (
		targetBarIndex: number,
		targetChannelIndex?: number
	) => void;
	shiftSelectedBars: (deltaBars: number) => void;
	clearSelectedBarsContent: () => void;

	setActiveWorkspaceTab: (tab: MobileWorkspaceTab) => void;
	setActiveTool: (tool: EditorTool) => void;
	setDefaultNoteDuration: (duration: number) => void;
	setDefaultNoteVelocity: (velocity: number) => void;
	toggleVelocityLane: () => void;
	setSelectedNoteIds: (noteIds: Array<string>) => void;
	setThemeMode: (themeMode: ThemeMode) => void;
	setToolbarItemVisible: (itemId: ToolbarItemId, visible: boolean) => void;
	applyToolbarPreset: (preset: ToolbarPreset) => void;
	setDefaultNoteArticulation: (articulation: NoteArticulation | null) => void;
	setPaneLayout: (updates: Partial<PaneLayout>) => void;
	toggleNoteVelocityLabels: () => void;
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
	setSongSections: (sections: Array<Partial<SongSection>>) => void;
	/** Save the current loop range as a new named section */
	addSectionFromLoop: (name?: string) => void;
	renameSection: (sectionId: string, name: string) => void;
	removeSection: (sectionId: string) => void;
	/** Set the loop range to a section's bars */
	loopSection: (sectionId: string) => void;
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
	cycleNoteRatchetAt: (step: number, pitch: number) => void;
	/** Set velocity / timing offset of notes (by id) in the selected pattern */
	updateNoteProperties: (
		updates: Array<NotePropertyUpdate>,
		historyGroupKey?: string
	) => void;
	/** Humanize the selected notes (or the whole pattern when none selected) */
	humanizeCurrentPattern: (options?: HumanizeOptions) => void;
	/** Snap the selected notes (or whole pattern) back onto the grid */
	quantizeCurrentPattern: () => void;
	clearCurrentPattern: () => void;
	transposeCurrentPattern: (semitones: number) => void;
	generateRiffForCurrentPattern: () => void;

	updateChannelInstrument: (
		channelIndex: number,
		updates: Partial<InstrumentConfiguration>
	) => void;
	applyInstrumentPreset: (channelIndex: number, presetId: string) => void;
	/** Merge modern engine / FX settings on a modern channel */
	updateModernSettings: (
		channelIndex: number,
		updates: Partial<ModernInstrumentSettings>
	) => void;

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

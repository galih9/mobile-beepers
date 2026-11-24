/**
 * Optional toolbar controls. Each can be shown or hidden from Settings so the
 * studio starts uncluttered for new users and power users can turn everything
 * back on. Play, the LCD, File / Export and Settings are always visible.
 */
export type ToolbarItemId =
	// Top bar
	| "brand"
	| "studioMode"
	| "history"
	| "metronome"
	| "loopMode"
	| "follow"
	| "masterVolume"
	| "demos"
	| "addBars"
	| "reset"
	// Piano roll toolbar
	| "pianoHistory"
	| "effectTools"
	| "noteLength"
	| "noteFeel"
	| "articulation"
	| "transpose"
	| "zoom"
	| "humToNotes"
	| "riff"
	| "clearPattern";

export type ToolbarGroup = "top" | "piano";

export interface ToolbarItemDefinition {
	id: ToolbarItemId;
	group: ToolbarGroup;
	label: string;
	description: string;
	/** Shown in the "Essentials" layout new users start with */
	essential: boolean;
}

export const TOOLBAR_ITEMS: Array<ToolbarItemDefinition> = [
	{
		id: "brand",
		group: "top",
		label: "UltraBeep logo",
		description: "Logo plate on the far left (wide screens only)",
		essential: true,
	},
	{
		id: "studioMode",
		group: "top",
		label: "Mode badge",
		description:
			"Shows the app mode (Modern / Chiptune / SFX); click it to change mode in Settings",
		essential: true,
	},
	{
		id: "history",
		group: "top",
		label: "Undo / Redo",
		description: "Ctrl+Z and Ctrl+Y work even when hidden",
		essential: true,
	},
	{
		id: "metronome",
		group: "top",
		label: "Metronome & BPM",
		description: "Click track toggle and tap-tempo BPM tool",
		essential: true,
	},
	{
		id: "loopMode",
		group: "top",
		label: "Loop mode",
		description: "Loop the song, loop one bar, or play once",
		essential: true,
	},
	{
		id: "follow",
		group: "top",
		label: "Follow playhead",
		description: "Toggle that keeps the view on the playing bar",
		essential: false,
	},
	{
		id: "masterVolume",
		group: "top",
		label: "Master volume",
		description: "Overall volume slider",
		essential: true,
	},
	{
		id: "demos",
		group: "top",
		label: "Demo / SFX library",
		description: "Browse the demo songs or SFX presets",
		essential: true,
	},
	{
		id: "addBars",
		group: "top",
		label: "Add bars",
		description: "Extend the song by 4 bars (1 bar in SFX mode)",
		essential: false,
	},
	{
		id: "reset",
		group: "top",
		label: "Reset",
		description: "Also available inside File / Export",
		essential: false,
	},
	{
		id: "pianoHistory",
		group: "piano",
		label: "Undo / Redo (piano roll)",
		description: "Second copy of undo / redo next to the note tools",
		essential: false,
	},
	{
		id: "effectTools",
		group: "piano",
		label: "Bend / Fade / Stutter tools",
		description: "Note effect tools (Select, Draw, Move, Erase always show)",
		essential: false,
	},
	{
		id: "noteLength",
		group: "piano",
		label: "Note length",
		description: "1/16 · 1/8 · 1/4 · 1/2 for newly drawn notes",
		essential: true,
	},
	{
		id: "noteFeel",
		group: "piano",
		label: "Note volume & feel",
		description: "Volume lane, volume %, Humanize and Snap",
		essential: false,
	},
	{
		id: "articulation",
		group: "piano",
		label: "Articulation & ornaments",
		description: "Staccato, accent, legato… plus grace, mordent and trill",
		essential: false,
	},
	{
		id: "transpose",
		group: "piano",
		label: "Transpose",
		description: "Shift the pattern by semitones or octaves",
		essential: false,
	},
	{
		id: "zoom",
		group: "piano",
		label: "Zoom",
		description: "Horizontal zoom of the piano roll",
		essential: true,
	},
	{
		id: "humToNotes",
		group: "piano",
		label: "Hum to notes",
		description:
			"Record humming or singing with pitch detection into piano roll notes",
		essential: true,
	},
	{
		id: "riff",
		group: "piano",
		label: "Riff generator",
		description: "Auto-generate an in-key riff",
		essential: true,
	},
	{
		id: "clearPattern",
		group: "piano",
		label: "Clear pattern",
		description: "Delete every note in this pattern",
		essential: true,
	},
];

export type ToolbarVisibility = Record<ToolbarItemId, boolean>;

export type ToolbarPreset = "essentials" | "everything";

export const buildToolbarPreset = (preset: ToolbarPreset): ToolbarVisibility =>
	Object.fromEntries(
		TOOLBAR_ITEMS.map((item) => [
			item.id,
			preset === "everything" ? true : item.essential,
		])
	) as ToolbarVisibility;

export const DEFAULT_TOOLBAR_VISIBILITY: ToolbarVisibility =
	buildToolbarPreset("essentials");

/** Fills in missing / invalid entries (older saves, new items) with defaults. */
export const normalizeToolbarVisibility = (
	value: unknown
): ToolbarVisibility => {
	const source =
		value && typeof value === "object"
			? (value as Record<string, unknown>)
			: {};
	return Object.fromEntries(
		TOOLBAR_ITEMS.map((item) => [
			item.id,
			typeof source[item.id] === "boolean"
				? (source[item.id] as boolean)
				: DEFAULT_TOOLBAR_VISIBILITY[item.id],
		])
	) as ToolbarVisibility;
};

export const isToolbarItemId = (value: unknown): value is ToolbarItemId =>
	TOOLBAR_ITEMS.some((item) => item.id === value);

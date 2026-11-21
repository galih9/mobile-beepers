/**
 * Studio themes. The CSS side lives in src/styles/tailwind.css under
 * `[data-theme="…"]` (it re-tints Tailwind's colour ramps and sets the
 * hardware tokens). Canvas / SVG drawing can't read Tailwind classes, so
 * the colours they need are mirrored here.
 */
export type ThemeMode = "neon" | "dark" | "light";

export interface ThemeOption {
	id: ThemeMode;
	name: string;
	description: string;
	/** Browser UI colour (address bar on mobile) */
	browserColor: string;
	colorScheme: "dark" | "light";
}

export const THEME_OPTIONS: Array<ThemeOption> = [
	{
		id: "neon",
		name: "Neon",
		description: "Deep navy with a cyan LCD",
		browserColor: "#04070d",
		colorScheme: "dark",
	},
	{
		id: "dark",
		name: "Dark",
		description: "Graphite with an amber LCD",
		browserColor: "#121110",
		colorScheme: "dark",
	},
	{
		id: "light",
		name: "Light",
		description: "Grey console plastic with a pea-green screen",
		browserColor: "#cdcac3",
		colorScheme: "light",
	},
];

export const DEFAULT_THEME_MODE: ThemeMode = "neon";

export const isThemeMode = (value: unknown): value is ThemeMode =>
	value === "neon" || value === "dark" || value === "light";

export interface CanvasPalette {
	/** Alternating beat column backgrounds in the piano roll */
	beatEven: string;
	beatOdd: string;
	rootRow: string;
	rootRowLine: string;
	outOfScaleRow: string;
	rowLine: string;
	stepLine: string;
	beatLine: string;
	playheadFill: string;
	playhead: string;
	/** Outline drawn around notes (helps pale channel colours on light themes) */
	noteOutline: string | undefined;
	selectedNoteOutline: string;
	selectedNoteHalo: string;
	selectionFill: string;
	selectionStroke: string;
	bendLabel: string;
	ratchetLabel: string;
	fadeLabel: string;
	/** Note volume number printed on notes */
	velocityLabel: string;
	/** Volume lane */
	laneBackground: string;
	laneGuide: string;
	laneBeatLine: string;
	laneSelected: string;
	laneStemOutline: string;
	/** Oscilloscope */
	scopeBackground: string;
	scopeGrid: string;
	/** Scope trace colour; undefined = use the channel colour */
	scopeTrace: string | undefined;
	/** Song matrix cells */
	matrixCellEmpty: string;
	matrixCellFilled: string;
	matrixCellSelected: string;
	matrixCellPlaying: string;
	matrixMarkerFill: string;
	matrixMarkerStroke: string;
	/** Mix channel colours toward this ink for cell numbers (keeps pale colours readable) */
	matrixInk: string | undefined;
}

export const CANVAS_PALETTES: Record<ThemeMode, CanvasPalette> = {
	neon: {
		beatEven: "#06080e",
		beatOdd: "#0d111a",
		rootRow: "rgba(138, 96, 56, 0.55)",
		rootRowLine: "rgba(186, 134, 82, 0.55)",
		outOfScaleRow: "rgba(2, 4, 8, 0.52)",
		rowLine: "rgba(51, 65, 85, 0.36)",
		stepLine: "rgba(51, 65, 85, 0.25)",
		beatLine: "rgba(148, 163, 184, 0.35)",
		playheadFill: "rgba(255, 255, 255, 0.08)",
		playhead: "#ffffff",
		noteOutline: undefined,
		selectedNoteOutline: "#ffffff",
		selectedNoteHalo: "#c4b5fd",
		selectionFill: "rgba(167, 139, 250, 0.2)",
		selectionStroke: "#c4b5fd",
		bendLabel: "#fef08a",
		ratchetLabel: "#f0abfc",
		fadeLabel: "#e0f2fe",
		velocityLabel: "rgba(2, 6, 23, 0.82)",
		laneBackground: "#05070c",
		laneGuide: "rgba(51, 65, 85, 0.35)",
		laneBeatLine: "rgba(148, 163, 184, 0.22)",
		laneSelected: "#ffffff",
		laneStemOutline: "#020617",
		scopeBackground: "#060913",
		scopeGrid: "rgba(148, 163, 184, 0.2)",
		scopeTrace: undefined,
		matrixCellEmpty: "#000000",
		matrixCellFilled: "#3d3d3d",
		matrixCellSelected: "#1e293b",
		matrixCellPlaying: "#22d3ee",
		matrixMarkerFill: "#ffffff",
		matrixMarkerStroke: "#000000",
		matrixInk: undefined,
	},
	dark: {
		beatEven: "#0f0e0d",
		beatOdd: "#161513",
		rootRow: "rgba(251, 146, 60, 0.22)",
		rootRowLine: "rgba(251, 146, 60, 0.45)",
		outOfScaleRow: "rgba(0, 0, 0, 0.45)",
		rowLine: "rgba(87, 83, 78, 0.38)",
		stepLine: "rgba(87, 83, 78, 0.26)",
		beatLine: "rgba(168, 162, 158, 0.34)",
		playheadFill: "rgba(255, 196, 120, 0.08)",
		playhead: "#ffd7a3",
		noteOutline: undefined,
		selectedNoteOutline: "#fff7ed",
		selectedNoteHalo: "#fdba74",
		selectionFill: "rgba(251, 146, 60, 0.16)",
		selectionStroke: "#fdba74",
		bendLabel: "#fde68a",
		ratchetLabel: "#f5d0fe",
		fadeLabel: "#e7e5e4",
		velocityLabel: "rgba(12, 10, 9, 0.82)",
		laneBackground: "#0c0b0a",
		laneGuide: "rgba(87, 83, 78, 0.38)",
		laneBeatLine: "rgba(168, 162, 158, 0.22)",
		laneSelected: "#fff7ed",
		laneStemOutline: "#0c0a09",
		scopeBackground: "#0b0907",
		scopeGrid: "rgba(168, 162, 158, 0.18)",
		scopeTrace: undefined,
		matrixCellEmpty: "#0a0908",
		matrixCellFilled: "#3a3632",
		matrixCellSelected: "#2a2724",
		matrixCellPlaying: "#fb923c",
		matrixMarkerFill: "#fff7ed",
		matrixMarkerStroke: "#0a0908",
		matrixInk: undefined,
	},
	light: {
		beatEven: "#e9e6df",
		beatOdd: "#dfdcd4",
		rootRow: "rgba(142, 42, 94, 0.13)",
		rootRowLine: "rgba(142, 42, 94, 0.38)",
		outOfScaleRow: "rgba(120, 113, 104, 0.16)",
		rowLine: "rgba(120, 113, 104, 0.24)",
		stepLine: "rgba(120, 113, 104, 0.16)",
		beatLine: "rgba(80, 74, 66, 0.32)",
		playheadFill: "rgba(142, 42, 94, 0.08)",
		playhead: "#8e2a5e",
		noteOutline: "rgba(31, 28, 25, 0.55)",
		selectedNoteOutline: "#1f1c19",
		selectedNoteHalo: "#8e2a5e",
		selectionFill: "rgba(142, 42, 94, 0.12)",
		selectionStroke: "#8e2a5e",
		bendLabel: "#5b3a00",
		ratchetLabel: "#6b1f63",
		fadeLabel: "#1f3a5c",
		velocityLabel: "rgba(31, 28, 25, 0.88)",
		laneBackground: "#e3e0d9",
		laneGuide: "rgba(120, 113, 104, 0.3)",
		laneBeatLine: "rgba(80, 74, 66, 0.26)",
		laneSelected: "#1f1c19",
		laneStemOutline: "rgba(31, 28, 25, 0.6)",
		scopeBackground: "#9bbc0f",
		scopeGrid: "rgba(15, 56, 15, 0.22)",
		scopeTrace: "#0f380f",
		matrixCellEmpty: "#d4d1c9",
		matrixCellFilled: "#a9a49a",
		matrixCellSelected: "#bfbab0",
		matrixCellPlaying: "#8e2a5e",
		matrixMarkerFill: "#1f1c19",
		matrixMarkerStroke: "#e9e6df",
		matrixInk: "#1f1c19",
	},
};

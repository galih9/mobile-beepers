/**
 * Studio themes. The CSS side lives in src/styles/tailwind.css under
 * `[data-theme="…"]` (it re-tints Tailwind's colour ramps and sets the
 * hardware tokens). Canvas / SVG drawing can't read Tailwind classes, so
 * the colours they need are mirrored here.
 */
export type ThemeMode =
	| "neon"
	| "dark"
	| "light"
	| "synthwave"
	| "phosphor"
	| "crimson"
	| "frost"
	| "famicom";

export interface ThemeOption {
	id: ThemeMode;
	name: string;
	description: string;
	/** Browser UI colour (address bar on mobile) */
	browserColor: string;
	colorScheme: "dark" | "light";
	/** Colours for the little preview card in Settings */
	swatch: {
		chassis: string;
		module: string;
		lcd: string;
		ink: string;
		accent: string;
	};
}

export const THEME_OPTIONS: Array<ThemeOption> = [
	{
		id: "neon",
		name: "Neon",
		description: "Deep navy with a cyan LCD",
		browserColor: "#04070d",
		colorScheme: "dark",
		swatch: {
			chassis: "#010306",
			module: "#0f172a",
			lcd: "#031417",
			ink: "#7df3ff",
			accent: "#00c7ff",
		},
	},
	{
		id: "dark",
		name: "Dark",
		description: "Graphite with an amber LCD",
		browserColor: "#121110",
		colorScheme: "dark",
		swatch: {
			chassis: "#080707",
			module: "#1b1a18",
			lcd: "#140d04",
			ink: "#ffb547",
			accent: "#fb923c",
		},
	},
	{
		id: "light",
		name: "Light",
		description: "Grey console plastic with a pea-green screen",
		browserColor: "#cdcac3",
		colorScheme: "light",
		swatch: {
			chassis: "#bab6ad",
			module: "#e6e3dc",
			lcd: "#9bbc0f",
			ink: "#0f380f",
			accent: "#8e2a5e",
		},
	},
	{
		id: "synthwave",
		name: "Synthwave",
		description: "Midnight purple with a hot-pink LCD",
		browserColor: "#0f0618",
		colorScheme: "dark",
		swatch: {
			chassis: "#07020d",
			module: "#1a0e29",
			lcd: "#1c0626",
			ink: "#ff5ed8",
			accent: "#ff4fd8",
		},
	},
	{
		id: "phosphor",
		name: "Phosphor",
		description: "Black terminal with green CRT glow",
		browserColor: "#020703",
		colorScheme: "dark",
		swatch: {
			chassis: "#000301",
			module: "#0a160d",
			lcd: "#021006",
			ink: "#39ff7a",
			accent: "#22e06a",
		},
	},
	{
		id: "crimson",
		name: "Crimson",
		description: "Virtual-console black with a red LED screen",
		browserColor: "#0b0505",
		colorScheme: "dark",
		swatch: {
			chassis: "#040101",
			module: "#1a0d0d",
			lcd: "#120000",
			ink: "#ff3030",
			accent: "#ef3b3b",
		},
	},
	{
		id: "frost",
		name: "Frost",
		description: "Icy white plastic with a blue LCD",
		browserColor: "#dfe8ef",
		colorScheme: "light",
		swatch: {
			chassis: "#c3d0db",
			module: "#f1f5f9",
			lcd: "#bcdcf0",
			ink: "#0b3a5c",
			accent: "#1f6fb2",
		},
	},
	{
		id: "famicom",
		name: "Famicom",
		description: "Cream console with maroon trim and a gold LCD",
		browserColor: "#e9e1cf",
		colorScheme: "light",
		swatch: {
			chassis: "#d3c6aa",
			module: "#f4eee0",
			lcd: "#3a0d0d",
			ink: "#ffd27a",
			accent: "#9b1c22",
		},
	},
];

export const DEFAULT_THEME_MODE: ThemeMode = "neon";

export const isThemeMode = (value: unknown): value is ThemeMode =>
	THEME_OPTIONS.some((option) => option.id === value);

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
	/** Articulation / ornament marks printed on notes */
	articulationLabel: string;
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
		articulationLabel: "#ffffff",
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
		articulationLabel: "#fff7ed",
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
		articulationLabel: "#1f1c19",
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
	synthwave: {
		beatEven: "#0b0512",
		beatOdd: "#130a1e",
		rootRow: "rgba(255, 79, 216, 0.18)",
		rootRowLine: "rgba(255, 79, 216, 0.45)",
		outOfScaleRow: "rgba(4, 0, 10, 0.5)",
		rowLine: "rgba(88, 60, 120, 0.38)",
		stepLine: "rgba(88, 60, 120, 0.26)",
		beatLine: "rgba(190, 160, 230, 0.34)",
		playheadFill: "rgba(94, 240, 255, 0.08)",
		playhead: "#5ef0ff",
		noteOutline: undefined,
		selectedNoteOutline: "#ffffff",
		selectedNoteHalo: "#5ef0ff",
		selectionFill: "rgba(94, 240, 255, 0.14)",
		selectionStroke: "#5ef0ff",
		bendLabel: "#fff3a0",
		ratchetLabel: "#a5f3fc",
		fadeLabel: "#f5e1ff",
		articulationLabel: "#ffffff",
		velocityLabel: "rgba(10, 3, 18, 0.85)",
		laneBackground: "#09040f",
		laneGuide: "rgba(88, 60, 120, 0.38)",
		laneBeatLine: "rgba(190, 160, 230, 0.2)",
		laneSelected: "#ffffff",
		laneStemOutline: "#07020d",
		scopeBackground: "#0d0516",
		scopeGrid: "rgba(190, 160, 230, 0.18)",
		scopeTrace: undefined,
		matrixCellEmpty: "#05010a",
		matrixCellFilled: "#33244a",
		matrixCellSelected: "#2a1a40",
		matrixCellPlaying: "#ff4fd8",
		matrixMarkerFill: "#ffffff",
		matrixMarkerStroke: "#05010a",
		matrixInk: undefined,
	},
	phosphor: {
		beatEven: "#020703",
		beatOdd: "#061109",
		rootRow: "rgba(57, 255, 122, 0.16)",
		rootRowLine: "rgba(57, 255, 122, 0.42)",
		outOfScaleRow: "rgba(0, 0, 0, 0.5)",
		rowLine: "rgba(40, 90, 55, 0.4)",
		stepLine: "rgba(40, 90, 55, 0.26)",
		beatLine: "rgba(120, 220, 150, 0.32)",
		playheadFill: "rgba(57, 255, 122, 0.08)",
		playhead: "#b8ffcc",
		noteOutline: undefined,
		selectedNoteOutline: "#eafff0",
		selectedNoteHalo: "#39ff7a",
		selectionFill: "rgba(57, 255, 122, 0.12)",
		selectionStroke: "#39ff7a",
		bendLabel: "#f4ff9c",
		ratchetLabel: "#c8ffdb",
		fadeLabel: "#d9ffe6",
		articulationLabel: "#eafff0",
		velocityLabel: "rgba(0, 8, 2, 0.85)",
		laneBackground: "#010502",
		laneGuide: "rgba(40, 90, 55, 0.4)",
		laneBeatLine: "rgba(120, 220, 150, 0.2)",
		laneSelected: "#eafff0",
		laneStemOutline: "#000301",
		scopeBackground: "#010803",
		scopeGrid: "rgba(57, 255, 122, 0.14)",
		scopeTrace: "#39ff7a",
		matrixCellEmpty: "#000301",
		matrixCellFilled: "#1d3324",
		matrixCellSelected: "#143020",
		matrixCellPlaying: "#39ff7a",
		matrixMarkerFill: "#eafff0",
		matrixMarkerStroke: "#000301",
		matrixInk: undefined,
	},
	crimson: {
		beatEven: "#080303",
		beatOdd: "#110707",
		rootRow: "rgba(255, 48, 48, 0.16)",
		rootRowLine: "rgba(255, 48, 48, 0.45)",
		outOfScaleRow: "rgba(0, 0, 0, 0.5)",
		rowLine: "rgba(100, 45, 45, 0.4)",
		stepLine: "rgba(100, 45, 45, 0.26)",
		beatLine: "rgba(220, 140, 140, 0.32)",
		playheadFill: "rgba(255, 80, 80, 0.08)",
		playhead: "#ffb3a8",
		noteOutline: undefined,
		selectedNoteOutline: "#fff1ee",
		selectedNoteHalo: "#ff6a5a",
		selectionFill: "rgba(255, 80, 80, 0.13)",
		selectionStroke: "#ff6a5a",
		bendLabel: "#ffe08a",
		ratchetLabel: "#ffc4d6",
		fadeLabel: "#ffe4de",
		articulationLabel: "#fff1ee",
		velocityLabel: "rgba(12, 2, 2, 0.85)",
		laneBackground: "#060202",
		laneGuide: "rgba(100, 45, 45, 0.4)",
		laneBeatLine: "rgba(220, 140, 140, 0.2)",
		laneSelected: "#fff1ee",
		laneStemOutline: "#040101",
		scopeBackground: "#0a0000",
		scopeGrid: "rgba(255, 48, 48, 0.15)",
		scopeTrace: "#ff3030",
		matrixCellEmpty: "#040101",
		matrixCellFilled: "#3a2222",
		matrixCellSelected: "#2c1616",
		matrixCellPlaying: "#ff3030",
		matrixMarkerFill: "#fff1ee",
		matrixMarkerStroke: "#040101",
		matrixInk: undefined,
	},
	frost: {
		beatEven: "#eef3f7",
		beatOdd: "#e3eaf0",
		rootRow: "rgba(31, 111, 178, 0.12)",
		rootRowLine: "rgba(31, 111, 178, 0.38)",
		outOfScaleRow: "rgba(100, 120, 140, 0.14)",
		rowLine: "rgba(100, 120, 140, 0.22)",
		stepLine: "rgba(100, 120, 140, 0.15)",
		beatLine: "rgba(60, 80, 100, 0.3)",
		playheadFill: "rgba(31, 111, 178, 0.08)",
		playhead: "#1f6fb2",
		noteOutline: "rgba(15, 30, 45, 0.5)",
		selectedNoteOutline: "#0f1e2d",
		selectedNoteHalo: "#1f6fb2",
		selectionFill: "rgba(31, 111, 178, 0.12)",
		selectionStroke: "#1f6fb2",
		bendLabel: "#5b3a00",
		ratchetLabel: "#5a1f6b",
		fadeLabel: "#0b3a5c",
		articulationLabel: "#0f1e2d",
		velocityLabel: "rgba(15, 30, 45, 0.88)",
		laneBackground: "#e6edf3",
		laneGuide: "rgba(100, 120, 140, 0.28)",
		laneBeatLine: "rgba(60, 80, 100, 0.24)",
		laneSelected: "#0f1e2d",
		laneStemOutline: "rgba(15, 30, 45, 0.6)",
		scopeBackground: "#bcdcf0",
		scopeGrid: "rgba(11, 58, 92, 0.2)",
		scopeTrace: "#0b3a5c",
		matrixCellEmpty: "#d5dfe8",
		matrixCellFilled: "#a3b4c4",
		matrixCellSelected: "#bccad7",
		matrixCellPlaying: "#1f6fb2",
		matrixMarkerFill: "#0f1e2d",
		matrixMarkerStroke: "#eef3f7",
		matrixInk: "#0f1e2d",
	},
	famicom: {
		beatEven: "#f2ecdd",
		beatOdd: "#e8e0cd",
		rootRow: "rgba(155, 28, 34, 0.12)",
		rootRowLine: "rgba(155, 28, 34, 0.38)",
		outOfScaleRow: "rgba(130, 110, 80, 0.15)",
		rowLine: "rgba(130, 110, 80, 0.24)",
		stepLine: "rgba(130, 110, 80, 0.16)",
		beatLine: "rgba(90, 70, 45, 0.32)",
		playheadFill: "rgba(155, 28, 34, 0.08)",
		playhead: "#9b1c22",
		noteOutline: "rgba(40, 20, 10, 0.55)",
		selectedNoteOutline: "#2a160c",
		selectedNoteHalo: "#9b1c22",
		selectionFill: "rgba(155, 28, 34, 0.12)",
		selectionStroke: "#9b1c22",
		bendLabel: "#5b3a00",
		ratchetLabel: "#6b1f63",
		fadeLabel: "#3a2410",
		articulationLabel: "#2a160c",
		velocityLabel: "rgba(40, 20, 10, 0.88)",
		laneBackground: "#ece4d3",
		laneGuide: "rgba(130, 110, 80, 0.3)",
		laneBeatLine: "rgba(90, 70, 45, 0.26)",
		laneSelected: "#2a160c",
		laneStemOutline: "rgba(40, 20, 10, 0.6)",
		scopeBackground: "#3a0d0d",
		scopeGrid: "rgba(255, 210, 122, 0.16)",
		scopeTrace: "#ffd27a",
		matrixCellEmpty: "#e0d6c0",
		matrixCellFilled: "#b8a88a",
		matrixCellSelected: "#cbbd9f",
		matrixCellPlaying: "#9b1c22",
		matrixMarkerFill: "#2a160c",
		matrixMarkerStroke: "#f2ecdd",
		matrixInk: "#2a160c",
	},
};

import type { BarMatrixSelection } from "../types/music";

export const DND_ITEM_TYPES = {
	CHANNEL_ROW: "CHANNEL_ROW",
	MATRIX_PATTERN_CELL: "MATRIX_PATTERN_CELL",
	INSTRUMENT_PRESET: "INSTRUMENT_PRESET",
	MATRIX_BAR_RANGE: "MATRIX_BAR_RANGE",
} as const;

export interface ChannelRowDragItem {
	type: typeof DND_ITEM_TYPES.CHANNEL_ROW;
	channelIndex: number;
	channelId: string;
}

export interface MatrixPatternCellDragItem {
	type: typeof DND_ITEM_TYPES.MATRIX_PATTERN_CELL;
	channelIndex: number;
	barIndex: number;
	patternNumber: number;
}

export interface MatrixBarRangeDragItem {
	type: typeof DND_ITEM_TYPES.MATRIX_BAR_RANGE;
	selection: BarMatrixSelection;
}

export interface InstrumentPresetDragItem {
	type: typeof DND_ITEM_TYPES.INSTRUMENT_PRESET;
	presetId: string;
	presetName: string;
}

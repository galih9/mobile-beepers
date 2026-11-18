export const DND_ITEM_TYPES = {
	CHANNEL_ROW: "CHANNEL_ROW",
	MATRIX_PATTERN_CELL: "MATRIX_PATTERN_CELL",
	INSTRUMENT_PRESET: "INSTRUMENT_PRESET",
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

export interface InstrumentPresetDragItem {
	type: typeof DND_ITEM_TYPES.INSTRUMENT_PRESET;
	presetId: string;
	presetName: string;
}

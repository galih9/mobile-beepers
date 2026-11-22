import type {
	Channel,
	ChannelType,
	InstrumentConfiguration,
	NoteEvent,
	SongProject,
} from "../types/music";
import {
	MODERN_DEFAULT_PRESET_IDS,
	getModernPresetById,
} from "./modernPresets";
import { CHANNEL_COLOR_PALETTE } from "./patternGenerator";

/** Deep copy of a modern preset's configuration (the nested `modern` block too). */
export const cloneModernPresetConfiguration = (
	presetId: string
): InstrumentConfiguration | null => {
	const preset = getModernPresetById(presetId);
	return preset ? structuredClone(preset.configuration) : null;
};

let noteCounter = 0;
const note = (
	step: number,
	pitch: number,
	duration: number,
	velocity = 0.85
): NoteEvent => {
	noteCounter += 1;
	return {
		id: `modern-note-${Date.now()}-${noteCounter}`,
		step,
		pitch,
		duration,
		velocity,
		pitchBend: 0,
	};
};

const modernChannel = (
	id: string,
	name: string,
	type: ChannelType,
	colorIndex: number,
	presetId: string,
	totalBars: number,
	notes: Array<NoteEvent>,
	activeBars = 1
): Channel => ({
	id,
	name,
	type,
	color:
		CHANNEL_COLOR_PALETTE[colorIndex % CHANNEL_COLOR_PALETTE.length] ??
		"#a78bfa",
	muted: false,
	solo: false,
	instrument:
		cloneModernPresetConfiguration(presetId) ??
		(cloneModernPresetConfiguration(
			MODERN_DEFAULT_PRESET_IDS[type]
		) as InstrumentConfiguration),
	barSequence: Array.from({ length: totalBars }, (_, index) =>
		index < activeBars ? 1 : 0
	),
	patterns: { "1": { index: 1, notes } },
});

/** New channel for the modern mode (grand piano / jungle break kit). */
export const createModernChannel = (
	channelType: ChannelType,
	existingCount: number,
	totalBars: number
): Channel =>
	modernChannel(
		`channel-${Date.now()}-${existingCount}`,
		channelType === "drum"
			? `Drums ${existingCount + 1}`
			: `Instrument ${existingCount + 1}`,
		channelType,
		existingCount,
		MODERN_DEFAULT_PRESET_IDS[channelType],
		totalBars,
		[]
	);

/** Starter project for the modern mode: piano, pad, reese and a break. */
export const createBlankModernProject = (
	title = "New Modern Track"
): SongProject => {
	const totalBars = 16;
	return {
		id: `song-${Date.now()}`,
		title,
		author: "Offline Composer",
		engine: "modern",
		bpm: 172,
		beatsPerBar: 4,
		stepsPerBeat: 4,
		totalBars,
		loopStartBar: 0,
		loopEndBar: 3,
		swing: 0,
		rootKey: "D",
		scale: "minor",
		masterVolume: 0.8,
		updatedAt: Date.now(),
		channels: [
			modernChannel(
				"channel-1",
				"Piano",
				"pitch",
				0,
				"modern-dream-piano",
				totalBars,
				[
					note(0, 77, 3, 0.9),
					note(3, 74, 3, 0.8),
					note(6, 77, 2, 0.82),
					note(8, 81, 6, 0.92),
				],
				4
			),
			modernChannel(
				"channel-2",
				"Pad",
				"pitch",
				1,
				"modern-dream-pad",
				totalBars,
				[note(0, 57, 16, 0.6), note(0, 62, 16, 0.6), note(0, 65, 16, 0.6)],
				4
			),
			modernChannel(
				"channel-3",
				"Reese",
				"pitch",
				2,
				"modern-reese-bass",
				totalBars,
				[note(0, 50, 6, 0.9), note(6, 50, 2, 0.75), note(8, 50, 8, 0.85)],
				4
			),
			modernChannel(
				"channel-4",
				"Breaks",
				"drum",
				3,
				"modern-break-kit",
				totalBars,
				[
					note(0, 0, 1, 1),
					note(2, 0, 1, 0.85),
					note(4, 1, 1, 0.95),
					note(7, 1, 1, 0.45),
					note(9, 1, 1, 0.5),
					note(10, 0, 1, 0.9),
					note(12, 1, 1, 0.95),
					note(15, 1, 1, 0.45),
					...[0, 2, 4, 6, 8, 10, 12, 14].map((step) =>
						note(step, 2, 1, step % 4 === 0 ? 0.42 : 0.32)
					),
				],
				4
			),
		],
	};
};

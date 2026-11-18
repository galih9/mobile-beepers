import type {
	ChannelType,
	MusicalKey,
	NoteEvent,
	ScaleType,
	SongProject,
} from "../types/music";
import { getPresetConfigurationById } from "./instrumentPresets";
import { getScaleMidiNotesInRange } from "./scalesAndNotes";

export const CHANNEL_COLOR_PALETTE: Array<string> = [
	"#00c7ff", // UltraBox Cyan
	"#ffd93d", // UltraBox Gold
	"#ff9233", // UltraBox Orange
	"#b366ff", // UltraBox Violet
	"#34d399", // Emerald
	"#fb7185", // Rose
	"#38bdf8", // Sky
	"#f472b6", // Pink
];

export const createSongNote = (
	step: number,
	pitch: number,
	duration = 1,
	pitchBend = 0,
	velocity = 0.88
): NoteEvent => ({
	id: `note-${step}-${pitch}-${Math.random().toString(36).slice(2, 7)}`,
	step,
	pitch,
	duration,
	velocity,
	pitchBend,
});

export const generateProceduralPatternNotes = (
	channelType: ChannelType,
	rootKey: MusicalKey,
	scale: ScaleType,
	stepsPerBar: number
): Array<NoteEvent> => {
	if (channelType === "drum") {
		const notes: Array<NoteEvent> = [];
		for (let step = 0; step < stepsPerBar; step += 1) {
			if (step % 4 === 0) {
				notes.push(createSongNote(step, 0, 1, 0, 0.95));
			}
			if (step % 8 === 4) {
				notes.push(createSongNote(step, 1, 1, 0, 0.9));
			}
			if (step % 2 === 0 || (step % 4 === 3 && Math.random() > 0.55)) {
				notes.push(createSongNote(step, 2, 1, 0, 0.65));
			}
			if (step === stepsPerBar - 2 && Math.random() > 0.4) {
				notes.push(createSongNote(step, 5, 1, 0, 0.8));
			}
		}
		return notes;
	}

	const scaleNotes = getScaleMidiNotesInRange(rootKey, scale, 48, 76);
	if (scaleNotes.length === 0) {
		return [];
	}
	const generatedNotes: Array<NoteEvent> = [];
	let currentScaleIndex = Math.floor(scaleNotes.length / 2);

	for (let step = 0; step < stepsPerBar; step += 2) {
		if (step === 0 || Math.random() > 0.28) {
			const movement = Math.floor(Math.random() * 5) - 2;
			currentScaleIndex = Math.max(
				0,
				Math.min(scaleNotes.length - 1, currentScaleIndex + movement)
			);
			const pitch = scaleNotes[currentScaleIndex] ?? 60;
			const maxDuration = Math.min(4, stepsPerBar - step);
			const duration = Math.random() > 0.65 && maxDuration >= 2 ? 2 : 1;
			const pitchBend = Math.random() > 0.86 ? 2 : 0;
			generatedNotes.push(
				createSongNote(step, pitch, duration, pitchBend, 0.85)
			);
		}
	}
	return generatedNotes;
};

export const createBlankSongProject = (
	title = "Untitled Chiptune"
): SongProject => {
	const leadPreset = getPresetConfigurationById("nes-pulse-25");
	const arpPreset = getPresetConfigurationById("nes-pulse-12");
	const bassPreset = getPresetConfigurationById("nes-triangle-bass");
	const drumPreset = getPresetConfigurationById("retro-8bit-kit");

	return {
		id: `song-${Date.now()}`,
		title,
		author: "Offline Composer",
		bpm: 132,
		beatsPerBar: 4,
		stepsPerBeat: 4,
		totalBars: 16,
		loopStartBar: 0,
		loopEndBar: 5,
		swing: 0,
		rootKey: "C",
		scale: "minor",
		masterVolume: 0.82,
		updatedAt: Date.now(),
		channels: [
			{
				id: "channel-1",
				name: "Pulse Lead",
				type: "pitch",
				color: CHANNEL_COLOR_PALETTE[0] ?? "#00c7ff",
				muted: false,
				solo: false,
				instrument: { ...leadPreset.configuration },
				barSequence: [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
				patterns: {
					"1": {
						index: 1,
						notes: [
							createSongNote(0, 60, 2),
							createSongNote(4, 63, 2),
							createSongNote(8, 67, 2),
							createSongNote(12, 70, 2, 2),
						],
					},
				},
			},
			{
				id: "channel-2",
				name: "Chip Arp",
				type: "pitch",
				color: CHANNEL_COLOR_PALETTE[1] ?? "#ffd93d",
				muted: false,
				solo: false,
				instrument: { ...arpPreset.configuration },
				barSequence: [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
				patterns: {
					"1": {
						index: 1,
						notes: [createSongNote(0, 60, 8), createSongNote(8, 63, 8)],
					},
				},
			},
			{
				id: "channel-3",
				name: "Triangle Bass",
				type: "pitch",
				color: CHANNEL_COLOR_PALETTE[2] ?? "#ff9233",
				muted: false,
				solo: false,
				instrument: { ...bassPreset.configuration },
				barSequence: [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
				patterns: {
					"1": {
						index: 1,
						notes: [
							createSongNote(0, 36, 2),
							createSongNote(4, 36, 2),
							createSongNote(8, 39, 2),
							createSongNote(12, 43, 2),
						],
					},
				},
			},
			{
				id: "channel-4",
				name: "8-Bit Drums",
				type: "drum",
				color: CHANNEL_COLOR_PALETTE[3] ?? "#b366ff",
				muted: false,
				solo: false,
				instrument: { ...drumPreset.configuration },
				barSequence: [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
				patterns: {
					"1": {
						index: 1,
						notes: [
							createSongNote(0, 0, 1),
							createSongNote(2, 2, 1),
							createSongNote(4, 1, 1),
							createSongNote(6, 2, 1),
							createSongNote(8, 0, 1),
							createSongNote(10, 2, 1),
							createSongNote(12, 1, 1),
							createSongNote(14, 2, 1),
						],
					},
				},
			},
		],
	};
};

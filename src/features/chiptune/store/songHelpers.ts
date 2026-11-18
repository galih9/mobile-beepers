import {
	CHANNEL_COLOR_PALETTE,
	generateProceduralPatternNotes,
} from "../constants/demoSongs";
import { getPresetConfigurationById } from "../constants/instrumentPresets";
import {
	MELODIC_MAX_MIDI,
	MELODIC_MIN_MIDI,
} from "../constants/scalesAndNotes";
import type {
	Channel,
	ChannelType,
	NoteBendStyle,
	NoteEvent,
	NoteFadeMode,
	Pattern,
	SongProject,
} from "../types/music";

const PITCH_BEND_CYCLE: Array<number> = [0, 2, 7, 12, -2, -7, -12];

export const getStepsPerBar = (song: SongProject): number => {
	return song.beatsPerBar * song.stepsPerBeat;
};

export const getPatternIndexAtBar = (
	channel: Channel | undefined,
	barIndex: number
): number => {
	if (!channel) {
		return 0;
	}
	return channel.barSequence[barIndex] ?? 0;
};

export const getActivePatternForChannel = (
	channel: Channel | undefined,
	barIndex: number
): Pattern | null => {
	if (!channel) {
		return null;
	}
	const patternIndex = getPatternIndexAtBar(channel, barIndex);
	if (patternIndex <= 0) {
		return null;
	}
	return channel.patterns[String(patternIndex)] ?? null;
};

export const getNextAvailablePatternIndex = (channel: Channel): number => {
	const existingKeys = Object.keys(channel.patterns)
		.map((key) => Number.parseInt(key, 10))
		.filter((numberValue) => Number.isFinite(numberValue) && numberValue > 0);
	const sequenceMax = Math.max(0, ...channel.barSequence);
	const dictMax = existingKeys.length > 0 ? Math.max(...existingKeys) : 0;
	return Math.max(sequenceMax, dictMax) + 1;
};

export const updateChannelPatternNotes = (
	song: SongProject,
	channelIndex: number,
	barIndex: number,
	transformNotes: (notes: Array<NoteEvent>) => Array<NoteEvent>
): SongProject => {
	const targetChannel = song.channels[channelIndex];
	if (!targetChannel) {
		return song;
	}

	let patternIndex = targetChannel.barSequence[barIndex] ?? 0;
	let nextBarSequence = targetChannel.barSequence;

	if (patternIndex <= 0) {
		patternIndex = getNextAvailablePatternIndex(targetChannel);
		nextBarSequence = targetChannel.barSequence.map((value, index) =>
			index === barIndex ? patternIndex : value
		);
	}

	const patternKey = String(patternIndex);
	const existingPattern = targetChannel.patterns[patternKey] ?? {
		index: patternIndex,
		notes: [],
	};
	const nextNotes = transformNotes(existingPattern.notes);

	const updatedChannel: Channel = {
		...targetChannel,
		barSequence: nextBarSequence,
		patterns: {
			...targetChannel.patterns,
			[patternKey]: {
				index: patternIndex,
				notes: nextNotes,
			},
		},
	};

	return {
		...song,
		updatedAt: Date.now(),
		channels: song.channels.map((channel, index) =>
			index === channelIndex ? updatedChannel : channel
		),
	};
};

export const createNewChannel = (
	channelType: ChannelType,
	existingCount: number,
	totalBars: number
): Channel => {
	const presetId = channelType === "drum" ? "retro-8bit-kit" : "gb-square-50";
	const preset = getPresetConfigurationById(presetId);
	const color =
		CHANNEL_COLOR_PALETTE[existingCount % CHANNEL_COLOR_PALETTE.length] ??
		"#22d3ee";
	const label =
		channelType === "drum"
			? `Drums ${existingCount + 1}`
			: `Synth ${existingCount + 1}`;

	return {
		id: `channel-${Date.now()}-${existingCount}`,
		name: label,
		type: channelType,
		color,
		muted: false,
		solo: false,
		instrument: { ...preset.configuration },
		barSequence: Array.from({ length: totalBars }, (_, index) =>
			index === 0 ? 1 : 0
		),
		patterns: {
			"1": {
				index: 1,
				notes: [],
			},
		},
	};
};

export const setBarPatternIndexInSong = (
	song: SongProject,
	channelIndex: number,
	barIndex: number,
	patternIndex: number
): SongProject => {
	const targetChannel = song.channels[channelIndex];
	if (!targetChannel) {
		return song;
	}
	const clampedPatternIndex = Math.max(0, Math.min(32, patternIndex));
	const patternKey = String(clampedPatternIndex);
	const nextPatterns =
		clampedPatternIndex > 0 && !targetChannel.patterns[patternKey]
			? {
					...targetChannel.patterns,
					[patternKey]: { index: clampedPatternIndex, notes: [] },
				}
			: targetChannel.patterns;

	const nextBarSequence = targetChannel.barSequence.map((value, index) =>
		index === barIndex ? clampedPatternIndex : value
	);

	return {
		...song,
		updatedAt: Date.now(),
		channels: song.channels.map((channel, index) =>
			index === channelIndex
				? {
						...channel,
						barSequence: nextBarSequence,
						patterns: nextPatterns,
					}
				: channel
		),
	};
};

export const clonePatternToBarInSong = (
	song: SongProject,
	channelIndex: number,
	barIndex: number
): SongProject => {
	const targetChannel = song.channels[channelIndex];
	if (!targetChannel) {
		return song;
	}
	const sourcePatternIndex = targetChannel.barSequence[barIndex] ?? 0;
	const sourcePattern =
		sourcePatternIndex > 0
			? targetChannel.patterns[String(sourcePatternIndex)]
			: null;
	const newIndex = getNextAvailablePatternIndex(targetChannel);
	const clonedNotes: Array<NoteEvent> = sourcePattern
		? sourcePattern.notes.map((note) => ({
				...note,
				id: `note-${note.step}-${note.pitch}-${Math.random().toString(36).slice(2, 7)}`,
			}))
		: [];

	const nextBarSequence = targetChannel.barSequence.map((value, index) =>
		index === barIndex ? newIndex : value
	);

	return {
		...song,
		updatedAt: Date.now(),
		channels: song.channels.map((channel, index) =>
			index === channelIndex
				? {
						...channel,
						barSequence: nextBarSequence,
						patterns: {
							...channel.patterns,
							[String(newIndex)]: {
								index: newIndex,
								notes: clonedNotes,
							},
						},
					}
				: channel
		),
	};
};

export const cycleNotePitchBendInSong = (
	song: SongProject,
	channelIndex: number,
	barIndex: number,
	step: number,
	pitch: number
): SongProject => {
	return updateChannelPatternNotes(song, channelIndex, barIndex, (notes) =>
		notes.map((note) => {
			if (
				note.pitch === pitch &&
				step >= note.step &&
				step < note.step + note.duration
			) {
				const currentIndex = PITCH_BEND_CYCLE.indexOf(note.pitchBend);
				const nextIndex =
					currentIndex === -1
						? 1
						: (currentIndex + 1) % PITCH_BEND_CYCLE.length;
				return {
					...note,
					pitchBend: PITCH_BEND_CYCLE[nextIndex] ?? 0,
				};
			}
			return note;
		})
	);
};

export const transposeChannelPattern = (
	song: SongProject,
	channelIndex: number,
	barIndex: number,
	semitones: number
): SongProject => {
	const channel = song.channels[channelIndex];
	if (!channel || channel.type === "drum") {
		return song;
	}
	return updateChannelPatternNotes(song, channelIndex, barIndex, (notes) =>
		notes.map((note) => ({
			...note,
			pitch: Math.max(
				MELODIC_MIN_MIDI,
				Math.min(MELODIC_MAX_MIDI, note.pitch + semitones)
			),
		}))
	);
};

export const generateRiffInChannelPattern = (
	song: SongProject,
	channelIndex: number,
	barIndex: number
): SongProject => {
	const channel = song.channels[channelIndex];
	if (!channel) {
		return song;
	}
	const stepsPerBar = getStepsPerBar(song);
	const generated = generateProceduralPatternNotes(
		channel.type,
		song.rootKey,
		song.scale,
		stepsPerBar
	);
	return updateChannelPatternNotes(
		song,
		channelIndex,
		barIndex,
		() => generated
	);
};

export const moveNoteInSong = (
	song: SongProject,
	channelIndex: number,
	barIndex: number,
	fromStep: number,
	fromPitch: number,
	toStep: number,
	toPitch: number
): SongProject => {
	const channel = song.channels[channelIndex];
	if (!channel) {
		return song;
	}
	const activePattern = getActivePatternForChannel(channel, barIndex);
	if (!activePattern) {
		return song;
	}
	const sourceNote = activePattern.notes.find(
		(note) => note.step === fromStep && note.pitch === fromPitch
	);
	if (!sourceNote) {
		return song;
	}

	const stepsPerBar = getStepsPerBar(song);
	const clampedStep = Math.max(0, Math.min(stepsPerBar - 1, toStep));
	const clampedPitch =
		channel.type === "drum"
			? Math.max(0, Math.min(7, toPitch))
			: Math.max(MELODIC_MIN_MIDI, Math.min(MELODIC_MAX_MIDI, toPitch));
	const clampedDuration = Math.max(
		1,
		Math.min(stepsPerBar - clampedStep, sourceNote.duration)
	);

	if (clampedStep === fromStep && clampedPitch === fromPitch) {
		return song;
	}

	return updateChannelPatternNotes(song, channelIndex, barIndex, (notes) => [
		...notes.filter(
			(note) =>
				!(note.step === fromStep && note.pitch === fromPitch) &&
				!(note.step === clampedStep && note.pitch === clampedPitch)
		),
		{
			...sourceNote,
			step: clampedStep,
			pitch: clampedPitch,
			duration: clampedDuration,
		},
	]);
};

export const reorderChannelsInSong = (
	song: SongProject,
	fromIndex: number,
	toIndex: number
): SongProject => {
	if (
		fromIndex === toIndex ||
		fromIndex < 0 ||
		toIndex < 0 ||
		fromIndex >= song.channels.length ||
		toIndex >= song.channels.length
	) {
		return song;
	}

	const nextChannels = [...song.channels];
	const [movedChannel] = nextChannels.splice(fromIndex, 1);
	if (!movedChannel) {
		return song;
	}
	nextChannels.splice(toIndex, 0, movedChannel);

	return {
		...song,
		updatedAt: Date.now(),
		channels: nextChannels,
	};
};

export const copyBarPatternSlotInSong = (
	song: SongProject,
	sourceChannelIndex: number,
	sourceBarIndex: number,
	targetChannelIndex: number,
	targetBarIndex: number
): SongProject => {
	const sourceChannel = song.channels[sourceChannelIndex];
	const targetChannel = song.channels[targetChannelIndex];
	if (!sourceChannel || !targetChannel) {
		return song;
	}
	if (
		sourceBarIndex < 0 ||
		sourceBarIndex >= song.totalBars ||
		targetBarIndex < 0 ||
		targetBarIndex >= song.totalBars
	) {
		return song;
	}
	if (
		sourceChannelIndex === targetChannelIndex &&
		sourceBarIndex === targetBarIndex
	) {
		return song;
	}

	const sourcePatternIndex = sourceChannel.barSequence[sourceBarIndex] ?? 0;
	if (sourceChannelIndex === targetChannelIndex) {
		return setBarPatternIndexInSong(
			song,
			targetChannelIndex,
			targetBarIndex,
			sourcePatternIndex
		);
	}

	if (sourcePatternIndex <= 0) {
		return setBarPatternIndexInSong(
			song,
			targetChannelIndex,
			targetBarIndex,
			0
		);
	}

	const sourcePattern = sourceChannel.patterns[String(sourcePatternIndex)];
	if (!sourcePattern) {
		return setBarPatternIndexInSong(
			song,
			targetChannelIndex,
			targetBarIndex,
			0
		);
	}

	const newPatternIndex = getNextAvailablePatternIndex(targetChannel);
	const clonedNotes: Array<NoteEvent> = sourcePattern.notes.map((note) => ({
		...note,
		id: `note-${note.step}-${note.pitch}-${Math.random().toString(36).slice(2, 7)}`,
		pitch:
			targetChannel.type === "drum"
				? Math.max(0, Math.min(7, note.pitch))
				: Math.max(MELODIC_MIN_MIDI, Math.min(MELODIC_MAX_MIDI, note.pitch)),
	}));

	const nextBarSequence = targetChannel.barSequence.map((value, index) =>
		index === targetBarIndex ? newPatternIndex : value
	);

	return {
		...song,
		updatedAt: Date.now(),
		channels: song.channels.map((channel, index) =>
			index === targetChannelIndex
				? {
						...channel,
						barSequence: nextBarSequence,
						patterns: {
							...channel.patterns,
							[String(newPatternIndex)]: {
								index: newPatternIndex,
								notes: clonedNotes,
							},
						},
					}
				: channel
		),
	};
};

const FADE_MODE_CYCLE: Array<NoteFadeMode> = ["none", "fadeIn", "fadeOut"];

export const setNotePitchBendInSong = (
	song: SongProject,
	channelIndex: number,
	barIndex: number,
	step: number,
	pitch: number,
	pitchBend: number,
	bendStyle?: NoteBendStyle
): SongProject => {
	const channel = song.channels[channelIndex];
	if (!channel || channel.type === "drum") {
		return song;
	}
	const clampedBend = Math.max(-24, Math.min(24, Math.round(pitchBend)));
	return updateChannelPatternNotes(song, channelIndex, barIndex, (notes) =>
		notes.map((note) => {
			if (
				note.pitch === pitch &&
				step >= note.step &&
				step < note.step + note.duration
			) {
				return {
					...note,
					pitchBend: clampedBend,
					bendStyle: bendStyle ?? note.bendStyle ?? "late",
				};
			}
			return note;
		})
	);
};

export const cycleNoteFadeInSong = (
	song: SongProject,
	channelIndex: number,
	barIndex: number,
	step: number,
	pitch: number
): SongProject => {
	return updateChannelPatternNotes(song, channelIndex, barIndex, (notes) =>
		notes.map((note) => {
			if (
				note.pitch === pitch &&
				step >= note.step &&
				step < note.step + note.duration
			) {
				const currentMode = note.fadeMode ?? "none";
				const currentIndex = FADE_MODE_CYCLE.indexOf(currentMode);
				const nextMode =
					FADE_MODE_CYCLE[(currentIndex + 1) % FADE_MODE_CYCLE.length] ??
					"none";
				return {
					...note,
					fadeMode: nextMode,
				};
			}
			return note;
		})
	);
};

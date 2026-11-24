import {
	CHANNEL_COLOR_PALETTE,
	generateProceduralPatternNotes,
} from "../constants/demoSongs";
import { isNoteArticulation, isNoteOrnament } from "../audio/articulation";
import { getPresetConfigurationById } from "../constants/instrumentPresets";
import { MAX_PATTERN_INDEX, MAX_SONG_BARS } from "../constants/limits";
import {
	MELODIC_MAX_MIDI,
	MELODIC_MIN_MIDI,
} from "../constants/scalesAndNotes";
import type {
	BarMatrixSelection,
	Channel,
	ChannelType,
	CopiedBarSlot,
	CopiedBarsClipboard,
	NoteArticulation,
	NoteBatchMoveUpdate,
	NoteBendStyle,
	NoteEvent,
	NoteFadeMode,
	NoteOrnament,
	Pattern,
	SongProject,
	SongSection,
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
	const clampedPatternIndex = Math.max(
		0,
		Math.min(MAX_PATTERN_INDEX, patternIndex)
	);
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

export const moveNotesBatchInSong = (
	song: SongProject,
	channelIndex: number,
	barIndex: number,
	updates: Array<NoteBatchMoveUpdate>,
	deduplicateUnselected = true
): SongProject => {
	const channel = song.channels[channelIndex];
	if (!channel || updates.length === 0) {
		return song;
	}
	const activePattern = getActivePatternForChannel(channel, barIndex);
	if (!activePattern) {
		return song;
	}

	const stepsPerBar = getStepsPerBar(song);
	const updateMap = new Map<string, NoteBatchMoveUpdate>();
	for (const update of updates) {
		updateMap.set(update.id, update);
	}

	return updateChannelPatternNotes(song, channelIndex, barIndex, (notes) => {
		const movedNotes = notes.map((note) => {
			const target = updateMap.get(note.id);
			if (!target) {
				return note;
			}
			const clampedStep = Math.max(
				0,
				Math.min(stepsPerBar - 1, Math.round(target.step))
			);
			const clampedPitch =
				channel.type === "drum"
					? Math.max(0, Math.min(7, Math.round(target.pitch)))
					: Math.max(
							MELODIC_MIN_MIDI,
							Math.min(MELODIC_MAX_MIDI, Math.round(target.pitch))
						);
			const clampedDuration = Math.max(
				1,
				Math.min(stepsPerBar - clampedStep, note.duration)
			);
			return {
				...note,
				step: clampedStep,
				pitch: clampedPitch,
				duration: clampedDuration,
			};
		});

		if (!deduplicateUnselected) {
			return movedNotes;
		}

		const occupiedByMoved = new Set<string>();
		for (const note of movedNotes) {
			if (updateMap.has(note.id)) {
				occupiedByMoved.add(`${note.step}:${note.pitch}`);
			}
		}

		return movedNotes.filter(
			(note) =>
				updateMap.has(note.id) ||
				!occupiedByMoved.has(`${note.step}:${note.pitch}`)
		);
	});
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

/** Stutter tool cycle: off → 2 → 3 → 4 → 6 → 8 → off */
export const RATCHET_CYCLE: Array<number> = [1, 2, 3, 4, 6, 8];

export const cycleNoteRatchetInSong = (
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
				const currentIndex = RATCHET_CYCLE.indexOf(note.ratchet ?? 1);
				const nextRatchet =
					RATCHET_CYCLE[
						(Math.max(0, currentIndex) + 1) % RATCHET_CYCLE.length
					] ?? 1;
				return { ...note, ratchet: nextRatchet > 1 ? nextRatchet : undefined };
			}
			return note;
		})
	);
};

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

export const normalizeBarSelection = (
	selection: BarMatrixSelection,
	totalBars: number,
	channelCount: number
): BarMatrixSelection => {
	const minBar = Math.max(0, Math.min(selection.startBar, selection.endBar));
	const maxBar = Math.min(
		totalBars - 1,
		Math.max(selection.startBar, selection.endBar)
	);
	const minChan = Math.max(
		0,
		Math.min(selection.startChannel, selection.endChannel)
	);
	const maxChan = Math.min(
		channelCount - 1,
		Math.max(selection.startChannel, selection.endChannel)
	);
	return {
		startBar: minBar,
		endBar: maxBar,
		startChannel: minChan,
		endChannel: maxChan,
	};
};

export const copyBarsFromSong = (
	song: SongProject,
	rawSelection: BarMatrixSelection
): CopiedBarsClipboard => {
	const sel = normalizeBarSelection(
		rawSelection,
		song.totalBars,
		song.channels.length
	);
	const slots: Array<CopiedBarSlot> = [];
	const barCount = sel.endBar - sel.startBar + 1;
	const channelCount = sel.endChannel - sel.startChannel + 1;

	for (let c = sel.startChannel; c <= sel.endChannel; c++) {
		const channel = song.channels[c];
		if (!channel) {
			continue;
		}
		for (let b = sel.startBar; b <= sel.endBar; b++) {
			const patternNumber = channel.barSequence[b] ?? 0;
			const pattern =
				patternNumber > 0 ? channel.patterns[String(patternNumber)] : null;
			slots.push({
				channelOffset: c - sel.startChannel,
				channelType: channel.type,
				channelName: channel.name,
				barOffset: b - sel.startBar,
				patternNumber,
				patternNotes: pattern
					? pattern.notes.map((n) => ({ ...n }))
					: undefined,
			});
		}
	}

	return {
		barCount,
		channelCount,
		slots,
	};
};

export const pasteBarsIntoSong = (
	song: SongProject,
	clipboard: CopiedBarsClipboard,
	targetBar: number,
	targetChannel = 0
): { song: SongProject; pastedSelection: BarMatrixSelection } => {
	if (!clipboard || clipboard.slots.length === 0) {
		return {
			song,
			pastedSelection: {
				startBar: targetBar,
				endBar: targetBar,
				startChannel: targetChannel,
				endChannel: targetChannel,
			},
		};
	}

	let requiredBars = song.totalBars;
	const maxNeededBar = targetBar + clipboard.barCount;
	if (maxNeededBar > requiredBars) {
		requiredBars = Math.min(
			MAX_SONG_BARS,
			Math.max(requiredBars, maxNeededBar)
		);
	}

	let currentSong = song;
	if (requiredBars > currentSong.totalBars) {
		currentSong = {
			...currentSong,
			totalBars: requiredBars,
			channels: currentSong.channels.map((channel) => ({
				...channel,
				barSequence: Array.from(
					{ length: requiredBars },
					(_, barIndex) => channel.barSequence[barIndex] ?? 0
				),
			})),
		};
	}

	const nextChannels = currentSong.channels.map((channel) => ({
		...channel,
		barSequence: [...channel.barSequence],
		patterns: { ...channel.patterns },
	}));

	let maxPastedBar = targetBar;
	let maxPastedChan = targetChannel;

	for (const slot of clipboard.slots) {
		const destinationChannelIndex = targetChannel + slot.channelOffset;
		const destinationBarIndex = targetBar + slot.barOffset;

		if (
			destinationChannelIndex < 0 ||
			destinationChannelIndex >= nextChannels.length
		) {
			continue;
		}
		if (destinationBarIndex < 0 || destinationBarIndex >= requiredBars) {
			continue;
		}

		maxPastedBar = Math.max(maxPastedBar, destinationBarIndex);
		maxPastedChan = Math.max(maxPastedChan, destinationChannelIndex);

		const targetChannelObject = nextChannels[destinationChannelIndex];
		if (!targetChannelObject) {
			continue;
		}

		if (slot.patternNumber <= 0 || !slot.patternNotes) {
			targetChannelObject.barSequence[destinationBarIndex] = 0;
			continue;
		}

		const existingPattern =
			targetChannelObject.patterns[String(slot.patternNumber)];
		const isSameNotes =
			existingPattern &&
			existingPattern.notes.length === slot.patternNotes.length &&
			existingPattern.notes.every(
				(note, noteIndex) =>
					slot.patternNotes &&
					note.step === slot.patternNotes[noteIndex]?.step &&
					note.pitch === slot.patternNotes[noteIndex]?.pitch &&
					note.duration === slot.patternNotes[noteIndex]?.duration
			);

		if (isSameNotes) {
			targetChannelObject.barSequence[destinationBarIndex] = slot.patternNumber;
		} else {
			const newPatternIndex = getNextAvailablePatternIndex(targetChannelObject);
			const clonedNotes = slot.patternNotes.map((note) => ({
				...note,
				id: `note-${note.step}-${note.pitch}-${Math.random().toString(36).slice(2, 7)}`,
				pitch:
					targetChannelObject.type === "drum"
						? Math.max(0, Math.min(7, note.pitch))
						: Math.max(
								MELODIC_MIN_MIDI,
								Math.min(MELODIC_MAX_MIDI, note.pitch)
							),
			}));

			targetChannelObject.patterns[String(newPatternIndex)] = {
				index: newPatternIndex,
				notes: clonedNotes,
			};
			targetChannelObject.barSequence[destinationBarIndex] = newPatternIndex;
		}
	}

	return {
		song: {
			...currentSong,
			updatedAt: Date.now(),
			channels: nextChannels,
		},
		pastedSelection: {
			startBar: targetBar,
			endBar: maxPastedBar,
			startChannel: targetChannel,
			endChannel: maxPastedChan,
		},
	};
};

export const clearBarsInSong = (
	song: SongProject,
	rawSelection: BarMatrixSelection
): SongProject => {
	const sel = normalizeBarSelection(
		rawSelection,
		song.totalBars,
		song.channels.length
	);
	return {
		...song,
		updatedAt: Date.now(),
		channels: song.channels.map((channel, channelIndex) => {
			if (channelIndex < sel.startChannel || channelIndex > sel.endChannel) {
				return channel;
			}
			return {
				...channel,
				barSequence: channel.barSequence.map((patternValue, barIndex) =>
					barIndex >= sel.startBar && barIndex <= sel.endBar ? 0 : patternValue
				),
			};
		}),
	};
};

export const moveBarsInSong = (
	song: SongProject,
	rawSelection: BarMatrixSelection,
	targetBar: number,
	targetChannel?: number
): { song: SongProject; nextSelection: BarMatrixSelection } => {
	const sel = normalizeBarSelection(
		rawSelection,
		song.totalBars,
		song.channels.length
	);
	const targetChan = targetChannel ?? sel.startChannel;
	if (sel.startBar === targetBar && sel.startChannel === targetChan) {
		return { song, nextSelection: sel };
	}
	const clipboard = copyBarsFromSong(song, sel);
	const clearedSong = clearBarsInSong(song, sel);
	const { song: nextSong, pastedSelection } = pasteBarsIntoSong(
		clearedSong,
		clipboard,
		targetBar,
		targetChan
	);
	return { song: nextSong, nextSelection: pastedSelection };
};

export const duplicateBarsInSong = (
	song: SongProject,
	rawSelection: BarMatrixSelection,
	targetBar: number,
	targetChannel?: number
): { song: SongProject; nextSelection: BarMatrixSelection } => {
	const sel = normalizeBarSelection(
		rawSelection,
		song.totalBars,
		song.channels.length
	);
	const clipboard = copyBarsFromSong(song, sel);
	const { song: nextSong, pastedSelection } = pasteBarsIntoSong(
		song,
		clipboard,
		targetBar,
		targetChannel ?? sel.startChannel
	);
	return { song: nextSong, nextSelection: pastedSelection };
};

export const shiftBarsInSong = (
	song: SongProject,
	rawSelection: BarMatrixSelection,
	deltaBars: number
): { song: SongProject; nextSelection: BarMatrixSelection } => {
	const sel = normalizeBarSelection(
		rawSelection,
		song.totalBars,
		song.channels.length
	);
	const barSpan = sel.endBar - sel.startBar;
	const newStartBar = Math.max(
		0,
		Math.min(song.totalBars - 1 - barSpan, sel.startBar + deltaBars)
	);
	if (newStartBar === sel.startBar) {
		return { song, nextSelection: sel };
	}
	return moveBarsInSong(song, sel, newStartBar, sel.startChannel);
};

// ─── Per-note volume (velocity), micro-timing & humanize ────────────────────

export const MIN_NOTE_VELOCITY = 0.1;
export const MAX_NOTE_VELOCITY = 1;
export const MAX_TIMING_OFFSET = 0.5;

export const clampNoteVelocity = (velocity: number): number => {
	if (!Number.isFinite(velocity)) {
		return 0.9;
	}
	const clamped = Math.max(
		MIN_NOTE_VELOCITY,
		Math.min(MAX_NOTE_VELOCITY, velocity)
	);
	return Math.round(clamped * 100) / 100;
};

export const clampTimingOffset = (offset: number): number => {
	if (!Number.isFinite(offset)) {
		return 0;
	}
	const clamped = Math.max(
		-MAX_TIMING_OFFSET,
		Math.min(MAX_TIMING_OFFSET, offset)
	);
	return Math.round(clamped * 100) / 100;
};

export interface NotePropertyUpdate {
	id: string;
	velocity?: number;
	timingOffset?: number;
	/** Set the articulation; null clears it back to normal */
	articulation?: NoteArticulation | null;
	/** Set the ornament; null removes it */
	ornament?: NoteOrnament | null;
}

/**
 * Applies per-note velocity / timing updates (matched by note id) to the
 * pattern playing at `barIndex` on `channelIndex`.
 */
export const updateNotePropertiesInSong = (
	song: SongProject,
	channelIndex: number,
	barIndex: number,
	updates: Array<NotePropertyUpdate>
): SongProject => {
	if (updates.length === 0) {
		return song;
	}
	const channel = song.channels[channelIndex];
	const patternIndex = channel?.barSequence[barIndex] ?? 0;
	if (!channel || patternIndex <= 0) {
		return song;
	}
	const updateById = new Map(updates.map((update) => [update.id, update]));
	return updateChannelPatternNotes(song, channelIndex, barIndex, (notes) =>
		notes.map((note) => {
			const update = updateById.get(note.id);
			if (!update) {
				return note;
			}
			const nextNote: NoteEvent = { ...note };
			if (update.velocity !== undefined) {
				nextNote.velocity = clampNoteVelocity(update.velocity);
			}
			if (update.timingOffset !== undefined) {
				const offset = clampTimingOffset(update.timingOffset);
				if (offset === 0) {
					delete nextNote.timingOffset;
				} else {
					nextNote.timingOffset = offset;
				}
			}
			if (update.articulation !== undefined) {
				if (isNoteArticulation(update.articulation)) {
					nextNote.articulation = update.articulation;
				} else {
					delete nextNote.articulation;
				}
			}
			if (update.ornament !== undefined) {
				if (isNoteOrnament(update.ornament)) {
					nextNote.ornament = update.ornament;
				} else {
					delete nextNote.ornament;
				}
			}
			return nextNote;
		})
	);
};

export interface HumanizeOptions {
	/** Max random velocity change (± this amount, 0-0.5). Default 0.08 */
	velocityAmount?: number;
	/** Max random timing nudge in steps (± this amount, 0-0.5). Default 0.08 */
	timingAmount?: number;
	/** Only humanize these note ids (defaults to every note in the pattern) */
	noteIds?: Array<string>;
	/** Seed for repeatable results */
	seed?: number;
}

/** Small deterministic PRNG (mulberry32) so humanize results are repeatable. */
const createSeededRandom = (seed: number): (() => number) => {
	let state = Math.floor(seed) >>> 0;
	return (): number => {
		state = (state + 0x6d2b79f5) >>> 0;
		let value = state;
		value = Math.imul(value ^ (value >>> 15), value | 1);
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
	};
};

/**
 * Humanize: nudges velocity and timing of notes by small random amounts so a
 * pattern feels played rather than programmed. Accents stay accents — the
 * change is relative to each note's current velocity, and downbeat notes
 * (step 0) are never pulled earlier than the bar.
 */
export const humanizeNotesInSong = (
	song: SongProject,
	channelIndex: number,
	barIndex: number,
	options: HumanizeOptions = {}
): SongProject => {
	const channel = song.channels[channelIndex];
	const patternIndex = channel?.barSequence[barIndex] ?? 0;
	if (!channel || patternIndex <= 0) {
		return song;
	}
	const pattern = channel.patterns[String(patternIndex)];
	if (!pattern || pattern.notes.length === 0) {
		return song;
	}
	const velocityAmount = Math.max(
		0,
		Math.min(0.5, options.velocityAmount ?? 0.08)
	);
	const timingAmount = Math.max(
		0,
		Math.min(MAX_TIMING_OFFSET, options.timingAmount ?? 0.08)
	);
	const random = createSeededRandom(
		options.seed ?? Math.floor(Math.random() * 2 ** 31)
	);
	const targetIds = options.noteIds ? new Set(options.noteIds) : null;

	const updates: Array<NotePropertyUpdate> = pattern.notes
		.filter((note) => !targetIds || targetIds.has(note.id))
		.map((note) => {
			const velocityDelta = (random() * 2 - 1) * velocityAmount;
			let timingDelta = (random() * 2 - 1) * timingAmount;
			if (note.step === 0 && timingDelta < 0) {
				timingDelta = -timingDelta;
			}
			return {
				id: note.id,
				velocity: note.velocity + velocityDelta,
				timingOffset: timingAmount > 0 ? timingDelta : note.timingOffset,
			};
		});
	return updateNotePropertiesInSong(song, channelIndex, barIndex, updates);
};

/** Removes micro-timing from notes (snaps them back to the grid). */
export const quantizeNotesInSong = (
	song: SongProject,
	channelIndex: number,
	barIndex: number,
	noteIds?: Array<string>
): SongProject => {
	const channel = song.channels[channelIndex];
	const pattern = channel?.patterns[String(channel.barSequence[barIndex] ?? 0)];
	if (!pattern) {
		return song;
	}
	const targetIds = noteIds ? new Set(noteIds) : null;
	return updateNotePropertiesInSong(
		song,
		channelIndex,
		barIndex,
		pattern.notes
			.filter((note) => !targetIds || targetIds.has(note.id))
			.map((note) => ({ id: note.id, timingOffset: 0 }))
	);
};

// ─── Song sections (named loop regions) ──────────────────────────────────────

export const normalizeSongSections = (
	sections: Array<Partial<SongSection>>,
	totalBars: number
): Array<SongSection> => {
	const lastBar = Math.max(0, totalBars - 1);
	return sections
		.map((section, index) => {
			const startBar = Math.max(
				0,
				Math.min(lastBar, Math.round(section.startBar ?? 0))
			);
			const endBar = Math.max(
				startBar,
				Math.min(lastBar, Math.round(section.endBar ?? startBar))
			);
			const name =
				(section.name ?? "").trim().slice(0, 32) ||
				`Section ${String.fromCharCode(65 + (index % 26))}`;
			return {
				id: section.id ?? `section-${startBar}-${endBar}-${index}`,
				name,
				startBar,
				endBar,
			};
		})
		.sort((first, second) => first.startBar - second.startBar);
};

export const setSongSections = (
	song: SongProject,
	sections: Array<Partial<SongSection>>
): SongProject => {
	return {
		...song,
		updatedAt: Date.now(),
		sections: normalizeSongSections(sections, song.totalBars),
	};
};

/** Next unused "Section A/B/C…" name. */
export const getNextSectionName = (song: SongProject): string => {
	const usedNames = new Set(
		(song.sections ?? []).map((section) => section.name)
	);
	for (let index = 0; index < 26; index += 1) {
		const candidate = `Section ${String.fromCharCode(65 + index)}`;
		if (!usedNames.has(candidate)) {
			return candidate;
		}
	}
	return `Section ${(song.sections?.length ?? 0) + 1}`;
};

export type RecordedNotesInsertMode = "replace" | "merge";

export interface ApplyRecordedNotesOptions {
	channelIndex: number;
	startBarIndex: number;
	notesByBar: Array<Array<Omit<NoteEvent, "id">>>;
	mode: RecordedNotesInsertMode;
}

/**
 * Writes multi-bar captured notes into a channel, allocating fresh pattern
 * slots if a bar slot is empty or shared across bars, and extending song bars
 * if the take runs past the current end of the song.
 */
export const applyRecordedNotesToSong = (
	song: SongProject,
	options: ApplyRecordedNotesOptions
): SongProject => {
	const targetChannel = song.channels[options.channelIndex];
	if (!targetChannel || options.notesByBar.length === 0) {
		return song;
	}

	const stepsPerBar = getStepsPerBar(song);
	const clampedStartBar = Math.max(
		0,
		Math.min(MAX_SONG_BARS - 1, Math.round(options.startBarIndex))
	);
	const neededBars = Math.min(
		MAX_SONG_BARS,
		Math.max(song.totalBars, clampedStartBar + options.notesByBar.length)
	);

	const nextBarSequence = Array.from(
		{ length: neededBars },
		(_, index) => targetChannel.barSequence[index] ?? 0
	);
	const nextPatterns: Record<string, Pattern> = { ...targetChannel.patterns };

	// Track how many bars reference each pattern so shared patterns are never overwritten in place
	const usageCount = new Map<number, number>();
	for (const patternNumber of nextBarSequence) {
		if (patternNumber > 0) {
			usageCount.set(patternNumber, (usageCount.get(patternNumber) ?? 0) + 1);
		}
	}

	let noteCounter = 0;
	const stamp = Date.now();
	const cloneNoteWithFreshId = (note: NoteEvent): NoteEvent => {
		noteCounter += 1;
		return {
			...note,
			id: `note-${note.step}-${note.pitch}-${stamp}-${noteCounter}`,
		};
	};

	const maxPitch = targetChannel.type === "drum" ? 7 : MELODIC_MAX_MIDI;
	const minPitch = targetChannel.type === "drum" ? 0 : MELODIC_MIN_MIDI;
	let lastWrittenBar = clampedStartBar;

	options.notesByBar.forEach((rawNotes, barOffset) => {
		const barIndex = clampedStartBar + barOffset;
		if (barIndex >= neededBars) {
			return;
		}
		lastWrittenBar = Math.max(lastWrittenBar, barIndex);

		const existingPatternIndex = nextBarSequence[barIndex] ?? 0;
		const existingUsage = usageCount.get(existingPatternIndex) ?? 0;

		if (rawNotes.length === 0) {
			if (options.mode === "merge") {
				return;
			}
			if (existingPatternIndex <= 0) {
				return;
			}
			if (existingUsage > 1) {
				usageCount.set(existingPatternIndex, existingUsage - 1);
				nextBarSequence[barIndex] = 0;
				return;
			}
			nextPatterns[String(existingPatternIndex)] = {
				index: existingPatternIndex,
				notes: [],
			};
			return;
		}

		let targetPatternIndex = existingPatternIndex;
		let baseNotes: Array<NoteEvent> = [];

		if (existingPatternIndex <= 0 || existingUsage > 1) {
			targetPatternIndex = getNextAvailablePatternIndex({
				...targetChannel,
				barSequence: nextBarSequence,
				patterns: nextPatterns,
			});
			if (existingPatternIndex > 0) {
				usageCount.set(existingPatternIndex, Math.max(0, existingUsage - 1));
				if (options.mode === "merge") {
					const sourceNotes =
						nextPatterns[String(existingPatternIndex)]?.notes ?? [];
					baseNotes = sourceNotes.map(cloneNoteWithFreshId);
				}
			}
			usageCount.set(targetPatternIndex, 1);
			nextBarSequence[barIndex] = targetPatternIndex;
		} else if (options.mode === "merge") {
			baseNotes = [...(nextPatterns[String(existingPatternIndex)]?.notes ?? [])];
		}

		const incomingNotes: Array<NoteEvent> = rawNotes.map((raw) => {
			noteCounter += 1;
			const step = Math.max(
				0,
				Math.min(stepsPerBar - 1, Math.round(raw.step))
			);
			const pitch = Math.max(
				minPitch,
				Math.min(maxPitch, Math.round(raw.pitch))
			);
			const duration = Math.max(
				1,
				Math.min(stepsPerBar - step, Math.round(raw.duration))
			);
			return {
				...raw,
				id: `hum-${step}-${pitch}-${stamp}-${noteCounter}`,
				step,
				pitch,
				duration,
				velocity: clampNoteVelocity(raw.velocity),
				pitchBend: raw.pitchBend ?? 0,
			};
		});

		const occupiedByIncoming = new Set(
			incomingNotes.map((note) => `${note.step}:${note.pitch}`)
		);
		const combinedNotes =
			options.mode === "merge"
				? [
						...baseNotes.filter(
							(existing) =>
								!occupiedByIncoming.has(`${existing.step}:${existing.pitch}`)
						),
						...incomingNotes,
					]
				: incomingNotes;

		combinedNotes.sort((first, second) =>
			first.step !== second.step
				? first.step - second.step
				: first.pitch - second.pitch
		);

		nextPatterns[String(targetPatternIndex)] = {
			index: targetPatternIndex,
			notes: combinedNotes,
		};
	});

	const nextChannels = song.channels.map((channel, index) => {
		if (index === options.channelIndex) {
			return {
				...channel,
				barSequence: nextBarSequence,
				patterns: nextPatterns,
			};
		}
		if (neededBars > song.totalBars) {
			return {
				...channel,
				barSequence: Array.from(
					{ length: neededBars },
					(_, barIndex) => channel.barSequence[barIndex] ?? 0
				),
			};
		}
		return channel;
	});

	const loopStartBar = Math.max(
		0,
		Math.min(neededBars - 1, song.loopStartBar ?? 0)
	);
	let loopEndBar = Math.max(
		loopStartBar,
		Math.min(neededBars - 1, song.loopEndBar ?? neededBars - 1)
	);
	if (
		clampedStartBar >= loopStartBar &&
		clampedStartBar <= loopEndBar &&
		lastWrittenBar > loopEndBar
	) {
		loopEndBar = Math.min(neededBars - 1, lastWrittenBar);
	}

	return {
		...song,
		totalBars: neededBars,
		loopStartBar,
		loopEndBar,
		channels: nextChannels,
		updatedAt: stamp,
	};
};

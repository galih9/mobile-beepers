import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createBlankSongProject, DEMO_SONGS } from "../constants/demoSongs";
import { getPresetConfigurationById } from "../constants/instrumentPresets";
import type { MusicalKey, ScaleType, SongProject } from "../types/music";
import {
	clonePatternToBarInSong,
	createNewChannel,
	cycleNotePitchBendInSong,
	generateRiffInChannelPattern,
	getStepsPerBar,
	setBarPatternIndexInSong,
	transposeChannelPattern,
	updateChannelPatternNotes,
} from "./songHelpers";
import type { ChiptuneStoreState, PersistedChiptuneState } from "./storeTypes";

const cloneSongProject = (project: SongProject): SongProject => {
	return structuredClone(project);
};

const initialSong = cloneSongProject(
	DEMO_SONGS[0] ?? createBlankSongProject("Neon Demo")
);

export const useChiptuneStore = create<ChiptuneStoreState>()(
	persist(
		(set) => ({
			song: initialSong,
			savedSongs: [],
			selectedChannelIndex: 0,
			selectedBarIndex: 0,
			activeWorkspaceTab: "piano",
			activeTool: "draw",
			defaultNoteDuration: 2,
			scaleLockOnly: true,
			showGhostNotes: true,
			isPlaying: false,
			loopMode: "song",
			playbackBar: 0,
			playbackStep: 0,

			setActiveWorkspaceTab: (tab): void => {
				set({ activeWorkspaceTab: tab });
			},
			setActiveTool: (tool): void => {
				set({ activeTool: tool });
			},
			setDefaultNoteDuration: (duration): void => {
				set({ defaultNoteDuration: duration });
			},
			toggleScaleLockOnly: (): void => {
				set((state) => ({ scaleLockOnly: !state.scaleLockOnly }));
			},
			toggleShowGhostNotes: (): void => {
				set((state) => ({ showGhostNotes: !state.showGhostNotes }));
			},
			setSelectedChannelIndex: (index): void => {
				set((state) => ({
					selectedChannelIndex: Math.max(
						0,
						Math.min(state.song.channels.length - 1, index)
					),
				}));
			},
			setSelectedBarIndex: (index): void => {
				set((state) => ({
					selectedBarIndex: Math.max(
						0,
						Math.min(state.song.totalBars - 1, index)
					),
				}));
			},
			setIsPlaying: (playing): void => {
				set({ isPlaying: playing });
			},
			setLoopMode: (mode): void => {
				set({ loopMode: mode });
			},
			setPlaybackPosition: (barIndex, stepIndex): void => {
				set({ playbackBar: barIndex, playbackStep: stepIndex });
			},

			updateSongMetadata: (updates): void => {
				set((state) => ({
					song: {
						...state.song,
						...updates,
						bpm:
							updates.bpm !== undefined
								? Math.max(50, Math.min(240, updates.bpm))
								: state.song.bpm,
						updatedAt: Date.now(),
					},
				}));
			},

			setTotalBars: (totalBars): void => {
				set((state) => {
					const clampedBars = Math.max(4, Math.min(32, totalBars));
					const nextLoopEnd = Math.min(
						clampedBars - 1,
						state.song.loopEndBar ?? clampedBars - 1
					);
					const nextLoopStart = Math.min(
						nextLoopEnd,
						state.song.loopStartBar ?? 0
					);
					const updatedChannels = state.song.channels.map((channel) => ({
						...channel,
						barSequence: Array.from(
							{ length: clampedBars },
							(_, index) => channel.barSequence[index] ?? 0
						),
					}));
					return {
						song: {
							...state.song,
							totalBars: clampedBars,
							loopStartBar: nextLoopStart,
							loopEndBar: nextLoopEnd,
							channels: updatedChannels,
							updatedAt: Date.now(),
						},
						selectedBarIndex: Math.min(state.selectedBarIndex, clampedBars - 1),
					};
				});
			},

			setLoopRange: (loopStartBar, loopEndBar): void => {
				set((state) => {
					const maxBar = Math.max(0, state.song.totalBars - 1);
					const clampedStart = Math.max(0, Math.min(maxBar, loopStartBar));
					const clampedEnd = Math.max(
						clampedStart,
						Math.min(maxBar, loopEndBar)
					);
					return {
						song: {
							...state.song,
							loopStartBar: clampedStart,
							loopEndBar: clampedEnd,
							updatedAt: Date.now(),
						},
					};
				});
			},

			addChannel: (channelType): void => {
				set((state) => {
					if (state.song.channels.length >= 8) {
						return state;
					}
					const created = createNewChannel(
						channelType,
						state.song.channels.length,
						state.song.totalBars
					);
					return {
						song: {
							...state.song,
							channels: [...state.song.channels, created],
							updatedAt: Date.now(),
						},
						selectedChannelIndex: state.song.channels.length,
					};
				});
			},

			removeChannel: (channelIndex): void => {
				set((state) => {
					if (state.song.channels.length <= 1) {
						return state;
					}
					const filtered = state.song.channels.filter(
						(_, index) => index !== channelIndex
					);
					return {
						song: { ...state.song, channels: filtered, updatedAt: Date.now() },
						selectedChannelIndex: Math.min(
							state.selectedChannelIndex,
							filtered.length - 1
						),
					};
				});
			},

			toggleChannelMute: (channelIndex): void => {
				set((state) => ({
					song: {
						...state.song,
						channels: state.song.channels.map((channel, index) =>
							index === channelIndex
								? { ...channel, muted: !channel.muted }
								: channel
						),
					},
				}));
			},

			toggleChannelSolo: (channelIndex): void => {
				set((state) => ({
					song: {
						...state.song,
						channels: state.song.channels.map((channel, index) =>
							index === channelIndex
								? { ...channel, solo: !channel.solo }
								: channel
						),
					},
				}));
			},

			setBarPatternIndex: (channelIndex, barIndex, patternIndex): void => {
				set((state) => ({
					song: setBarPatternIndexInSong(
						state.song,
						channelIndex,
						barIndex,
						patternIndex
					),
				}));
			},

			clonePatternToBar: (channelIndex, barIndex): void => {
				set((state) => ({
					song: clonePatternToBarInSong(state.song, channelIndex, barIndex),
				}));
			},

			addOrReplaceNote: (noteInput): void => {
				set((state) => {
					const stepsPerBar = getStepsPerBar(state.song);
					const clampedDuration = Math.max(
						1,
						Math.min(stepsPerBar - noteInput.step, noteInput.duration)
					);
					return {
						song: updateChannelPatternNotes(
							state.song,
							state.selectedChannelIndex,
							state.selectedBarIndex,
							(notes) => [
								...notes.filter(
									(existing) =>
										!(
											existing.pitch === noteInput.pitch &&
											existing.step === noteInput.step
										)
								),
								{
									...noteInput,
									duration: clampedDuration,
									id: `note-${noteInput.step}-${noteInput.pitch}-${Date.now()}`,
								},
							]
						),
					};
				});
			},

			removeNoteAt: (step, pitch): void => {
				set((state) => ({
					song: updateChannelPatternNotes(
						state.song,
						state.selectedChannelIndex,
						state.selectedBarIndex,
						(notes) =>
							notes.filter(
								(note) =>
									!(
										note.pitch === pitch &&
										step >= note.step &&
										step < note.step + note.duration
									)
							)
					),
				}));
			},

			resizeNoteAt: (step, pitch, duration): void => {
				set((state) => {
					const stepsPerBar = getStepsPerBar(state.song);
					return {
						song: updateChannelPatternNotes(
							state.song,
							state.selectedChannelIndex,
							state.selectedBarIndex,
							(notes) =>
								notes.map((note) =>
									note.pitch === pitch && note.step === step
										? {
												...note,
												duration: Math.max(
													1,
													Math.min(stepsPerBar - note.step, duration)
												),
											}
										: note
								)
						),
					};
				});
			},

			cycleNotePitchBend: (step, pitch): void => {
				set((state) => ({
					song: cycleNotePitchBendInSong(
						state.song,
						state.selectedChannelIndex,
						state.selectedBarIndex,
						step,
						pitch
					),
				}));
			},

			clearCurrentPattern: (): void => {
				set((state) => ({
					song: updateChannelPatternNotes(
						state.song,
						state.selectedChannelIndex,
						state.selectedBarIndex,
						() => []
					),
				}));
			},

			transposeCurrentPattern: (semitones): void => {
				set((state) => ({
					song: transposeChannelPattern(
						state.song,
						state.selectedChannelIndex,
						state.selectedBarIndex,
						semitones
					),
				}));
			},

			generateRiffForCurrentPattern: (): void => {
				set((state) => ({
					song: generateRiffInChannelPattern(
						state.song,
						state.selectedChannelIndex,
						state.selectedBarIndex
					),
				}));
			},

			updateChannelInstrument: (channelIndex, updates): void => {
				set((state) => ({
					song: {
						...state.song,
						updatedAt: Date.now(),
						channels: state.song.channels.map((channel, index) =>
							index === channelIndex
								? {
										...channel,
										instrument: { ...channel.instrument, ...updates },
									}
								: channel
						),
					},
				}));
			},

			applyInstrumentPreset: (channelIndex, presetId): void => {
				set((state) => {
					const preset = getPresetConfigurationById(presetId);
					return {
						song: {
							...state.song,
							updatedAt: Date.now(),
							channels: state.song.channels.map((channel, index) =>
								index === channelIndex
									? {
											...channel,
											type: preset.category,
											instrument: { ...preset.configuration },
										}
									: channel
							),
						},
					};
				});
			},

			loadDemoSong: (demoId): void => {
				set(() => {
					const found = DEMO_SONGS.find((demo) => demo.id === demoId);
					const target = cloneSongProject(
						found ?? DEMO_SONGS[0] ?? createBlankSongProject("Demo Song")
					);
					return {
						song: { ...target, id: `song-${Date.now()}` },
						selectedChannelIndex: 0,
						selectedBarIndex: 0,
						playbackBar: 0,
						playbackStep: 0,
						isPlaying: false,
					};
				});
			},

			createNewProject: (): void => {
				set({
					song: createBlankSongProject("New Chiptune"),
					selectedChannelIndex: 0,
					selectedBarIndex: 0,
					playbackBar: 0,
					playbackStep: 0,
					isPlaying: false,
				});
			},

			importSongProject: (project): void => {
				set({
					song: cloneSongProject(project),
					selectedChannelIndex: 0,
					selectedBarIndex: 0,
					playbackBar: 0,
					playbackStep: 0,
					isPlaying: false,
				});
			},

			saveCurrentSongToLibrary: (): void => {
				set((state) => {
					const snapshot = {
						...cloneSongProject(state.song),
						updatedAt: Date.now(),
					};
					return {
						savedSongs: [
							snapshot,
							...state.savedSongs.filter(
								(existing) => existing.id !== snapshot.id
							),
						].slice(0, 20),
					};
				});
			},

			loadSavedSong: (songId): void => {
				set((state) => {
					const found = state.savedSongs.find((item) => item.id === songId);
					if (!found) {
						return state;
					}
					return {
						song: cloneSongProject(found),
						selectedChannelIndex: 0,
						selectedBarIndex: 0,
						playbackBar: 0,
						playbackStep: 0,
						isPlaying: false,
					};
				});
			},

			deleteSavedSong: (songId): void => {
				set((state) => ({
					savedSongs: state.savedSongs.filter((item) => item.id !== songId),
				}));
			},
		}),
		{
			name: "ultrabeep-chiptune-store-v1",
			partialize: (state): PersistedChiptuneState => ({
				song: state.song,
				savedSongs: state.savedSongs,
				scaleLockOnly: state.scaleLockOnly,
				showGhostNotes: state.showGhostNotes,
				defaultNoteDuration: state.defaultNoteDuration,
			}),
		}
	)
);

export type { MusicalKey, ScaleType };

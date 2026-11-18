import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createBlankSongProject, DEMO_SONGS } from "../constants/demoSongs";
import { getPresetConfigurationById } from "../constants/instrumentPresets";
import {
	createBlankSfxProject,
	generateProceduralSfxNotes,
	getSfxPresetById,
} from "../constants/sfxPresets";
import type {
	MusicalKey,
	ScaleType,
	SfxGeneratorArchetype,
	SongProject,
} from "../types/music";
import {
	clonePatternToBarInSong,
	copyBarPatternSlotInSong,
	createNewChannel,
	cycleNoteFadeInSong,
	cycleNotePitchBendInSong,
	generateRiffInChannelPattern,
	getStepsPerBar,
	moveNoteInSong,
	moveNotesBatchInSong,
	reorderChannelsInSong,
	setBarPatternIndexInSong,
	setNotePitchBendInSong,
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

const SFX_ARCHETYPE_PRESET_MAP: Record<
	Exclude<SfxGeneratorArchetype, "random">,
	string
> = {
	laser: "nes-pulse-12",
	hurt: "vrc6-saw-lead",
	attack: "genesis-fm-bell",
	jump: "gb-square-50",
	coin: "nes-pulse-25",
};

export const useChiptuneStore = create<ChiptuneStoreState>()(
	persist(
		(set) => ({
			studioMode: "music",
			song: initialSong,
			musicProjectBackup: null,
			sfxProjectBackup: null,
			savedSongs: [],
			selectedChannelIndex: 0,
			selectedBarIndex: 0,
			activeWorkspaceTab: "all",
			activeTool: "draw",
			defaultNoteDuration: 2,
			pianoRollZoom: 1,
			scaleLockOnly: true,
			showGhostNotes: true,
			followPlayhead: true,
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
			setPianoRollZoom: (zoom): void => {
				const clamped = Math.max(0.25, Math.min(2.5, zoom));
				set({ pianoRollZoom: clamped });
			},
			toggleScaleLockOnly: (): void => {
				set((state) => ({ scaleLockOnly: !state.scaleLockOnly }));
			},
			toggleShowGhostNotes: (): void => {
				set((state) => ({ showGhostNotes: !state.showGhostNotes }));
			},
			setFollowPlayhead: (follow): void => {
				set((state) => ({
					followPlayhead: follow,
					selectedBarIndex:
						follow && state.isPlaying
							? state.playbackBar
							: state.selectedBarIndex,
				}));
			},
			toggleFollowPlayhead: (): void => {
				set((state) => {
					const nextFollow = !state.followPlayhead;
					return {
						followPlayhead: nextFollow,
						selectedBarIndex:
							nextFollow && state.isPlaying
								? state.playbackBar
								: state.selectedBarIndex,
					};
				});
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
				set((state) => {
					const nextSelectedBar = state.followPlayhead
						? Math.max(0, Math.min(state.song.totalBars - 1, barIndex))
						: state.selectedBarIndex;
					return {
						playbackBar: barIndex,
						playbackStep: stepIndex,
						selectedBarIndex: nextSelectedBar,
					};
				});
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
					const clampedBars = Math.max(1, Math.min(32, totalBars));
					const nextLoopEnd =
						state.studioMode === "sfx"
							? clampedBars - 1
							: Math.min(
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

			reorderChannels: (fromIndex, toIndex): void => {
				set((state) => {
					const updatedSong = reorderChannelsInSong(
						state.song,
						fromIndex,
						toIndex
					);
					if (updatedSong === state.song) {
						return state;
					}
					let nextSelectedChannelIndex = state.selectedChannelIndex;
					if (state.selectedChannelIndex === fromIndex) {
						nextSelectedChannelIndex = toIndex;
					} else if (
						fromIndex < state.selectedChannelIndex &&
						toIndex >= state.selectedChannelIndex
					) {
						nextSelectedChannelIndex -= 1;
					} else if (
						fromIndex > state.selectedChannelIndex &&
						toIndex <= state.selectedChannelIndex
					) {
						nextSelectedChannelIndex += 1;
					}
					return {
						song: updatedSong,
						selectedChannelIndex: nextSelectedChannelIndex,
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

			copyBarPatternSlot: (
				sourceChannelIndex,
				sourceBarIndex,
				targetChannelIndex,
				targetBarIndex
			): void => {
				set((state) => ({
					song: copyBarPatternSlotInSong(
						state.song,
						sourceChannelIndex,
						sourceBarIndex,
						targetChannelIndex,
						targetBarIndex
					),
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

			moveNoteAt: (fromStep, fromPitch, toStep, toPitch): void => {
				set((state) => ({
					song: moveNoteInSong(
						state.song,
						state.selectedChannelIndex,
						state.selectedBarIndex,
						fromStep,
						fromPitch,
						toStep,
						toPitch
					),
				}));
			},

			moveNotesBatch: (updates, deduplicateUnselected = true): void => {
				set((state) => ({
					song: moveNotesBatchInSong(
						state.song,
						state.selectedChannelIndex,
						state.selectedBarIndex,
						updates,
						deduplicateUnselected
					),
				}));
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

			setNotePitchBendAt: (step, pitch, pitchBend, bendStyle): void => {
				set((state) => ({
					song: setNotePitchBendInSong(
						state.song,
						state.selectedChannelIndex,
						state.selectedBarIndex,
						step,
						pitch,
						pitchBend,
						bendStyle
					),
				}));
			},

			cycleNoteFadeAt: (step, pitch): void => {
				set((state) => ({
					song: cycleNoteFadeInSong(
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

			setStudioMode: (mode): void => {
				set((state) => {
					if (mode === state.studioMode) {
						return state;
					}
					if (mode === "sfx") {
						const defaultSfx = getSfxPresetById("sfx-ray-gun").project;
						const nextSong = state.sfxProjectBackup
							? cloneSongProject(state.sfxProjectBackup)
							: cloneSongProject(defaultSfx);
						return {
							studioMode: "sfx",
							musicProjectBackup: cloneSongProject(state.song),
							song: nextSong,
							loopMode: "once",
							scaleLockOnly: false,
							selectedChannelIndex: 0,
							selectedBarIndex: 0,
							playbackBar: 0,
							playbackStep: 0,
							isPlaying: false,
						};
					}
					const defaultMusic =
						DEMO_SONGS[0] ?? createBlankSongProject("Neon Demo");
					const nextSong = state.musicProjectBackup
						? cloneSongProject(state.musicProjectBackup)
						: cloneSongProject(defaultMusic);
					return {
						studioMode: "music",
						sfxProjectBackup: cloneSongProject(state.song),
						song: nextSong,
						loopMode: "song",
						scaleLockOnly: true,
						selectedChannelIndex: 0,
						selectedBarIndex: 0,
						playbackBar: 0,
						playbackStep: 0,
						isPlaying: false,
					};
				});
			},

			loadSfxPreset: (presetId): void => {
				set((state) => {
					const preset = getSfxPresetById(presetId);
					const targetProject = cloneSongProject(preset.project);
					return {
						studioMode: "sfx",
						musicProjectBackup:
							state.studioMode === "music"
								? cloneSongProject(state.song)
								: state.musicProjectBackup,
						song: { ...targetProject, id: `sfx-${Date.now()}` },
						loopMode: "once",
						scaleLockOnly: preset.category === "jingle",
						selectedChannelIndex: 0,
						selectedBarIndex: 0,
						playbackBar: 0,
						playbackStep: 0,
						isPlaying: false,
					};
				});
			},

			createNewSfxProject: (): void => {
				set((state) => ({
					studioMode: "sfx",
					musicProjectBackup:
						state.studioMode === "music"
							? cloneSongProject(state.song)
							: state.musicProjectBackup,
					song: createBlankSfxProject("New Retro SFX"),
					loopMode: "once",
					scaleLockOnly: false,
					selectedChannelIndex: 0,
					selectedBarIndex: 0,
					playbackBar: 0,
					playbackStep: 0,
					isPlaying: false,
				}));
			},

			generateSfxPattern: (archetype = "random"): void => {
				set((state) => {
					const activeChannel = state.song.channels[state.selectedChannelIndex];
					if (!activeChannel) {
						return state;
					}
					const stepsPerBar = getStepsPerBar(state.song);
					const generatedNotes = generateProceduralSfxNotes(
						archetype,
						activeChannel.type,
						stepsPerBar
					);

					let baseSong = state.song;
					if (archetype !== "random" && activeChannel.type === "pitch") {
						const presetId = SFX_ARCHETYPE_PRESET_MAP[archetype];
						const preset = getPresetConfigurationById(presetId);
						baseSong = {
							...baseSong,
							channels: baseSong.channels.map((channel, index) =>
								index === state.selectedChannelIndex
									? {
											...channel,
											instrument: { ...preset.configuration },
										}
									: channel
							),
						};
					}

					return {
						song: updateChannelPatternNotes(
							baseSong,
							state.selectedChannelIndex,
							state.selectedBarIndex,
							() => generatedNotes
						),
					};
				});
			},

			loadDemoSong: (demoId): void => {
				set((state) => {
					const found = DEMO_SONGS.find((demo) => demo.id === demoId);
					const target = cloneSongProject(
						found ?? DEMO_SONGS[0] ?? createBlankSongProject("Demo Song")
					);
					return {
						studioMode: "music",
						sfxProjectBackup:
							state.studioMode === "sfx"
								? cloneSongProject(state.song)
								: state.sfxProjectBackup,
						song: { ...target, id: `song-${Date.now()}` },
						loopMode: "song",
						scaleLockOnly: true,
						selectedChannelIndex: 0,
						selectedBarIndex: 0,
						playbackBar: 0,
						playbackStep: 0,
						isPlaying: false,
					};
				});
			},

			createNewProject: (): void => {
				set((state) => ({
					song:
						state.studioMode === "sfx"
							? createBlankSfxProject("New Retro SFX")
							: createBlankSongProject("New Chiptune"),
					selectedChannelIndex: 0,
					selectedBarIndex: 0,
					playbackBar: 0,
					playbackStep: 0,
					isPlaying: false,
				}));
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

			resetEverything: (): void => {
				set({
					studioMode: "music",
					song: createBlankSongProject("New Chiptune"),
					musicProjectBackup: null,
					sfxProjectBackup: null,
					savedSongs: [],
					selectedChannelIndex: 0,
					selectedBarIndex: 0,
					activeWorkspaceTab: "all",
					activeTool: "draw",
					defaultNoteDuration: 2,
					pianoRollZoom: 1,
					scaleLockOnly: true,
					showGhostNotes: true,
					followPlayhead: true,
					isPlaying: false,
					loopMode: "song",
					playbackBar: 0,
					playbackStep: 0,
				});
			},
		}),
		{
			name: "ultrabeep-chiptune-store-v1",
			partialize: (state): PersistedChiptuneState => ({
				studioMode: state.studioMode,
				song: state.song,
				musicProjectBackup: state.musicProjectBackup,
				sfxProjectBackup: state.sfxProjectBackup,
				savedSongs: state.savedSongs,
				scaleLockOnly: state.scaleLockOnly,
				showGhostNotes: state.showGhostNotes,
				defaultNoteDuration: state.defaultNoteDuration,
				followPlayhead: state.followPlayhead,
			}),
			onRehydrateStorage:
				(): ((state?: ChiptuneStoreState) => void) =>
				(state): void => {
					if (state?.song.id === "demo-neon-dungeon" && DEMO_SONGS[0]) {
						state.song = cloneSongProject(DEMO_SONGS[0]);
					}
				},
		}
	)
);

export type { MusicalKey, ScaleType };

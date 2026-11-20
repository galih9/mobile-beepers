import {
	BoltIcon,
	CheckCircleIcon,
	FolderOpenIcon,
	MagnifyingGlassIcon,
	MusicalNoteIcon,
	PlayIcon,
	SparklesIcon,
	XMarkIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { FunctionComponent } from "../../../common/types";
import {
	DEMO_SONG_CATEGORIES,
	DEMO_SONGS,
	getDemoSongMetadata,
	type DemoSongCategory,
} from "../constants/demoSongs";
import { SCALE_DEFINITIONS } from "../constants/scalesAndNotes";
import { SFX_PRESETS } from "../constants/sfxPresets";
import { useChiptuneStore } from "../store/useChiptuneStore";
import type { SfxCategory, SongProject } from "../types/music";

export type DemoBrowserTab = "demos" | "sfx";

interface DemoSongBrowserDialogProps {
	isOpen: boolean;
	initialTab: DemoBrowserTab;
	onClose: () => void;
}

const SFX_CATEGORIES: Array<{ id: "all" | SfxCategory; label: string }> = [
	{ id: "all", label: "All SFX" },
	{ id: "combat", label: "Combat" },
	{ id: "feedback", label: "Feedback" },
	{ id: "jingle", label: "Jingles" },
];

const formatLoopDuration = (project: SongProject): string => {
	const loopBars = Math.max(
		1,
		(project.loopEndBar ?? project.totalBars - 1) -
			(project.loopStartBar ?? 0) +
			1
	);
	const totalSeconds = Math.round(
		(loopBars * project.beatsPerBar * 60) / Math.max(1, project.bpm)
	);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

export const DemoSongBrowserDialog = ({
	isOpen,
	initialTab,
	onClose,
}: DemoSongBrowserDialogProps): FunctionComponent => {
	const titleId = useId();
	const searchInputId = useId();
	const dialogRef = useRef<HTMLDialogElement | null>(null);

	const [selectedTab, setSelectedTab] = useState<DemoBrowserTab | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedDemoCategory, setSelectedDemoCategory] = useState<
		"all" | DemoSongCategory
	>("all");
	const [selectedSfxCategory, setSelectedSfxCategory] = useState<
		"all" | SfxCategory
	>("all");

	const activeTab = selectedTab ?? initialTab;

	const currentSongTitle = useChiptuneStore((state) => state.song.title);
	const loadDemoSong = useChiptuneStore((state) => state.loadDemoSong);
	const loadSfxPreset = useChiptuneStore((state) => state.loadSfxPreset);
	const setIsPlaying = useChiptuneStore((state) => state.setIsPlaying);

	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) {
			return;
		}
		if (isOpen && !dialog.open) {
			dialog.showModal();
		} else if (!isOpen && dialog.open) {
			dialog.close();
		}
	}, [isOpen]);

	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) {
			return;
		}

		const handleNativeClose = (): void => {
			dialog.returnValue = "";
			setSelectedTab(null);
			onClose();
		};

		dialog.addEventListener("close", handleNativeClose);

		// Fallback light-dismiss when native closedby="any" is unsupported (e.g. Safari)
		if (!("closedBy" in HTMLDialogElement.prototype)) {
			let pressedOutside = false;
			const isPointerOutside = (event: PointerEvent): boolean => {
				const rectangle = dialog.getBoundingClientRect();
				return (
					event.clientX < rectangle.left ||
					event.clientX > rectangle.right ||
					event.clientY < rectangle.top ||
					event.clientY > rectangle.bottom
				);
			};

			const handlePointerDown = (event: PointerEvent): void => {
				pressedOutside = isPointerOutside(event);
			};
			const handlePointerUp = (event: PointerEvent): void => {
				if (pressedOutside && isPointerOutside(event)) {
					dialog.close();
				}
			};

			dialog.addEventListener("pointerdown", handlePointerDown);
			dialog.addEventListener("pointerup", handlePointerUp);
			return (): void => {
				dialog.removeEventListener("close", handleNativeClose);
				dialog.removeEventListener("pointerdown", handlePointerDown);
				dialog.removeEventListener("pointerup", handlePointerUp);
			};
		}

		return (): void => {
			dialog.removeEventListener("close", handleNativeClose);
		};
	}, [onClose]);

	const normalizedQuery = searchQuery.trim().toLowerCase();

	const filteredDemos = useMemo(() => {
		return DEMO_SONGS.filter((demo) => {
			const metadata = getDemoSongMetadata(demo.id);
			if (
				selectedDemoCategory !== "all" &&
				metadata.category !== selectedDemoCategory
			) {
				return false;
			}
			if (!normalizedQuery) {
				return true;
			}
			const scaleLabel = SCALE_DEFINITIONS[demo.scale]?.label ?? demo.scale;
			const searchableText = [
				demo.title,
				metadata.badge,
				metadata.description,
				`${demo.bpm} bpm`,
				`${demo.rootKey} ${scaleLabel}`,
				...demo.channels.map((channel) => channel.name),
			]
				.join(" ")
				.toLowerCase();
			return searchableText.includes(normalizedQuery);
		});
	}, [normalizedQuery, selectedDemoCategory]);

	const filteredSfx = useMemo(() => {
		return SFX_PRESETS.filter((preset) => {
			if (
				selectedSfxCategory !== "all" &&
				preset.category !== selectedSfxCategory
			) {
				return false;
			}
			if (!normalizedQuery) {
				return true;
			}
			const searchableText = [
				preset.title,
				preset.badge,
				preset.category,
				preset.description,
				`${preset.project.bpm} bpm`,
			]
				.join(" ")
				.toLowerCase();
			return searchableText.includes(normalizedQuery);
		});
	}, [normalizedQuery, selectedSfxCategory]);

	const demoCategoryCounts = useMemo(() => {
		const counts: Record<"all" | DemoSongCategory, number> = {
			all: DEMO_SONGS.length,
			battle: 0,
			electronic: 0,
			adventure: 0,
			dungeon: 0,
		};
		for (const demo of DEMO_SONGS) {
			const category = getDemoSongMetadata(demo.id).category;
			counts[category] += 1;
		}
		return counts;
	}, []);

	const sfxCategoryCounts = useMemo(() => {
		const counts: Record<"all" | SfxCategory, number> = {
			all: SFX_PRESETS.length,
			combat: 0,
			feedback: 0,
			jingle: 0,
		};
		for (const preset of SFX_PRESETS) {
			counts[preset.category] += 1;
		}
		return counts;
	}, []);

	const handleSelectDemo = (demoId: string, autoPlay: boolean): void => {
		loadDemoSong(demoId);
		dialogRef.current?.close();
		if (autoPlay) {
			setIsPlaying(true);
		}
	};

	const handleSelectSfx = (presetId: string, autoPlay: boolean): void => {
		loadSfxPreset(presetId);
		dialogRef.current?.close();
		if (autoPlay) {
			setIsPlaying(true);
		}
	};

	const visibleCount =
		activeTab === "demos" ? filteredDemos.length : filteredSfx.length;
	const totalCount =
		activeTab === "demos" ? DEMO_SONGS.length : SFX_PRESETS.length;

	return (
		<dialog
			ref={dialogRef}
			aria-labelledby={titleId}
			className="m-auto h-[min(92dvh,48rem)] w-[min(96vw,60rem)] overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900 p-0 text-slate-100 shadow-2xl open:flex open:flex-col"
			{...({ closedby: "any" } as Record<string, string>)}
		>
			{/* Top Page Header */}
			<div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/90 px-4 py-3.5 sm:px-6">
				<div className="flex items-center gap-3">
					<div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/15 text-cyan-300">
						<MusicalNoteIcon aria-hidden="true" className="size-5" />
					</div>
					<div>
						<h2 className="text-base font-bold text-white sm:text-lg" id={titleId}>
							Demo Song &amp; SFX Library
						</h2>
						<p className="text-xs text-slate-400">
							Explore full multi-channel chiptune compositions and retro sound
							effects — all synthesized offline.
						</p>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<div
						aria-label="Library section"
						className="flex items-center rounded-xl border border-slate-800 bg-slate-900 p-1"
						role="group"
					>
						<button
							aria-pressed={activeTab === "demos"}
							type="button"
							className={`inline-flex h-7 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition ${
								activeTab === "demos"
									? "bg-cyan-500/25 text-cyan-200"
									: "text-slate-400 hover:text-white"
							}`}
							onClick={(): void => {
								setSelectedTab("demos");
							}}
						>
							<MusicalNoteIcon aria-hidden="true" className="size-3.5" />
							<span>Demo Songs</span>
							<span className="rounded-full bg-slate-950/70 px-1.5 py-0.5 font-mono text-[10px]">
								{DEMO_SONGS.length}
							</span>
						</button>
						<button
							aria-pressed={activeTab === "sfx"}
							type="button"
							className={`inline-flex h-7 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition ${
								activeTab === "sfx"
									? "bg-amber-500/25 text-amber-200"
									: "text-slate-400 hover:text-white"
							}`}
							onClick={(): void => {
								setSelectedTab("sfx");
							}}
						>
							<BoltIcon aria-hidden="true" className="size-3.5" />
							<span>Retro SFX</span>
							<span className="rounded-full bg-slate-950/70 px-1.5 py-0.5 font-mono text-[10px]">
								{SFX_PRESETS.length}
							</span>
						</button>
					</div>

					<form method="dialog">
						<button
							aria-label="Close demo song library"
							className="flex size-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-300 transition hover:border-slate-500 hover:text-white"
							type="submit"
							value="close"
						>
							<XMarkIcon aria-hidden="true" className="size-4" />
						</button>
					</form>
				</div>
			</div>

			{/* Search & Category Filter Toolbar */}
			<div className="flex shrink-0 flex-col gap-2.5 border-b border-slate-800 bg-slate-900/95 px-4 py-3 sm:px-6">
				<div className="relative">
					<MagnifyingGlassIcon
						aria-hidden="true"
						className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
					/>
					<label className="sr-only" htmlFor={searchInputId}>
						{activeTab === "demos"
							? "Search demo songs"
							: "Search retro SFX presets"}
					</label>
					<input
						autoFocus
						className="h-9 w-full rounded-xl border border-slate-700 bg-slate-950 pr-16 pl-9 text-xs font-medium text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
						id={searchInputId}
						type="search"
						value={searchQuery}
						placeholder={
							activeTab === "demos"
								? "Search by title, genre, key, BPM, or instrument..."
								: "Search retro SFX & jingles..."
						}
						onChange={(event): void => {
							setSearchQuery(event.target.value);
						}}
					/>
					{searchQuery && (
						<button
							className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md px-2 py-0.5 text-[11px] font-semibold text-slate-400 hover:bg-slate-800 hover:text-white"
							type="button"
							onClick={(): void => {
								setSearchQuery("");
							}}
						>
							Clear
						</button>
					)}
				</div>

				<div
					aria-label="Filter by category"
					className="flex flex-wrap items-center gap-1.5"
					role="group"
				>
					{activeTab === "demos"
						? DEMO_SONG_CATEGORIES.map((category) => {
								const isSelected = selectedDemoCategory === category.id;
								return (
									<button
										key={category.id}
										aria-pressed={isSelected}
										type="button"
										className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold transition ${
											isSelected
												? "border-cyan-400/70 bg-cyan-500/20 text-cyan-100"
												: "border-slate-700/80 bg-slate-950/70 text-slate-400 hover:border-slate-600 hover:text-slate-200"
										}`}
										onClick={(): void => {
											setSelectedDemoCategory(category.id);
										}}
									>
										<span>{category.label}</span>
										<span className="font-mono text-[10px] opacity-75">
											{demoCategoryCounts[category.id]}
										</span>
									</button>
								);
							})
						: SFX_CATEGORIES.map((category) => {
								const isSelected = selectedSfxCategory === category.id;
								return (
									<button
										key={category.id}
										aria-pressed={isSelected}
										type="button"
										className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold transition ${
											isSelected
												? "border-amber-400/70 bg-amber-500/20 text-amber-100"
												: "border-slate-700/80 bg-slate-950/70 text-slate-400 hover:border-slate-600 hover:text-slate-200"
										}`}
										onClick={(): void => {
											setSelectedSfxCategory(category.id);
										}}
									>
										<span>{category.label}</span>
										<span className="font-mono text-[10px] opacity-75">
											{sfxCategoryCounts[category.id]}
										</span>
									</button>
								);
							})}
				</div>
			</div>

			{/* Scrollable Catalog Grid */}
			<div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
				{activeTab === "demos" ? (
					filteredDemos.length === 0 ? (
						<div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-950/50 px-6 py-12 text-center">
							<p className="text-sm font-bold text-slate-200">
								No demo tracks match your filter.
							</p>
							<p className="mt-1 text-xs text-slate-400">
								Try clearing your search or switching back to All Tracks.
							</p>
							<button
								className="mt-4 rounded-xl border border-cyan-500/40 bg-cyan-500/15 px-3.5 py-1.5 text-xs font-bold text-cyan-200 hover:bg-cyan-500/25"
								type="button"
								onClick={(): void => {
									setSearchQuery("");
									setSelectedDemoCategory("all");
								}}
							>
								Reset Filters
							</button>
						</div>
					) : (
						<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
							{filteredDemos.map((demo) => {
								const metadata = getDemoSongMetadata(demo.id);
								const isLoaded = currentSongTitle === demo.title;
								const scaleLabel =
									SCALE_DEFINITIONS[demo.scale]?.label ?? demo.scale;
								const durationLabel = formatLoopDuration(demo);
								const loopBars =
									(demo.loopEndBar ?? demo.totalBars - 1) -
									(demo.loopStartBar ?? 0) +
									1;

								return (
									<article
										key={demo.id}
										className={`group flex flex-col justify-between rounded-2xl border p-4 transition ${
											isLoaded
												? "border-cyan-400/70 bg-cyan-950/20 shadow-[0_0_24px_rgba(0,199,255,0.12)]"
												: metadata.featured
													? "border-rose-500/50 bg-gradient-to-br from-rose-950/30 via-slate-950/90 to-slate-950 hover:border-rose-400/80"
													: "border-slate-800 bg-slate-950/80 hover:border-slate-600"
										}`}
									>
										<div>
											<div className="flex items-start justify-between gap-2">
												<div className="min-w-0">
													<div className="flex flex-wrap items-center gap-1.5">
														<span
															className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide"
															style={{
																backgroundColor: `${metadata.accentColor}22`,
																color: metadata.accentColor,
																border: `1px solid ${metadata.accentColor}55`,
															}}
														>
															{metadata.featured && (
																<SparklesIcon
																	aria-hidden="true"
																	className="size-3"
																/>
															)}
															<span>{metadata.badge}</span>
														</span>
														{isLoaded && (
															<span className="inline-flex items-center gap-1 rounded-md border border-cyan-400/50 bg-cyan-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-cyan-200">
																<CheckCircleIcon
																	aria-hidden="true"
																	className="size-3"
																/>
																<span>Active</span>
															</span>
														)}
													</div>
													<h3 className="mt-2 truncate text-sm font-bold text-white sm:text-base">
														{demo.title}
													</h3>
												</div>
												<div className="shrink-0 rounded-lg border border-slate-800 bg-slate-900/90 px-2 py-1 text-right font-mono">
													<div className="text-xs font-bold text-amber-300">
														{demo.bpm} BPM
													</div>
													<div className="text-[10px] text-slate-400">
														{durationLabel}
													</div>
												</div>
											</div>

											<p className="mt-2 text-xs leading-relaxed text-slate-300">
												{metadata.description}
											</p>

											<div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-slate-400">
												<span className="text-violet-300">
													{demo.rootKey} {scaleLabel}
												</span>
												<span aria-hidden="true" className="text-slate-600">
													·
												</span>
												<span>{loopBars} Bars</span>
												<span aria-hidden="true" className="text-slate-600">
													·
												</span>
												<span>{demo.channels.length} Channels</span>
											</div>

											<div className="mt-2.5 flex flex-wrap gap-1.5">
												{demo.channels.map((channel) => (
													<span
														key={channel.id}
														className="inline-flex items-center gap-1 rounded-md border border-slate-800 bg-slate-900/80 px-2 py-0.5 text-[10px] font-medium text-slate-300"
													>
														<span
															aria-hidden="true"
															className="size-1.5 rounded-full"
															style={{ backgroundColor: channel.color }}
														/>
														<span>{channel.name}</span>
													</span>
												))}
											</div>
										</div>

										<div className="mt-4 flex items-center gap-2 border-t border-slate-800/80 pt-3">
											<button
												className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-xl bg-cyan-400 px-3 text-xs font-bold text-slate-950 transition hover:bg-cyan-300 active:scale-[0.98]"
												type="button"
												onClick={(): void => {
													handleSelectDemo(demo.id, true);
												}}
											>
												<PlayIcon
													aria-hidden="true"
													className="size-3.5 fill-current"
												/>
												<span>Load &amp; Play</span>
											</button>
											<button
												className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs font-semibold text-slate-200 transition hover:border-cyan-400/60 hover:text-white"
												type="button"
												onClick={(): void => {
													handleSelectDemo(demo.id, false);
												}}
											>
												<FolderOpenIcon
													aria-hidden="true"
													className="size-3.5 text-cyan-300"
												/>
												<span>Load</span>
											</button>
										</div>
									</article>
								);
							})}
						</div>
					)
				) : filteredSfx.length === 0 ? (
					<div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-950/50 px-6 py-12 text-center">
						<p className="text-sm font-bold text-slate-200">
							No retro SFX presets match your filter.
						</p>
						<button
							className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/15 px-3.5 py-1.5 text-xs font-bold text-amber-200 hover:bg-amber-500/25"
							type="button"
							onClick={(): void => {
								setSearchQuery("");
								setSelectedSfxCategory("all");
							}}
						>
							Reset Filters
						</button>
					</div>
				) : (
					<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
						{filteredSfx.map((preset) => {
							const isLoaded = currentSongTitle === preset.title;
							return (
								<article
									key={preset.id}
									className={`flex flex-col justify-between rounded-2xl border p-4 transition ${
										isLoaded
											? "border-amber-400/70 bg-amber-950/20"
											: "border-slate-800 bg-slate-950/80 hover:border-slate-600"
									}`}
								>
									<div>
										<div className="flex items-start justify-between gap-2">
											<div className="min-w-0">
												<div className="flex items-center gap-1.5">
													<span className="rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-amber-200">
														{preset.badge}
													</span>
													<span className="rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 font-mono text-[10px] font-semibold capitalize text-slate-300">
														{preset.category}
													</span>
													{isLoaded && (
														<span className="inline-flex items-center gap-1 rounded-md border border-amber-400/50 bg-amber-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-100">
															<CheckCircleIcon
																aria-hidden="true"
																className="size-3"
															/>
															<span>Active</span>
														</span>
													)}
												</div>
												<h3 className="mt-2 truncate text-sm font-bold text-white">
													{preset.title}
												</h3>
											</div>
											<div className="shrink-0 rounded-lg border border-slate-800 bg-slate-900/90 px-2 py-1 text-right font-mono">
												<div className="text-xs font-bold text-amber-300">
													{preset.project.bpm} BPM
												</div>
												<div className="text-[10px] text-slate-400">
													{preset.project.totalBars === 1
														? "1 Bar"
														: `${preset.project.totalBars} Bars`}
												</div>
											</div>
										</div>
										<p className="mt-2 text-xs leading-relaxed text-slate-300">
											{preset.description}
										</p>
									</div>

									<div className="mt-4 flex items-center gap-2 border-t border-slate-800/80 pt-3">
										<button
											className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-xl bg-amber-400 px-3 text-xs font-bold text-slate-950 transition hover:bg-amber-300 active:scale-[0.98]"
											type="button"
											onClick={(): void => {
												handleSelectSfx(preset.id, true);
											}}
										>
											<PlayIcon
												aria-hidden="true"
												className="size-3.5 fill-current"
											/>
											<span>Load &amp; Play</span>
										</button>
										<button
											className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs font-semibold text-slate-200 transition hover:border-amber-400/60 hover:text-white"
											type="button"
											onClick={(): void => {
												handleSelectSfx(preset.id, false);
											}}
										>
											<FolderOpenIcon
												aria-hidden="true"
												className="size-3.5 text-amber-300"
											/>
											<span>Load</span>
										</button>
									</div>
								</article>
							);
						})}
					</div>
				)}
			</div>

			{/* Footer Status Strip */}
			<div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-800 bg-slate-950/90 px-4 py-2.5 text-xs sm:px-6">
				<div className="flex min-w-0 items-center gap-2 text-slate-400">
					<span className="shrink-0 font-mono text-[11px] font-semibold text-slate-300">
						Showing {visibleCount} of {totalCount}
					</span>
					<span aria-hidden="true" className="hidden text-slate-600 sm:inline">
						·
					</span>
					<span className="hidden truncate text-[11px] sm:inline">
						Loaded:{" "}
						<strong className="font-semibold text-cyan-300">
							{currentSongTitle}
						</strong>
					</span>
				</div>
				<form method="dialog">
					<button
						className="inline-flex h-8 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 px-3.5 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
						type="submit"
						value="close"
					>
						Close
					</button>
				</form>
			</div>
		</dialog>
	);
};

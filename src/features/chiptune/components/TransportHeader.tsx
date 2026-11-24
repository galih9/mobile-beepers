import {
	ArrowPathIcon,
	ArrowPathRoundedSquareIcon,
	ArrowUturnLeftIcon,
	ArrowUturnRightIcon,
	BoltIcon,
	ClockIcon,
	Cog6ToothIcon,
	FolderOpenIcon,
	CpuChipIcon,
	PauseIcon,
	PlayIcon,
	PlusIcon,
	QueueListIcon,
	SparklesIcon,
	SpeakerWaveIcon,
	TrashIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useRef } from "react";
import type { FunctionComponent } from "../../../common/types";
import { DEMO_SONGS, MODERN_DEMO_SONGS } from "../constants/demoSongs";
import { MAX_SONG_BARS } from "../constants/limits";
import { SCALE_DEFINITIONS } from "../constants/scalesAndNotes";
import { SFX_PRESETS } from "../constants/sfxPresets";
import { useChiptuneStore } from "../store/useChiptuneStore";
import type { LoopMode } from "../types/music";
import type { DemoBrowserTab } from "./DemoSongBrowserDialog";
import type { SettingsSection } from "./StudioSettingsDialog";
import { LcdReadout } from "./LcdReadout";

interface TransportHeaderProps {
	onOpenDemoBrowser: (initialTab?: DemoBrowserTab) => void;
	onOpenMetronomeModal: () => void;
	onOpenProjectModal: () => void;
	onOpenResetModal: () => void;
	onOpenSettings: (section?: SettingsSection) => void;
}

export const TransportHeader = ({
	onOpenDemoBrowser,
	onOpenMetronomeModal,
	onOpenProjectModal,
	onOpenResetModal,
	onOpenSettings,
}: TransportHeaderProps): FunctionComponent => {
	const volumeSliderRef = useRef<HTMLInputElement | null>(null);

	const song = useChiptuneStore((state) => state.song);
	const studioMode = useChiptuneStore((state) => state.studioMode);
	const isPlaying = useChiptuneStore((state) => state.isPlaying);
	const loopMode = useChiptuneStore((state) => state.loopMode);
	const followPlayhead = useChiptuneStore((state) => state.followPlayhead);
	const playbackBar = useChiptuneStore((state) => state.playbackBar);
	const playbackStep = useChiptuneStore((state) => state.playbackStep);
	const setIsPlaying = useChiptuneStore((state) => state.setIsPlaying);
	const setLoopMode = useChiptuneStore((state) => state.setLoopMode);
	const setFollowPlayhead = useChiptuneStore(
		(state) => state.setFollowPlayhead
	);
	const updateSongMetadata = useChiptuneStore(
		(state) => state.updateSongMetadata
	);
	const canUndo = useChiptuneStore((state) => state.canUndo);
	const canRedo = useChiptuneStore((state) => state.canRedo);
	const undo = useChiptuneStore((state) => state.undo);
	const redo = useChiptuneStore((state) => state.redo);
	const setTotalBars = useChiptuneStore((state) => state.setTotalBars);
	const metronomeEnabled = useChiptuneStore((state) => state.metronomeEnabled);
	const toggleMetronome = useChiptuneStore((state) => state.toggleMetronome);
	const show = useChiptuneStore((state) => state.toolbarVisibility);

	useEffect(() => {
		const element = volumeSliderRef.current;
		if (!element) {
			return;
		}
		element.style.setProperty("--attr-min", "0.05");
		element.style.setProperty("--attr-max", "1");
		element.style.setProperty("--control-value", String(song.masterVolume));
	}, [song.masterVolume]);

	const scaleLabel = SCALE_DEFINITIONS[song.scale]?.label ?? song.scale;

	const modeBadge =
		studioMode === "modern"
			? {
					label: "Modern",
					icon: SparklesIcon,
					className:
						"border-violet-400/50 bg-violet-500/15 text-violet-200 hover:border-violet-300",
				}
			: studioMode === "sfx"
				? {
						label: "SFX",
						icon: BoltIcon,
						className:
							"border-amber-400/50 bg-amber-500/15 text-amber-200 hover:border-amber-300",
					}
				: {
						label: "Chiptune",
						icon: CpuChipIcon,
						className:
							"border-cyan-400/50 bg-cyan-500/15 text-cyan-200 hover:border-cyan-300",
					};
	const demoSongs = studioMode === "modern" ? MODERN_DEMO_SONGS : DEMO_SONGS;

	const nextLoopMode: LoopMode =
		loopMode === "song" ? "bar" : loopMode === "bar" ? "once" : "song";
	const loopButtonTitle =
		loopMode === "once"
			? "Play Once (1-Shot)"
			: loopMode === "bar"
				? "Loop Current Bar"
				: "Loop Song";
	const loopAriaLabel =
		loopMode === "once"
			? "Play once without looping"
			: loopMode === "bar"
				? "Looping active bar"
				: "Looping full song";
	const loopLabel =
		loopMode === "once" ? "1-Shot" : loopMode === "bar" ? "Bar" : "Song";
	const isMetronomeBeatFlash =
		isPlaying &&
		metronomeEnabled &&
		song.stepsPerBeat > 0 &&
		playbackStep % song.stepsPerBeat === 0;
	const isMetronomeAccentFlash = isMetronomeBeatFlash && playbackStep === 0;

	return (
		<header className="safe-top-bar studio-chrome-text no-scrollbar flex h-12 shrink-0 items-center justify-between gap-2 overflow-x-auto pb-1.5 md:h-14 md:gap-3 md:overflow-visible md:px-3">
			{/* Left: brand plate, Play key, mode + history wells, loop & follow */}
			<div className="flex shrink-0 items-center gap-1.5 md:gap-2">
				{show.brand && (
					<div
						aria-hidden="true"
						className="mr-1 hidden items-center gap-2 xl:flex"
						title="UltraBeep"
					>
						{/* Speaker grille slots */}
						<span className="flex -skew-x-12 gap-[3px]">
							{[0, 1, 2, 3].map((slot) => (
								<span
									key={slot}
									className="h-4 w-[3px] rounded-full bg-slate-800 shadow-[inset_0_1px_1px_var(--well-shadow)]"
								/>
							))}
						</span>
						<span className="-skew-x-6 text-[15px] leading-none font-bold tracking-tight text-slate-200">
							Ultra<span className="text-cyan-300">Beep</span>
						</span>
					</div>
				)}

				<button
					aria-label={isPlaying ? "Stop playback" : "Start playback"}
					type="button"
					className={`gear-key inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-bold ${
						isPlaying
							? "bg-rose-400 text-slate-950"
							: "bg-cyan-400 text-slate-950 hover:bg-cyan-300"
					}`}
					onClick={(): void => {
						setIsPlaying(!isPlaying);
					}}
				>
					{isPlaying ? (
						<PauseIcon aria-hidden="true" className="size-3.5 fill-current" />
					) : (
						<PlayIcon aria-hidden="true" className="size-3.5 fill-current" />
					)}
					<span>{isPlaying ? "Stop" : "Play"}</span>
				</button>

				{show.studioMode && (
					<button
						aria-label={`Mode: ${modeBadge.label}. Change the app mode in Settings`}
						className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-bold transition ${modeBadge.className}`}
						title="App mode — change it in Settings → Mode"
						type="button"
						onClick={(): void => {
							onOpenSettings("mode");
						}}
					>
						<modeBadge.icon aria-hidden="true" className="size-3.5" />
						<span className="hidden sm:inline">{modeBadge.label}</span>
					</button>
				)}

				{/* Undo & Redo History Controls */}
				{show.history && (
					<div
						aria-label="Undo and redo controls"
						className="flex items-center rounded-md border border-slate-800 bg-slate-900 p-0.5"
						role="group"
					>
						<button
							aria-label="Undo last edit"
							className="inline-flex h-6 items-center gap-1 rounded px-1.5 text-[11px] font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white disabled:pointer-events-none disabled:opacity-30"
							disabled={!canUndo}
							title="Undo (Ctrl+Z / ⌘Z)"
							type="button"
							onClick={undo}
						>
							<ArrowUturnLeftIcon aria-hidden="true" className="size-3" />
							<span className="hidden xl:inline">Undo</span>
						</button>
						<button
							aria-label="Redo last edit"
							className="inline-flex h-6 items-center gap-1 rounded px-1.5 text-[11px] font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white disabled:pointer-events-none disabled:opacity-30"
							disabled={!canRedo}
							title="Redo (Ctrl+Y / ⌘⇧Z)"
							type="button"
							onClick={redo}
						>
							<ArrowUturnRightIcon aria-hidden="true" className="size-3" />
							<span className="hidden xl:inline">Redo</span>
						</button>
					</div>
				)}

				{/* Metronome Click Toggle + BPM / Tap-Tempo Tool */}
				{show.metronome && (
					<div
						aria-label="Metronome and tempo controls"
						className="flex items-center rounded-md border border-slate-800 bg-slate-900 p-0.5"
						role="group"
					>
						<button
							aria-pressed={metronomeEnabled}
							title="Toggle metronome click during playback"
							type="button"
							aria-label={
								metronomeEnabled
									? "Disable metronome click during playback"
									: "Enable metronome click during playback"
							}
							className={`inline-flex h-6 items-center gap-1 rounded px-1.5 text-[11px] font-semibold transition ${
								metronomeEnabled
									? isMetronomeAccentFlash
										? "bg-amber-400 text-slate-950"
										: isMetronomeBeatFlash
											? "bg-cyan-400 text-slate-950"
											: "bg-cyan-500/20 text-cyan-200"
									: "text-slate-400 hover:bg-slate-800 hover:text-white"
							}`}
							onClick={toggleMetronome}
						>
							<ClockIcon aria-hidden="true" className="size-3.5" />
							<span className="hidden lg:inline">Click</span>
						</button>
						<button
							aria-label={`Open metronome, tap tempo, and BPM presets (${Math.round(song.bpm)} BPM)`}
							className="inline-flex h-6 items-center gap-0.5 rounded px-1.5 font-mono text-[11px] font-bold text-slate-200 transition hover:bg-slate-800 hover:text-cyan-200"
							title="Open Metronome, Tap Tempo & Genre BPM Presets"
							type="button"
							onClick={onOpenMetronomeModal}
						>
							<span>{Math.round(song.bpm)}</span>
							<span className="hidden text-[9px] text-slate-400 sm:inline">
								BPM
							</span>
						</button>
					</div>
				)}

				{show.loopMode && (
					<button
						aria-label={loopAriaLabel}
						title={loopButtonTitle}
						type="button"
						className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-semibold transition ${
							loopMode === "once"
								? "border-emerald-400/60 bg-emerald-500/15 text-emerald-300"
								: loopMode === "bar"
									? "border-amber-400/60 bg-amber-500/15 text-amber-300"
									: "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600"
						}`}
						onClick={(): void => {
							setLoopMode(nextLoopMode);
						}}
					>
						{loopMode === "once" ? (
							<BoltIcon aria-hidden="true" className="size-3.5" />
						) : loopMode === "bar" ? (
							<ArrowPathRoundedSquareIcon
								aria-hidden="true"
								className="size-3.5"
							/>
						) : (
							<ArrowPathIcon aria-hidden="true" className="size-3.5" />
						)}
						<span className="hidden sm:inline">{loopLabel}</span>
					</button>
				)}

				{show.follow && (
					<label
						htmlFor="follow-playhead-checkbox"
						title="Follow playhead ticks across bars during playback"
						className={`inline-flex h-7 min-h-[var(--target-size)] cursor-pointer items-center gap-1.5 rounded-md border px-2 text-[11px] font-semibold transition ${
							followPlayhead
								? "border-cyan-400/50 bg-cyan-500/15 text-cyan-200"
								: "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-slate-200"
						}`}
					>
						<input
							checked={followPlayhead}
							className="checkbox-custom text-cyan-300"
							id="follow-playhead-checkbox"
							type="checkbox"
							onChange={(event): void => {
								setFollowPlayhead(event.target.checked);
							}}
						/>
						<span className="hidden sm:inline">Follow</span>
					</label>
				)}
			</div>

			{/* Center: the LCD readout */}
			<div className="flex min-w-0 flex-1 justify-center">
				<LcdReadout
					bar={playbackBar + 1}
					bpm={song.bpm}
					isPlaying={isPlaying}
					keyLabel={`${song.rootKey} ${scaleLabel.toLowerCase()}`}
					loopMode={loopMode}
					metronomeEnabled={metronomeEnabled}
					step={playbackStep + 1}
					title={song.title}
				/>
			</div>

			{/* Master volume */}
			{show.masterVolume && (
				<div className="flex min-w-0 max-w-40 flex-1 items-center gap-1.5 md:w-28 md:flex-none lg:w-32">
					<SpeakerWaveIcon
						aria-hidden="true"
						className="size-3.5 shrink-0 text-cyan-400"
					/>
					<input
						ref={volumeSliderRef}
						aria-label="Master Volume"
						aria-valuetext={`${Math.round(song.masterVolume * 100)}%`}
						className="chip-slider"
						max={1}
						min={0.05}
						step={0.01}
						type="range"
						value={song.masterVolume}
						onChange={(event): void => {
							const parsed = Number.parseFloat(event.target.value);
							if (Number.isFinite(parsed)) {
								event.currentTarget.style.setProperty(
									"--control-value",
									event.target.value
								);
								updateSongMetadata({ masterVolume: parsed });
							}
						}}
					/>
				</div>
			)}

			{/* Right: Demo / SFX Library Modal Trigger + Bar Extender + File/WAV button */}
			<div className="flex shrink-0 items-center gap-1.5">
				{studioMode !== "sfx" ? (
					<>
						{show.demos && (
							<button
								aria-label="Open demo song library"
								className="inline-flex h-7 items-center gap-1.5 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2 text-[11px] font-semibold text-cyan-100 transition hover:border-cyan-400 hover:bg-cyan-500/20 hover:text-white"
								title={`Browse ${demoSongs.length} demo tracks`}
								type="button"
								onClick={(): void => {
									onOpenDemoBrowser("demos");
								}}
							>
								<QueueListIcon
									aria-hidden="true"
									className="size-3.5 shrink-0 text-cyan-300"
								/>
								<span className="max-w-32 truncate lg:max-w-40">Demos</span>
								<span className="hidden rounded bg-cyan-400/20 px-1 font-mono text-[10px] font-bold text-cyan-200 sm:inline">
									{demoSongs.length}
								</span>
							</button>
						)}

						{show.addBars && (
							<button
								aria-label="Add 4 bars to song length"
								className="hidden h-7 items-center gap-0.5 rounded-md border border-slate-700 bg-slate-900 px-2 text-[11px] font-semibold text-violet-300 hover:border-violet-400/50 hover:text-white disabled:opacity-40 lg:inline-flex"
								disabled={song.totalBars >= MAX_SONG_BARS}
								title="Extend song length by 4 bars"
								type="button"
								onClick={(): void => {
									setTotalBars(Math.min(MAX_SONG_BARS, song.totalBars + 4));
								}}
							>
								<PlusIcon aria-hidden="true" className="size-3" />
								<span>4 Bars</span>
							</button>
						)}
					</>
				) : (
					<>
						{show.demos && (
							<button
								aria-label="Open retro SFX library"
								className="inline-flex h-7 items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 text-[11px] font-semibold text-amber-100 transition hover:border-amber-400 hover:bg-amber-500/20 hover:text-white"
								title={`Browse ${SFX_PRESETS.length} retro SFX presets`}
								type="button"
								onClick={(): void => {
									onOpenDemoBrowser("sfx");
								}}
							>
								<QueueListIcon
									aria-hidden="true"
									className="size-3.5 shrink-0 text-amber-300"
								/>
								<span className="max-w-32 truncate">SFX Library</span>
								<span className="hidden rounded bg-amber-400/20 px-1 font-mono text-[10px] font-bold text-amber-200 sm:inline">
									{SFX_PRESETS.length}
								</span>
							</button>
						)}

						{show.addBars && (
							<button
								aria-label="Add 1 bar to SFX length"
								className="hidden h-7 items-center gap-0.5 rounded-md border border-slate-700 bg-slate-900 px-2 text-[11px] font-semibold text-amber-300 hover:border-amber-400/50 hover:text-white disabled:opacity-40 lg:inline-flex"
								disabled={song.totalBars >= 8}
								title="Extend short SFX track by 1 bar"
								type="button"
								onClick={(): void => {
									setTotalBars(Math.min(8, song.totalBars + 1));
								}}
							>
								<PlusIcon aria-hidden="true" className="size-3" />
								<span>1 Bar</span>
							</button>
						)}
					</>
				)}

				<button
					aria-label="Open song settings, library, and export"
					className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs font-semibold text-slate-200 hover:border-cyan-400/60 hover:text-white"
					type="button"
					onClick={onOpenProjectModal}
				>
					<FolderOpenIcon
						aria-hidden="true"
						className="size-3.5 text-cyan-400"
					/>
					<span className="hidden sm:inline">File / Export</span>
					<span className="sm:hidden">File</span>
				</button>

				{show.reset && (
					<button
						aria-label="Reset or delete project"
						className="inline-flex h-7 items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/10 px-2 text-xs font-semibold text-rose-200 hover:border-rose-400 hover:bg-rose-500/20 hover:text-white"
						title="Reset song or delete all saved projects"
						type="button"
						onClick={onOpenResetModal}
					>
						<TrashIcon aria-hidden="true" className="size-3.5 text-rose-400" />
						<span className="hidden sm:inline">Reset</span>
					</button>
				)}

				<button
					aria-label="Open settings: mode, theme and toolbar"
					className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs font-semibold text-slate-200 hover:border-cyan-400/60 hover:text-white"
					title="Settings — app mode, theme, toolbar buttons, editor options"
					type="button"
					onClick={(): void => {
						onOpenSettings();
					}}
				>
					<Cog6ToothIcon
						aria-hidden="true"
						className="size-3.5 text-cyan-400"
					/>
					<span className="hidden lg:inline">Settings</span>
				</button>
			</div>
		</header>
	);
};

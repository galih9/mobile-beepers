import {
	ArrowPathIcon,
	ArrowPathRoundedSquareIcon,
	FolderOpenIcon,
	PauseIcon,
	PlayIcon,
	PlusIcon,
	SpeakerWaveIcon,
	TrashIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useRef, type CSSProperties } from "react";
import type { FunctionComponent } from "../../../common/types";
import { DEMO_SONGS } from "../constants/demoSongs";
import { SCALE_DEFINITIONS } from "../constants/scalesAndNotes";
import { useChiptuneStore } from "../store/useChiptuneStore";

interface TransportHeaderProps {
	onOpenProjectModal: () => void;
	onOpenResetModal: () => void;
}

const formatTwoDigits = (value: number): string => {
	return String(value).padStart(2, "0");
};

export const TransportHeader = ({
	onOpenProjectModal,
	onOpenResetModal,
}: TransportHeaderProps): FunctionComponent => {
	const volumeSliderRef = useRef<HTMLInputElement | null>(null);

	const song = useChiptuneStore((state) => state.song);
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
	const loadDemoSong = useChiptuneStore((state) => state.loadDemoSong);
	const setTotalBars = useChiptuneStore((state) => state.setTotalBars);

	useEffect(() => {
		const element = volumeSliderRef.current;
		if (!element) {
			return;
		}
		element.style.setProperty("--attr-min", "0.05");
		element.style.setProperty("--attr-max", "1");
		element.style.setProperty("--control-value", String(song.masterVolume));
	}, [song.masterVolume]);

	const sliderStyle = { "--slider-accent": "#00c7ff" } as CSSProperties;
	const matchedDemoId =
		DEMO_SONGS.find((demo) => demo.title === song.title)?.id ?? "";
	const scaleLabel = SCALE_DEFINITIONS[song.scale]?.label ?? song.scale;

	return (
		<header className="safe-top-bar studio-chrome-text flex h-11 shrink-0 items-center justify-between gap-2 border-b border-slate-800 bg-slate-950 pb-1.5 md:h-12 md:px-3">
			{/* Left: Play/Stop + Loop + Tablet/Desktop LED Transport Counter */}
			<div className="flex shrink-0 items-center gap-1.5 md:gap-2">
				<button
					aria-label={isPlaying ? "Stop playback" : "Start playback"}
					type="button"
					className={`inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-xs font-bold tracking-wide transition active:scale-95 ${
						isPlaying
							? "bg-rose-500 text-white"
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

				<button
					title={loopMode === "song" ? "Loop Song" : "Loop Current Bar"}
					type="button"
					aria-label={
						loopMode === "song" ? "Looping full song" : "Looping active bar"
					}
					className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-semibold transition ${
						loopMode === "bar"
							? "border-amber-400/60 bg-amber-500/15 text-amber-300"
							: "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600"
					}`}
					onClick={(): void => {
						setLoopMode(loopMode === "song" ? "bar" : "song");
					}}
				>
					{loopMode === "bar" ? (
						<ArrowPathRoundedSquareIcon
							aria-hidden="true"
							className="size-3.5"
						/>
					) : (
						<ArrowPathIcon aria-hidden="true" className="size-3.5" />
					)}
					<span className="hidden sm:inline">
						{loopMode === "bar" ? "Bar" : "Song"}
					</span>
				</button>

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

				{/* Live LED Transport Status Badge on Tablet & Desktop */}
				<div
					aria-label="Transport readout"
					className="hidden items-center gap-2 rounded-md border border-slate-800 bg-black/80 px-2.5 py-1 font-mono text-[11px] font-bold md:flex"
				>
					<span
						aria-hidden="true"
						className={`size-2 rounded-full ${
							isPlaying
								? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]"
								: "bg-slate-600"
						}`}
					/>
					<span className="text-cyan-300">
						BAR {formatTwoDigits(playbackBar + 1)} · STEP{" "}
						{formatTwoDigits(playbackStep + 1)}
					</span>
					<span className="text-slate-600">|</span>
					<span className="text-amber-300">{Math.round(song.bpm)} BPM</span>
					<span className="hidden text-slate-600 lg:inline">|</span>
					<span className="hidden text-violet-300 lg:inline">
						{song.rootKey} {scaleLabel}
					</span>
				</div>
			</div>

			{/* Center: Inline Master Volume Slider */}
			<div className="flex min-w-0 max-w-44 flex-1 items-center gap-1.5 md:max-w-52">
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
					style={sliderStyle}
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

			{/* Right: Desktop Quick Demo Switcher + Bar Extender + File/WAV button */}
			<div className="flex shrink-0 items-center gap-1.5">
				<div className="hidden items-center gap-1.5 lg:flex">
					<select
						aria-label="Quick load demo song"
						className="h-7 max-w-44 rounded-md border border-slate-700 bg-slate-900 px-2 text-[11px] font-semibold text-slate-200 hover:border-slate-600"
						value={matchedDemoId}
						onChange={(event): void => {
							if (event.target.value) {
								loadDemoSong(event.target.value);
							}
						}}
					>
						<option value="">Load Demo Track...</option>
						{DEMO_SONGS.map((demo) => (
							<option key={demo.id} value={demo.id}>
								{demo.title}
							</option>
						))}
					</select>

					<button
						aria-label="Add 4 bars to song length"
						className="inline-flex h-7 items-center gap-0.5 rounded-md border border-slate-700 bg-slate-900 px-2 text-[11px] font-semibold text-violet-300 hover:border-violet-400/50 hover:text-white disabled:opacity-40"
						disabled={song.totalBars >= 32}
						title="Extend song length by 4 bars"
						type="button"
						onClick={(): void => {
							setTotalBars(Math.min(32, song.totalBars + 4));
						}}
					>
						<PlusIcon aria-hidden="true" className="size-3" />
						<span>4 Bars</span>
					</button>
				</div>

				<span className="hidden max-w-36 truncate font-mono text-[11px] font-semibold text-slate-300 md:inline lg:hidden">
					{song.title}
				</span>

				<button
					aria-label="Open demos, song settings, and export"
					className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs font-semibold text-slate-200 hover:border-cyan-400/60 hover:text-white"
					type="button"
					onClick={onOpenProjectModal}
				>
					<FolderOpenIcon
						aria-hidden="true"
						className="size-3.5 text-cyan-400"
					/>
					<span>File / WAV</span>
				</button>

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
			</div>
		</header>
	);
};

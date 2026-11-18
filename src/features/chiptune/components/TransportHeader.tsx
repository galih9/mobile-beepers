import {
	ArrowPathIcon,
	ArrowPathRoundedSquareIcon,
	FolderOpenIcon,
	PauseIcon,
	PlayIcon,
	SpeakerWaveIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useRef, type CSSProperties } from "react";
import type { FunctionComponent } from "../../../common/types";
import { useChiptuneStore } from "../store/useChiptuneStore";

interface TransportHeaderProps {
	onOpenProjectModal: () => void;
}

export const TransportHeader = ({
	onOpenProjectModal,
}: TransportHeaderProps): FunctionComponent => {
	const volumeSliderRef = useRef<HTMLInputElement | null>(null);

	const song = useChiptuneStore((state) => state.song);
	const isPlaying = useChiptuneStore((state) => state.isPlaying);
	const loopMode = useChiptuneStore((state) => state.loopMode);
	const playbackBar = useChiptuneStore((state) => state.playbackBar);
	const setIsPlaying = useChiptuneStore((state) => state.setIsPlaying);
	const setLoopMode = useChiptuneStore((state) => state.setLoopMode);
	const updateSongMetadata = useChiptuneStore(
		(state) => state.updateSongMetadata
	);

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

	return (
		<header className="safe-top-bar studio-chrome-text flex h-11 shrink-0 items-center justify-between gap-2 border-b border-slate-800 bg-slate-950 pb-1.5">
			{/* Left: Play/Stop + Loop */}
			<div className="flex shrink-0 items-center gap-1.5">
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
			</div>

			{/* Center: Inline Master Volume Slider */}
			<div className="flex min-w-0 max-w-44 flex-1 items-center gap-1.5">
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

			{/* Right: Title readout + File/Export button */}
			<div className="flex shrink-0 items-center gap-1.5">
				<span className="hidden max-w-36 truncate font-mono text-[11px] font-semibold text-slate-300 md:inline">
					{song.title} · B{playbackBar + 1}
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
			</div>
		</header>
	);
};

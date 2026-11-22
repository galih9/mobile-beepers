import { PlusIcon } from "@heroicons/react/24/outline";
import { useEffect, useRef, useState } from "react";
import type { FunctionComponent } from "../../../common/types";
import { chiptunePlaybackEngine } from "../audio/playbackEngine";
import { useChiptuneStore } from "../store/useChiptuneStore";
import { InstrumentSlidersSection } from "./InstrumentSlidersSection";
import { ModernInstrumentSection } from "./ModernInstrumentSection";
import { SongSlidersSection } from "./SongSlidersSection";
import { useCanvasPalette } from "./useCanvasPalette";

interface ToneWaveformMonitorProps {
	accentColor: string;
	isPlaying: boolean;
}

const ToneWaveformMonitor = ({
	accentColor,
	isPlaying,
}: ToneWaveformMonitorProps): FunctionComponent => {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const { scopeBackground, scopeGrid, scopeTrace } = useCanvasPalette();
	const traceColor = scopeTrace ?? accentColor;

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) {
			return;
		}
		const context = canvas.getContext("2d");
		if (!context) {
			return;
		}

		const samples = new Float32Array(256);
		let animationFrameId = 0;

		const renderFrame = (): void => {
			chiptunePlaybackEngine.getWaveformData(samples);

			const logicalWidth = canvas.clientWidth || 280;
			const logicalHeight = canvas.clientHeight || 44;
			const pixelRatio = window.devicePixelRatio || 1;
			const targetWidth = Math.floor(logicalWidth * pixelRatio);
			const targetHeight = Math.floor(logicalHeight * pixelRatio);

			if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
				canvas.width = targetWidth;
				canvas.height = targetHeight;
			}

			context.save();
			context.scale(pixelRatio, pixelRatio);

			context.fillStyle = scopeBackground;
			context.fillRect(0, 0, logicalWidth, logicalHeight);

			context.strokeStyle = scopeGrid;
			context.lineWidth = 1;
			context.beginPath();
			context.moveTo(0, logicalHeight / 2);
			context.lineTo(logicalWidth, logicalHeight / 2);
			context.stroke();

			context.strokeStyle = traceColor;
			context.lineWidth = 1.75;
			context.beginPath();
			const sliceWidth = logicalWidth / samples.length;
			for (let index = 0; index < samples.length; index += 1) {
				const amplitude = samples[index] ?? 0;
				const x = index * sliceWidth;
				const y = (0.5 - amplitude * 0.42) * logicalHeight;
				if (index === 0) {
					context.moveTo(x, y);
				} else {
					context.lineTo(x, y);
				}
			}
			context.stroke();
			context.restore();

			animationFrameId = window.requestAnimationFrame(renderFrame);
		};

		animationFrameId = window.requestAnimationFrame(renderFrame);
		return (): void => {
			window.cancelAnimationFrame(animationFrameId);
		};
	}, [scopeBackground, scopeGrid, traceColor]);

	return (
		<div className="flex flex-col gap-1 rounded-lg border border-slate-800/90 bg-slate-900/60 p-2">
			<div className="flex items-center justify-between text-[10px] font-semibold">
				<span className="tracking-wider text-slate-300 uppercase">
					Master Scope
				</span>
				<span
					className={`font-mono text-[9px] font-bold ${
						isPlaying ? "text-emerald-400" : "text-slate-500"
					}`}
				>
					{isPlaying ? "ACTIVE" : "READY"}
				</span>
			</div>
			<canvas
				ref={canvasRef}
				aria-label="Live Tone.js audio waveform oscilloscope"
				className="block h-11 w-full rounded border border-slate-800"
			/>
		</div>
	);
};

export const InstrumentSynthPanel = (): FunctionComponent => {
	const [inspectorTab, setInspectorTab] = useState<"instrument" | "song">(
		"instrument"
	);

	const song = useChiptuneStore((state) => state.song);
	const isPlaying = useChiptuneStore((state) => state.isPlaying);
	const selectedChannelIndex = useChiptuneStore(
		(state) => state.selectedChannelIndex
	);
	const scaleLockOnly = useChiptuneStore((state) => state.scaleLockOnly);
	const showGhostNotes = useChiptuneStore((state) => state.showGhostNotes);

	const updateChannelInstrument = useChiptuneStore(
		(state) => state.updateChannelInstrument
	);
	const applyInstrumentPreset = useChiptuneStore(
		(state) => state.applyInstrumentPreset
	);
	const updateModernSettings = useChiptuneStore(
		(state) => state.updateModernSettings
	);
	const studioMode = useChiptuneStore((state) => state.studioMode);
	const updateSongMetadata = useChiptuneStore(
		(state) => state.updateSongMetadata
	);
	const setTotalBars = useChiptuneStore((state) => state.setTotalBars);
	const addChannel = useChiptuneStore((state) => state.addChannel);
	const removeChannel = useChiptuneStore((state) => state.removeChannel);
	const toggleScaleLockOnly = useChiptuneStore(
		(state) => state.toggleScaleLockOnly
	);
	const toggleShowGhostNotes = useChiptuneStore(
		(state) => state.toggleShowGhostNotes
	);

	const activeChannel = song.channels[selectedChannelIndex] ?? song.channels[0];
	if (!activeChannel) {
		return null;
	}

	return (
		<section
			aria-label="Instrument and song sliders"
			className="safe-bottom-bar @container flex min-h-0 flex-1 flex-col bg-slate-950"
		>
			{/* Compact UltraBox Settings Switcher on Small Screens (< md) */}
			<div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/70 px-2.5 py-1 md:hidden">
				<div className="flex items-center gap-1">
					<button
						aria-pressed={inspectorTab === "instrument"}
						type="button"
						className={`rounded px-2.5 py-1 text-[11px] font-bold transition ${
							inspectorTab === "instrument"
								? "bg-cyan-500/20 text-cyan-200"
								: "text-slate-400 hover:text-white"
						}`}
						onClick={(): void => {
							setInspectorTab("instrument");
						}}
					>
						Instrument Sliders
					</button>
					<button
						aria-pressed={inspectorTab === "song"}
						type="button"
						className={`rounded px-2.5 py-1 text-[11px] font-bold transition ${
							inspectorTab === "song"
								? "bg-cyan-500/20 text-cyan-200"
								: "text-slate-400 hover:text-white"
						}`}
						onClick={(): void => {
							setInspectorTab("song");
						}}
					>
						Song & Scale ({song.bpm} BPM)
					</button>
				</div>

				<div className="flex items-center gap-1">
					<button
						className="inline-flex h-6 items-center gap-0.5 rounded border border-slate-700 bg-slate-950 px-1.5 text-[10px] font-semibold text-cyan-300"
						title="Add synth channel"
						type="button"
						onClick={(): void => {
							addChannel("pitch");
						}}
					>
						<PlusIcon aria-hidden="true" className="size-3" />
						<span>Ch</span>
					</button>
					<button
						className="inline-flex h-6 items-center gap-0.5 rounded border border-slate-700 bg-slate-950 px-1.5 text-[10px] font-semibold text-violet-300"
						title="Add drum channel"
						type="button"
						onClick={(): void => {
							addChannel("drum");
						}}
					>
						<PlusIcon aria-hidden="true" className="size-3" />
						<span>Dr</span>
					</button>
				</div>
			</div>

			{/* Responsive Inspector Body */}
			<div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
				<div className="flex flex-col gap-3">
					<div className="hidden md:block">
						<ToneWaveformMonitor
							accentColor={activeChannel.color}
							isPlaying={isPlaying}
						/>
					</div>

					<div
						className={
							inspectorTab === "instrument" ? "block" : "hidden md:block"
						}
					>
						{studioMode === "modern" ? (
							<ModernInstrumentSection
								activeChannel={activeChannel}
								channelCount={song.channels.length}
								selectedChannelIndex={selectedChannelIndex}
								onAddChannel={addChannel}
								onApplyPreset={applyInstrumentPreset}
								onRemoveChannel={removeChannel}
								onUpdateInstrument={updateChannelInstrument}
								onUpdateModern={updateModernSettings}
							/>
						) : (
							<InstrumentSlidersSection
								activeChannel={activeChannel}
								channelCount={song.channels.length}
								selectedChannelIndex={selectedChannelIndex}
								onAddChannel={addChannel}
								onApplyPreset={applyInstrumentPreset}
								onRemoveChannel={removeChannel}
								onUpdateInstrument={updateChannelInstrument}
							/>
						)}
					</div>

					<div
						className={
							inspectorTab === "song"
								? "block"
								: "hidden border-t border-slate-800 pt-2 md:block"
						}
					>
						<SongSlidersSection
							scaleLockOnly={scaleLockOnly}
							showGhostNotes={showGhostNotes}
							song={song}
							onSetTotalBars={setTotalBars}
							onToggleGhostNotes={toggleShowGhostNotes}
							onToggleScaleLock={toggleScaleLockOnly}
							onUpdateMetadata={updateSongMetadata}
						/>
					</div>
				</div>
			</div>
		</section>
	);
};

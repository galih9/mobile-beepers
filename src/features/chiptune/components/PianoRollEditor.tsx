import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type PointerEvent as ReactPointerEvent,
} from "react";
import type { FunctionComponent } from "../../../common/types";
import { playPreviewNote } from "../audio/voiceSynthesizer";
import { buildPianoRollRows } from "../constants/scalesAndNotes";
import {
	getActivePatternForChannel,
	getPatternIndexAtBar,
	getStepsPerBar,
} from "../store/songHelpers";
import { useChiptuneStore } from "../store/useChiptuneStore";
import type { NoteEvent } from "../types/music";
import { PianoRollHeaderStrip } from "./PianoRollHeaderStrip";
import { renderPianoRollCanvas } from "./pianoRollRenderer";

export const PianoRollEditor = (): FunctionComponent => {
	const song = useChiptuneStore((state) => state.song);
	const selectedChannelIndex = useChiptuneStore(
		(state) => state.selectedChannelIndex
	);
	const selectedBarIndex = useChiptuneStore((state) => state.selectedBarIndex);
	const activeTool = useChiptuneStore((state) => state.activeTool);
	const defaultNoteDuration = useChiptuneStore(
		(state) => state.defaultNoteDuration
	);
	const scaleLockOnly = useChiptuneStore((state) => state.scaleLockOnly);
	const showGhostNotes = useChiptuneStore((state) => state.showGhostNotes);
	const isPlaying = useChiptuneStore((state) => state.isPlaying);
	const playbackBar = useChiptuneStore((state) => state.playbackBar);
	const playbackStep = useChiptuneStore((state) => state.playbackStep);

	const setActiveTool = useChiptuneStore((state) => state.setActiveTool);
	const setDefaultNoteDuration = useChiptuneStore(
		(state) => state.setDefaultNoteDuration
	);
	const addOrReplaceNote = useChiptuneStore((state) => state.addOrReplaceNote);
	const removeNoteAt = useChiptuneStore((state) => state.removeNoteAt);
	const resizeNoteAt = useChiptuneStore((state) => state.resizeNoteAt);
	const cycleNotePitchBend = useChiptuneStore(
		(state) => state.cycleNotePitchBend
	);
	const generateRiffForCurrentPattern = useChiptuneStore(
		(state) => state.generateRiffForCurrentPattern
	);
	const clearCurrentPattern = useChiptuneStore(
		(state) => state.clearCurrentPattern
	);

	const scrollContainerRef = useRef<HTMLDivElement | null>(null);
	const octaveSliderRef = useRef<HTMLInputElement | null>(null);
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const dragStateRef = useRef<{
		step: number;
		pitch: number;
		wasExisting: boolean;
		didDragResize: boolean;
	} | null>(null);

	const [containerWidth, setContainerWidth] = useState(320);
	const [viewportHeight, setViewportHeight] = useState(240);

	const activeChannel = song.channels[selectedChannelIndex] ?? song.channels[0];
	const stepsPerBar = getStepsPerBar(song);
	const currentPatternNumber = getPatternIndexAtBar(
		activeChannel,
		selectedBarIndex
	);

	const rows = useMemo(() => {
		if (!activeChannel) {
			return [];
		}
		return buildPianoRollRows(
			activeChannel.type,
			song.rootKey,
			song.scale,
			scaleLockOnly
		);
	}, [activeChannel, song.rootKey, song.scale, scaleLockOnly]);

	const activePattern = getActivePatternForChannel(
		activeChannel,
		selectedBarIndex
	);
	const activeNotes = useMemo(
		() => activePattern?.notes ?? [],
		[activePattern]
	);

	const ghostChannels = useMemo(() => {
		return song.channels
			.filter(
				(channel, index) =>
					index !== selectedChannelIndex && channel.type === "pitch"
			)
			.map((channel) => {
				const pattern = getActivePatternForChannel(channel, selectedBarIndex);
				return {
					color: channel.color,
					notes: pattern?.notes ?? [],
				};
			});
	}, [song.channels, selectedChannelIndex, selectedBarIndex]);

	const rowHeight =
		activeChannel?.type === "drum" ? 28 : scaleLockOnly ? 22 : 18;
	const keyWidth = 38;
	const stepWidth = Math.max(
		16,
		Math.floor((containerWidth - keyWidth) / stepsPerBar)
	);
	const maxScrollTop = Math.max(0, rows.length * rowHeight - viewportHeight);

	useEffect(() => {
		const container = scrollContainerRef.current;
		if (!container) {
			return;
		}
		const observer = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (entry) {
				setContainerWidth(entry.contentRect.width);
				setViewportHeight(entry.contentRect.height);
			}
		});
		observer.observe(container);
		return (): void => {
			observer.disconnect();
		};
	}, []);

	// Center vertical scroll near middle octave only when switching channel or scale mode
	const activeChannelId = activeChannel?.id;
	const activeChannelType = activeChannel?.type;
	useEffect(() => {
		const container = scrollContainerRef.current;
		if (!container || !activeChannelId) {
			return;
		}
		const nextScroll =
			activeChannelType === "drum"
				? 0
				: Math.max(0, Math.floor(rows.length * 0.42) * rowHeight - 70);
		container.scrollTop = nextScroll;
		if (octaveSliderRef.current) {
			octaveSliderRef.current.value = String(
				Math.max(0, maxScrollTop - nextScroll)
			);
		}
	}, [
		activeChannelId,
		activeChannelType,
		maxScrollTop,
		rowHeight,
		rows.length,
	]);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas || !activeChannel) {
			return;
		}
		renderPianoRollCanvas({
			canvas,
			rows,
			stepsPerBar,
			stepsPerBeat: song.stepsPerBeat,
			rowHeight,
			stepWidth,
			activeChannel,
			activeNotes,
			ghostChannels,
			showGhostNotes,
			isPlayingThisBar: isPlaying && playbackBar === selectedBarIndex,
			playbackStep,
		});
	}, [
		activeChannel,
		activeNotes,
		ghostChannels,
		isPlaying,
		playbackBar,
		playbackStep,
		rowHeight,
		rows,
		selectedBarIndex,
		showGhostNotes,
		song.stepsPerBeat,
		stepWidth,
		stepsPerBar,
	]);

	const findNoteAtCell = useCallback(
		(step: number, pitch: number): NoteEvent | undefined => {
			return activeNotes.find(
				(note) =>
					note.pitch === pitch &&
					step >= note.step &&
					step < note.step + note.duration
			);
		},
		[activeNotes]
	);

	const resolveCellFromPointer = (
		event: ReactPointerEvent<HTMLCanvasElement>
	): { step: number; pitch: number } | null => {
		const canvas = canvasRef.current;
		if (!canvas) {
			return null;
		}
		const rectangle = canvas.getBoundingClientRect();
		const offsetX = event.clientX - rectangle.left;
		const offsetY = event.clientY - rectangle.top;
		const step = Math.max(
			0,
			Math.min(stepsPerBar - 1, Math.floor(offsetX / stepWidth))
		);
		const rowIndex = Math.max(
			0,
			Math.min(rows.length - 1, Math.floor(offsetY / rowHeight))
		);
		const row = rows[rowIndex];
		if (!row) {
			return null;
		}
		return { step, pitch: row.pitch };
	};

	const handlePointerDown = (
		event: ReactPointerEvent<HTMLCanvasElement>
	): void => {
		if (!activeChannel) {
			return;
		}
		const cell = resolveCellFromPointer(event);
		if (!cell) {
			return;
		}
		event.currentTarget.setPointerCapture(event.pointerId);

		const existing = findNoteAtCell(cell.step, cell.pitch);
		if (activeTool === "slide") {
			if (existing) {
				cycleNotePitchBend(cell.step, cell.pitch);
			}
			return;
		}

		if (existing) {
			dragStateRef.current = {
				step: existing.step,
				pitch: existing.pitch,
				wasExisting: true,
				didDragResize: false,
			};
			playPreviewNote(existing.pitch, activeChannel);
			return;
		}

		const initialDuration =
			activeChannel.type === "drum" ? 1 : defaultNoteDuration;
		addOrReplaceNote({
			step: cell.step,
			pitch: cell.pitch,
			duration: initialDuration,
			velocity: 0.9,
			pitchBend: 0,
		});
		playPreviewNote(cell.pitch, activeChannel);
		dragStateRef.current = {
			step: cell.step,
			pitch: cell.pitch,
			wasExisting: false,
			didDragResize: false,
		};
	};

	const handlePointerMove = (
		event: ReactPointerEvent<HTMLCanvasElement>
	): void => {
		const drag = dragStateRef.current;
		if (!drag || !activeChannel || activeChannel.type === "drum") {
			return;
		}
		if (event.buttons === 0 && event.pointerType === "mouse") {
			return;
		}
		const cell = resolveCellFromPointer(event);
		if (!cell) {
			return;
		}
		if (cell.step > drag.step) {
			drag.didDragResize = true;
			resizeNoteAt(drag.step, drag.pitch, cell.step - drag.step + 1);
		}
	};

	const handlePointerUp = (): void => {
		const drag = dragStateRef.current;
		if (drag && drag.wasExisting && !drag.didDragResize) {
			removeNoteAt(drag.step, drag.pitch);
		}
		dragStateRef.current = null;
	};

	const nudgeOctaveScroll = (deltaRows: number): void => {
		const container = scrollContainerRef.current;
		if (!container) {
			return;
		}
		const nextTop = Math.max(
			0,
			Math.min(maxScrollTop, container.scrollTop + deltaRows * rowHeight)
		);
		container.scrollTop = nextTop;
		if (octaveSliderRef.current) {
			octaveSliderRef.current.value = String(
				Math.max(0, maxScrollTop - nextTop)
			);
		}
	};

	if (!activeChannel) {
		return null;
	}

	return (
		<section
			aria-label="Piano roll pattern editor"
			className="flex min-h-0 flex-1 flex-col border-b border-slate-800 bg-slate-950"
		>
			<PianoRollHeaderStrip
				activeChannel={activeChannel}
				activeTool={activeTool}
				defaultNoteDuration={defaultNoteDuration}
				patternNumber={currentPatternNumber}
				selectedBarIndex={selectedBarIndex}
				onClearPattern={clearCurrentPattern}
				onGenerateRiff={generateRiffForCurrentPattern}
				onSelectDuration={setDefaultNoteDuration}
				onToggleSlideTool={(): void => {
					setActiveTool(activeTool === "slide" ? "draw" : "slide");
				}}
			/>

			{/* Main Piano Roll Body: Left Pitch Labels + Center Canvas + Right Vertical Octave Slider */}
			<div className="flex min-h-0 flex-1">
				<div
					ref={scrollContainerRef}
					aria-label="Piano roll grid"
					className="no-scrollbar relative flex min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
					role="region"
					tabIndex={0}
					onScroll={(event): void => {
						if (octaveSliderRef.current) {
							octaveSliderRef.current.value = String(
								Math.max(0, maxScrollTop - event.currentTarget.scrollTop)
							);
						}
					}}
				>
					{/* Compact Left Pitch / Drum Label Rail */}
					<div
						className="shrink-0 border-r border-slate-800 bg-slate-950"
						style={{ width: `${keyWidth}px` }}
					>
						{rows.map((row) => (
							<button
								key={`key-${row.pitch}`}
								style={{ height: `${rowHeight}px` }}
								type="button"
								className={`flex w-full items-center justify-between border-b border-slate-800/60 px-1 font-mono text-[10px] font-semibold transition active:bg-cyan-500/30 ${
									row.isRoot
										? "bg-cyan-500/15 text-cyan-300"
										: row.isSharp
											? "bg-slate-900 text-slate-400"
											: "bg-slate-950 text-slate-300"
								}`}
								onClick={(): void => {
									playPreviewNote(row.pitch, activeChannel);
								}}
							>
								<span className="truncate">{row.label}</span>
							</button>
						))}
					</div>

					{/* Interactive 16-Step Note Canvas */}
					<div className="relative min-w-0 flex-1">
						<canvas
							ref={canvasRef}
							className="block cursor-pointer touch-none"
							onPointerDown={handlePointerDown}
							onPointerMove={handlePointerMove}
							onPointerUp={handlePointerUp}
						/>
					</div>
				</div>

				{/* UltraBox Signature Right-Edge Vertical Octave Slider */}
				<div className="flex w-7 shrink-0 flex-col items-center justify-between border-l border-slate-800 bg-slate-900 py-1">
					<button
						aria-label="Scroll pitch view up"
						className="flex size-5 items-center justify-center rounded text-slate-300 hover:bg-slate-800 hover:text-white"
						type="button"
						onClick={(): void => {
							nudgeOctaveScroll(-4);
						}}
					>
						<ChevronUpIcon aria-hidden="true" className="size-3.5" />
					</button>

					<div className="flex min-h-0 flex-1 items-center justify-center py-1">
						<input
							ref={octaveSliderRef}
							aria-label="Octave pitch position slider"
							className="octave-vertical-slider"
							defaultValue={Math.max(0, Math.floor(maxScrollTop * 0.55))}
							disabled={maxScrollTop <= 0}
							max={Math.max(1, maxScrollTop)}
							min={0}
							step={1}
							type="range"
							onChange={(event): void => {
								const nextSlider = Number.parseFloat(event.target.value);
								const container = scrollContainerRef.current;
								if (container && Number.isFinite(nextSlider)) {
									container.scrollTop = Math.max(0, maxScrollTop - nextSlider);
								}
							}}
						/>
					</div>

					<button
						aria-label="Scroll pitch view down"
						className="flex size-5 items-center justify-center rounded text-slate-300 hover:bg-slate-800 hover:text-white"
						type="button"
						onClick={(): void => {
							nudgeOctaveScroll(4);
						}}
					>
						<ChevronDownIcon aria-hidden="true" className="size-3.5" />
					</button>
				</div>
			</div>
		</section>
	);
};

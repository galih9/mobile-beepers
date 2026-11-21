import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDrop } from "react-dnd";
import type { FunctionComponent } from "../../../common/types";
import { playPreviewNote } from "../audio/voiceSynthesizer";
import { buildPianoRollRows } from "../constants/scalesAndNotes";
import {
	getActivePatternForChannel,
	getPatternIndexAtBar,
	getStepsPerBar,
} from "../store/songHelpers";
import { useChiptuneStore } from "../store/useChiptuneStore";
import { DND_ITEM_TYPES, type InstrumentPresetDragItem } from "./dndTypes";
import { KonvaPianoRollStage } from "./KonvaPianoRollStage";
import { PianoRollHeaderStrip } from "./PianoRollHeaderStrip";
import { VelocityLane } from "./VelocityLane";
import { VELOCITY_LANE_HEIGHT } from "./velocityLaneMath";

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
	const defaultNoteVelocity = useChiptuneStore(
		(state) => state.defaultNoteVelocity
	);
	const showVelocityLane = useChiptuneStore((state) => state.showVelocityLane);
	const activeWorkspaceTab = useChiptuneStore(
		(state) => state.activeWorkspaceTab
	);
	const selectedNoteIds = useChiptuneStore((state) => state.selectedNoteIds);
	const updateNoteProperties = useChiptuneStore(
		(state) => state.updateNoteProperties
	);
	const pianoRollZoom = useChiptuneStore((state) => state.pianoRollZoom);
	const scaleLockOnly = useChiptuneStore((state) => state.scaleLockOnly);
	const showGhostNotes = useChiptuneStore((state) => state.showGhostNotes);
	const isPlaying = useChiptuneStore((state) => state.isPlaying);
	const playbackBar = useChiptuneStore((state) => state.playbackBar);
	const playbackStep = useChiptuneStore((state) => state.playbackStep);

	const setActiveTool = useChiptuneStore((state) => state.setActiveTool);
	const setDefaultNoteDuration = useChiptuneStore(
		(state) => state.setDefaultNoteDuration
	);
	const setPianoRollZoom = useChiptuneStore((state) => state.setPianoRollZoom);
	const addOrReplaceNote = useChiptuneStore((state) => state.addOrReplaceNote);
	const removeNoteAt = useChiptuneStore((state) => state.removeNoteAt);
	const resizeNoteAt = useChiptuneStore((state) => state.resizeNoteAt);
	const moveNoteAt = useChiptuneStore((state) => state.moveNoteAt);
	const moveNotesBatch = useChiptuneStore((state) => state.moveNotesBatch);
	const cycleNotePitchBend = useChiptuneStore(
		(state) => state.cycleNotePitchBend
	);
	const setNotePitchBendAt = useChiptuneStore(
		(state) => state.setNotePitchBendAt
	);
	const cycleNoteFadeAt = useChiptuneStore((state) => state.cycleNoteFadeAt);
	const cycleNoteRatchetAt = useChiptuneStore(
		(state) => state.cycleNoteRatchetAt
	);
	const transposeCurrentPattern = useChiptuneStore(
		(state) => state.transposeCurrentPattern
	);
	const generateRiffForCurrentPattern = useChiptuneStore(
		(state) => state.generateRiffForCurrentPattern
	);
	const clearCurrentPattern = useChiptuneStore(
		(state) => state.clearCurrentPattern
	);
	const applyInstrumentPreset = useChiptuneStore(
		(state) => state.applyInstrumentPreset
	);

	const scrollContainerRef = useRef<HTMLDivElement | null>(null);
	const velocityLaneScrollRef = useRef<HTMLDivElement | null>(null);
	const octaveSliderRef = useRef<HTMLInputElement | null>(null);

	const [containerWidth, setContainerWidth] = useState(320);
	const [viewportHeight, setViewportHeight] = useState(240);

	const activeChannel = song.channels[selectedChannelIndex] ?? song.channels[0];
	const stepsPerBar = getStepsPerBar(song);
	const currentPatternNumber = getPatternIndexAtBar(
		activeChannel,
		selectedBarIndex
	);

	const [{ isPresetDropOver, draggedPresetName }, dropPresetRef] = useDrop<
		InstrumentPresetDragItem,
		void,
		{ isPresetDropOver: boolean; draggedPresetName: string | null }
	>(
		() => ({
			accept: DND_ITEM_TYPES.INSTRUMENT_PRESET,
			drop: (item): void => {
				applyInstrumentPreset(selectedChannelIndex, item.presetId);
			},
			collect: (
				monitor
			): { isPresetDropOver: boolean; draggedPresetName: string | null } => ({
				isPresetDropOver: monitor.isOver(),
				draggedPresetName: monitor.getItem()?.presetName ?? null,
			}),
		}),
		[applyInstrumentPreset, selectedChannelIndex]
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

	const isLargeViewport = containerWidth >= 700;
	const rowHeight =
		activeChannel?.type === "drum"
			? isLargeViewport
				? 32
				: 28
			: scaleLockOnly
				? isLargeViewport
					? 24
					: 22
				: isLargeViewport
					? 20
					: 18;
	const keyWidth = isLargeViewport ? 56 : 42;
	// Shorter volume lane on phones so the note grid keeps its room
	const velocityLaneHeight = isLargeViewport ? VELOCITY_LANE_HEIGHT : 40;
	// Phone split view is too short for the lane; it shows in the Piano tab there
	const isVelocityLaneVisible =
		showVelocityLane && (isLargeViewport || activeWorkspaceTab === "piano");
	const baseStepWidth = Math.max(
		24,
		Math.floor((containerWidth - keyWidth) / stepsPerBar)
	);
	const stepWidth = Math.max(6, Math.round(baseStepWidth * pianoRollZoom));
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

	// Center vertical scroll near middle octave when switching channel or scale mode
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
			ref={(element): void => {
				dropPresetRef(element);
			}}
			aria-label="Piano roll pattern editor"
			className={`relative flex min-h-0 flex-1 flex-col border-b border-slate-800 bg-slate-950 transition ${
				isPresetDropOver ? "ring-2 ring-inset ring-cyan-400" : ""
			}`}
		>
			<PianoRollHeaderStrip
				activeChannel={activeChannel}
				activeTool={activeTool}
				defaultNoteDuration={defaultNoteDuration}
				patternNumber={currentPatternNumber}
				pianoRollZoom={pianoRollZoom}
				selectedBarIndex={selectedBarIndex}
				onClearPattern={clearCurrentPattern}
				onGenerateRiff={generateRiffForCurrentPattern}
				onSelectDuration={setDefaultNoteDuration}
				onSelectTool={setActiveTool}
				onSelectZoom={setPianoRollZoom}
				onTransposePattern={transposeCurrentPattern}
			/>

			{isPresetDropOver && (
				<div className="pointer-events-none absolute inset-x-4 top-11 z-20 rounded-lg border border-cyan-400/70 bg-slate-950/90 px-3 py-1.5 text-center text-xs font-semibold text-cyan-200 shadow-lg">
					Drop preset {draggedPresetName ? `"${draggedPresetName}" ` : ""}to
					apply to {activeChannel.name}
				</div>
			)}

			{/* Main Piano Roll Body: Sticky Pitch Key Rail + Interactive Konva Stage + Vertical Octave Slider */}
			<div className="flex min-h-0 flex-1">
				<div
					ref={scrollContainerRef}
					aria-label="Piano roll grid"
					className="no-scrollbar relative flex min-h-0 flex-1 overflow-auto"
					role="region"
					tabIndex={0}
					onScroll={(event): void => {
						// Keep the note volume lane aligned with the grid's steps
						if (velocityLaneScrollRef.current) {
							velocityLaneScrollRef.current.scrollLeft =
								event.currentTarget.scrollLeft;
						}
						if (octaveSliderRef.current) {
							octaveSliderRef.current.value = String(
								Math.max(0, maxScrollTop - event.currentTarget.scrollTop)
							);
						}
					}}
				>
					{/* Sticky Left Pitch / Drum Label Rail */}
					<div
						className="sticky left-0 z-10 shrink-0 border-r border-slate-800 bg-slate-950"
						style={{ width: `${keyWidth}px` }}
					>
						{rows.map((row) => (
							<button
								key={`key-${row.pitch}`}
								style={{ height: `${rowHeight}px` }}
								type="button"
								className={`flex w-full items-center justify-between border-b border-slate-800/60 px-1.5 font-mono text-[10px] font-semibold transition active:bg-cyan-500/30 ${
									row.isRoot
										? "bg-amber-500/15 text-amber-200"
										: row.isSharp
											? "bg-slate-900 text-slate-400"
											: "bg-slate-950 text-slate-300"
								}`}
								onClick={(): void => {
									playPreviewNote(row.pitch, activeChannel);
								}}
							>
								<span className="truncate">{row.label}</span>
								{row.isRoot && isLargeViewport && (
									<span className="hidden rounded bg-amber-400/20 px-1 text-[8px] font-bold text-amber-300 md:inline">
										R
									</span>
								)}
							</button>
						))}
					</div>

					{/* Interactive Konva Stage */}
					<div className="relative min-w-0 flex-1">
						<KonvaPianoRollStage
							activeChannel={activeChannel}
							activeNotes={activeNotes}
							activeTool={activeTool}
							defaultNoteDuration={defaultNoteDuration}
							defaultNoteVelocity={defaultNoteVelocity}
							ghostChannels={ghostChannels}
							isPlayingThisBar={isPlaying && playbackBar === selectedBarIndex}
							playbackStep={playbackStep}
							rowHeight={rowHeight}
							rows={rows}
							showGhostNotes={showGhostNotes}
							stepWidth={stepWidth}
							stepsPerBar={stepsPerBar}
							stepsPerBeat={song.stepsPerBeat}
							onAddOrReplaceNote={addOrReplaceNote}
							onCycleNoteFade={cycleNoteFadeAt}
							onCycleNoteRatchet={cycleNoteRatchetAt}
							onCyclePitchBend={cycleNotePitchBend}
							onMoveNote={moveNoteAt}
							onMoveNotesBatch={moveNotesBatch}
							onRemoveNote={removeNoteAt}
							onResizeNote={resizeNoteAt}
							onSetNotePitchBend={setNotePitchBendAt}
							onPreviewPitch={(pitch, note): void => {
								const stepSeconds = 60 / song.bpm / song.stepsPerBeat;
								playPreviewNote(pitch, activeChannel, note, stepSeconds);
							}}
						/>
					</div>
				</div>

				{/* UltraBox Signature Right-Edge Vertical Octave Slider */}
				<div className="flex w-7 shrink-0 flex-col items-center justify-between border-l border-slate-800 bg-slate-900 py-1 md:w-8">
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

			{/* Per-note Volume Lane (aligned with the grid's steps) */}
			{isVelocityLaneVisible && (
				<div
					className="flex shrink-0 border-t border-slate-800 bg-slate-950"
					style={{ height: `${velocityLaneHeight}px` }}
				>
					<div
						className="flex shrink-0 flex-col items-center justify-center border-r border-slate-800 font-mono text-[9px] font-bold text-emerald-300"
						style={{ width: `${keyWidth}px` }}
						title="Note volume. Drag to paint volumes; Shift-drag to raise or lower them together. With notes selected, only those are edited."
					>
						<span>VOL</span>
						{selectedNoteIds.length > 0 && (
							<span className="text-[8px] text-white">SEL</span>
						)}
					</div>
					<div
						ref={velocityLaneScrollRef}
						className="no-scrollbar min-w-0 flex-1 overflow-hidden"
					>
						<VelocityLane
							color={activeChannel.color}
							height={velocityLaneHeight}
							notes={activeNotes}
							selectedNoteIds={selectedNoteIds}
							stepWidth={stepWidth}
							stepsPerBar={stepsPerBar}
							stepsPerBeat={song.stepsPerBeat}
							onPreview={(note, velocity): void => {
								const stepSeconds = 60 / song.bpm / song.stepsPerBeat;
								playPreviewNote(
									note.pitch,
									activeChannel,
									{ ...note, velocity },
									stepSeconds
								);
							}}
							onUpdate={(updates): void => {
								updateNoteProperties(updates, "note-velocity-lane");
							}}
						/>
					</div>
					<div className="w-7 shrink-0 border-l border-slate-800 bg-slate-900 md:w-8" />
				</div>
			)}
		</section>
	);
};

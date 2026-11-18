import {
	ArrowLeftIcon,
	ArrowRightIcon,
	Bars2Icon,
	ChevronDownIcon,
	ChevronUpIcon,
	ClipboardDocumentCheckIcon,
	ClipboardDocumentIcon,
	DocumentDuplicateIcon,
	MinusIcon,
	PlusIcon,
	SpeakerWaveIcon,
	SpeakerXMarkIcon,
	TrashIcon,
	XMarkIcon,
} from "@heroicons/react/24/outline";
import {
	useEffect,
	useRef,
	useState,
	type PointerEvent as ReactPointerEvent,
} from "react";
import { useDrag, useDrop } from "react-dnd";
import type { FunctionComponent } from "../../../common/types";
import { getStepsPerBar } from "../store/songHelpers";
import { useChiptuneStore } from "../store/useChiptuneStore";
import type { BarMatrixSelection, Channel } from "../types/music";
import {
	DND_ITEM_TYPES,
	type ChannelRowDragItem,
	type InstrumentPresetDragItem,
	type MatrixBarRangeDragItem,
	type MatrixPatternCellDragItem,
} from "./dndTypes";

const BAR_CELL_PITCH = 34; // 32px square cell + 2px gap

type LoopDragMode = "start" | "end" | "move";

interface LoopDragSession {
	mode: LoopDragMode;
	anchorBar: number;
	initialStart: number;
	initialEnd: number;
}

interface ChannelRailRowProps {
	channel: Channel;
	channelIndex: number;
	channelCount: number;
	isSelected: boolean;
	onSelectChannel: (channelIndex: number) => void;
	onToggleMute: (channelIndex: number) => void;
	onToggleSolo: (channelIndex: number) => void;
	onReorderChannels: (
		fromIndex: number,
		toIndex: number,
		label: string
	) => void;
	onApplyPreset: (
		channelIndex: number,
		presetId: string,
		presetName: string,
		channelName: string
	) => void;
}

const ChannelRailRow = ({
	channel,
	channelIndex,
	channelCount,
	isSelected,
	onSelectChannel,
	onToggleMute,
	onToggleSolo,
	onReorderChannels,
	onApplyPreset,
}: ChannelRailRowProps): FunctionComponent => {
	const [{ isDragging }, dragHandleRef, previewRowRef] = useDrag<
		ChannelRowDragItem,
		void,
		{ isDragging: boolean }
	>(
		() => ({
			type: DND_ITEM_TYPES.CHANNEL_ROW,
			item: {
				type: DND_ITEM_TYPES.CHANNEL_ROW,
				channelIndex,
				channelId: channel.id,
			},
			collect: (monitor): { isDragging: boolean } => ({
				isDragging: monitor.isDragging(),
			}),
		}),
		[channel.id, channelIndex]
	);

	const [{ isOverChannel, isOverPreset }, dropRowRef] = useDrop<
		ChannelRowDragItem | InstrumentPresetDragItem,
		void,
		{ isOverChannel: boolean; isOverPreset: boolean }
	>(
		() => ({
			accept: [DND_ITEM_TYPES.CHANNEL_ROW, DND_ITEM_TYPES.INSTRUMENT_PRESET],
			drop: (item): void => {
				if (item.type === DND_ITEM_TYPES.CHANNEL_ROW) {
					if (item.channelIndex !== channelIndex) {
						onReorderChannels(item.channelIndex, channelIndex, channel.name);
					}
					return;
				}
				onApplyPreset(
					channelIndex,
					item.presetId,
					item.presetName,
					channel.name
				);
			},
			collect: (monitor): { isOverChannel: boolean; isOverPreset: boolean } => {
				const itemType = monitor.getItemType();
				return {
					isOverChannel:
						monitor.isOver() && itemType === DND_ITEM_TYPES.CHANNEL_ROW,
					isOverPreset:
						monitor.isOver() && itemType === DND_ITEM_TYPES.INSTRUMENT_PRESET,
				};
			},
		}),
		[channel.name, channelIndex, onApplyPreset, onReorderChannels]
	);

	return (
		<div
			ref={(element): void => {
				dropRowRef(previewRowRef(element));
			}}
			className={`flex h-8 items-center gap-1 rounded px-1 transition ${
				isSelected ? "bg-slate-800/90" : "bg-black/40"
			} ${isDragging ? "opacity-50" : "opacity-100"} ${
				isOverChannel
					? "ring-2 ring-cyan-400 bg-cyan-500/15"
					: isOverPreset
						? "ring-2 ring-amber-400 bg-amber-500/15"
						: ""
			}`}
		>
			<button
				ref={(element): void => {
					dragHandleRef(element);
				}}
				aria-label={`Reorder ${channel.name} track ${channelIndex + 1}. Use Up or Down arrows to move.`}
				className="flex size-4 shrink-0 cursor-grab touch-none items-center justify-center rounded text-slate-500 select-none hover:bg-slate-700/60 hover:text-slate-200 active:cursor-grabbing"
				title="Drag to reorder track"
				type="button"
				onKeyDown={(event): void => {
					if (event.key === "ArrowUp" && channelIndex > 0) {
						event.preventDefault();
						onReorderChannels(channelIndex, channelIndex - 1, channel.name);
					} else if (
						event.key === "ArrowDown" &&
						channelIndex < channelCount - 1
					) {
						event.preventDefault();
						onReorderChannels(channelIndex, channelIndex + 1, channel.name);
					}
				}}
			>
				<Bars2Icon aria-hidden="true" className="size-3" />
			</button>

			<button
				type="button"
				aria-label={
					channel.muted ? `Unmute ${channel.name}` : `Mute ${channel.name}`
				}
				className={`flex size-4 shrink-0 items-center justify-center ${
					channel.muted ? "text-rose-400" : "text-slate-300 hover:text-white"
				}`}
				onClick={(): void => {
					onToggleMute(channelIndex);
				}}
			>
				{channel.muted ? (
					<SpeakerXMarkIcon aria-hidden="true" className="size-3" />
				) : (
					<SpeakerWaveIcon aria-hidden="true" className="size-3" />
				)}
			</button>

			<button
				aria-label={`Solo ${channel.name}`}
				aria-pressed={channel.solo}
				type="button"
				className={`rounded px-0.5 font-mono text-[9px] font-bold ${
					channel.solo ? "bg-amber-400 text-black" : "text-slate-500"
				}`}
				onClick={(): void => {
					onToggleSolo(channelIndex);
				}}
			>
				S
			</button>

			<button
				className="min-w-0 flex-1 truncate text-left text-[10px] font-semibold md:text-[11px]"
				style={{ color: channel.color }}
				type="button"
				onClick={(): void => {
					onSelectChannel(channelIndex);
				}}
			>
				{channel.name}
			</button>

			{/* Keyboard & Mouse Quick Reorder Controls on Tablet/Desktop */}
			<div className="hidden shrink-0 items-center gap-0.5 lg:flex">
				<button
					aria-label={`Move ${channel.name} track up`}
					className="flex size-3.5 items-center justify-center rounded text-slate-500 hover:bg-slate-700 hover:text-white disabled:opacity-30"
					disabled={channelIndex === 0}
					type="button"
					onClick={(): void => {
						onReorderChannels(channelIndex, channelIndex - 1, channel.name);
					}}
				>
					<ChevronUpIcon aria-hidden="true" className="size-2.5" />
				</button>
				<button
					aria-label={`Move ${channel.name} track down`}
					className="flex size-3.5 items-center justify-center rounded text-slate-500 hover:bg-slate-700 hover:text-white disabled:opacity-30"
					disabled={channelIndex === channelCount - 1}
					type="button"
					onClick={(): void => {
						onReorderChannels(channelIndex, channelIndex + 1, channel.name);
					}}
				>
					<ChevronDownIcon aria-hidden="true" className="size-2.5" />
				</button>
			</div>
		</div>
	);
};

interface MatrixBarCellProps {
	channel: Channel;
	channelIndex: number;
	barIndex: number;
	patternNumber: number;
	isSlotSelected: boolean;
	isInMultiSelection: boolean;
	barSelection: BarMatrixSelection | null;
	onSelectOrCycleCell: (
		channelIndex: number,
		barIndex: number,
		patternNumber: number,
		isSlotSelected: boolean
	) => void;
	onShiftSelectCell: (channelIndex: number, barIndex: number) => void;
	onIncrementPattern: (
		channelIndex: number,
		barIndex: number,
		nextPatternNumber: number
	) => void;
	onDecrementPattern: (
		channelIndex: number,
		barIndex: number,
		nextPatternNumber: number
	) => void;
	onCopyPatternSlot: (
		sourceChannelIndex: number,
		sourceBarIndex: number,
		targetChannelIndex: number,
		targetBarIndex: number,
		patternNumber: number
	) => void;
	onDropBarRange: (
		targetBarIndex: number,
		targetChannelIndex: number
	) => void;
}

const MatrixBarCell = ({
	channel,
	channelIndex,
	barIndex,
	patternNumber,
	isSlotSelected,
	isInMultiSelection,
	barSelection,
	onSelectOrCycleCell,
	onShiftSelectCell,
	onIncrementPattern,
	onDecrementPattern,
	onCopyPatternSlot,
	onDropBarRange,
}: MatrixBarCellProps): FunctionComponent => {
	const [{ isDragging }, dragCellRef] = useDrag<
		MatrixPatternCellDragItem | MatrixBarRangeDragItem,
		void,
		{ isDragging: boolean }
	>(
		() => ({
			type:
				isInMultiSelection && barSelection
					? DND_ITEM_TYPES.MATRIX_BAR_RANGE
					: DND_ITEM_TYPES.MATRIX_PATTERN_CELL,
			item:
				isInMultiSelection && barSelection
					? {
							type: DND_ITEM_TYPES.MATRIX_BAR_RANGE,
							selection: barSelection,
						}
					: {
							type: DND_ITEM_TYPES.MATRIX_PATTERN_CELL,
							channelIndex,
							barIndex,
							patternNumber,
						},
			collect: (monitor): { isDragging: boolean } => ({
				isDragging: monitor.isDragging(),
			}),
		}),
		[barIndex, barSelection, channelIndex, isInMultiSelection, patternNumber]
	);

	const [{ isOver, canDrop }, dropCellRef] = useDrop<
		MatrixPatternCellDragItem | MatrixBarRangeDragItem,
		void,
		{ isOver: boolean; canDrop: boolean }
	>(
		() => ({
			accept: [
				DND_ITEM_TYPES.MATRIX_PATTERN_CELL,
				DND_ITEM_TYPES.MATRIX_BAR_RANGE,
			],
			canDrop: (item): boolean => {
				if (item.type === DND_ITEM_TYPES.MATRIX_BAR_RANGE) {
					return true;
				}
				return item.channelIndex !== channelIndex || item.barIndex !== barIndex;
			},
			drop: (item): void => {
				if (item.type === DND_ITEM_TYPES.MATRIX_BAR_RANGE) {
					onDropBarRange(barIndex, channelIndex);
					return;
				}
				onCopyPatternSlot(
					item.channelIndex,
					item.barIndex,
					channelIndex,
					barIndex,
					item.patternNumber
				);
			},
			collect: (monitor): { isOver: boolean; canDrop: boolean } => ({
				isOver: monitor.isOver(),
				canDrop: monitor.canDrop(),
			}),
		}),
		[barIndex, channelIndex, onCopyPatternSlot, onDropBarRange]
	);

	return (
		<div
			ref={(element): void => {
				dropCellRef(dragCellRef(element));
			}}
			className={`relative flex h-8 w-8 shrink-0 items-center overflow-hidden rounded-[2px] font-mono text-xs font-extrabold transition ${
				isDragging ? "opacity-50" : ""
			} ${isOver && canDrop ? "z-20 scale-105 ring-2 ring-cyan-400" : ""} ${
				isInMultiSelection
					? "z-10 ring-2 ring-cyan-400 ring-inset shadow-[0_0_8px_rgba(34,211,238,0.7)]"
					: ""
			}`}
			style={{
				backgroundColor: isSlotSelected
					? channel.color
					: isInMultiSelection
						? "#1e293b"
						: patternNumber > 0
							? "#3d3d3d"
							: "#000000",
				color: isSlotSelected
					? "#000000"
					: isInMultiSelection
						? "#22d3ee"
						: channel.color,
				opacity: isDragging
					? 0.5
					: !isSlotSelected && !isInMultiSelection && patternNumber === 0
						? 0.72
						: 1,
			}}
		>
			<button
				aria-label={`${channel.name} bar ${barIndex + 1} pattern ${patternNumber}`}
				title="Click to select/cycle · Shift+Click to range-select · Drag onto another bar to arrange/copy"
				type="button"
				className={`flex h-full items-center justify-center leading-none focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white ${
					isSlotSelected ? "w-4 pl-0.5 text-[13px]" : "w-full"
				}`}
				onClick={(event): void => {
					if (event.shiftKey) {
						onShiftSelectCell(channelIndex, barIndex);
					} else {
						onSelectOrCycleCell(
							channelIndex,
							barIndex,
							patternNumber,
							isSlotSelected
						);
					}
				}}
			>
				{patternNumber}
			</button>

			{isSlotSelected && (
				<div className="flex h-full w-4 flex-col">
					<button
						aria-label={`Increase pattern for ${channel.name} bar ${barIndex + 1}`}
						className="flex flex-1 items-center justify-center transition hover:bg-black/15 active:bg-black/25"
						title="Increase pattern number"
						type="button"
						onClick={(event): void => {
							event.stopPropagation();
							onIncrementPattern(channelIndex, barIndex, patternNumber + 1);
						}}
					>
						<svg aria-hidden="true" className="size-3" viewBox="0 0 12 10">
							<polygon fill="#000000" points="6,1 11,9 1,9" />
						</svg>
					</button>
					<button
						aria-label={`Decrease pattern for ${channel.name} bar ${barIndex + 1}`}
						className="flex flex-1 items-center justify-center transition hover:bg-black/15 active:bg-black/25"
						title="Decrease pattern number"
						type="button"
						onClick={(event): void => {
							event.stopPropagation();
							onDecrementPattern(
								channelIndex,
								barIndex,
								Math.max(0, patternNumber - 1)
							);
						}}
					>
						<svg aria-hidden="true" className="size-3" viewBox="0 0 12 10">
							<polygon
								fill="#ffffff"
								points="1,1 11,1 6,9"
								stroke="#000000"
								strokeLinejoin="round"
								strokeWidth="1.2"
							/>
						</svg>
					</button>
				</div>
			)}
		</div>
	);
};

export const SongMatrixPanel = (): FunctionComponent => {
	const matrixScrollRef = useRef<HTMLDivElement | null>(null);
	const loopTrackRef = useRef<HTMLDivElement | null>(null);
	const loopDragRef = useRef<LoopDragSession | null>(null);
	const headerDragRef = useRef<{ startBar: number } | null>(null);
	const [statusAnnouncement, setStatusAnnouncement] = useState("");
	const [arrangeTargetBar, setArrangeTargetBar] = useState<number | null>(null);

	const song = useChiptuneStore((state) => state.song);
	const selectedChannelIndex = useChiptuneStore(
		(state) => state.selectedChannelIndex
	);
	const selectedBarIndex = useChiptuneStore((state) => state.selectedBarIndex);
	const isPlaying = useChiptuneStore((state) => state.isPlaying);
	const followPlayhead = useChiptuneStore((state) => state.followPlayhead);
	const playbackBar = useChiptuneStore((state) => state.playbackBar);
	const playbackStep = useChiptuneStore((state) => state.playbackStep);
	const barSelection = useChiptuneStore((state) => state.barSelection);
	const copiedBarsClipboard = useChiptuneStore(
		(state) => state.copiedBarsClipboard
	);

	const setSelectedChannelIndex = useChiptuneStore(
		(state) => state.setSelectedChannelIndex
	);
	const setSelectedBarIndex = useChiptuneStore(
		(state) => state.setSelectedBarIndex
	);
	const toggleChannelMute = useChiptuneStore(
		(state) => state.toggleChannelMute
	);
	const toggleChannelSolo = useChiptuneStore(
		(state) => state.toggleChannelSolo
	);
	const reorderChannels = useChiptuneStore((state) => state.reorderChannels);
	const applyInstrumentPreset = useChiptuneStore(
		(state) => state.applyInstrumentPreset
	);
	const setBarPatternIndex = useChiptuneStore(
		(state) => state.setBarPatternIndex
	);
	const clonePatternToBar = useChiptuneStore(
		(state) => state.clonePatternToBar
	);
	const copyBarPatternSlot = useChiptuneStore(
		(state) => state.copyBarPatternSlot
	);
	const setLoopRange = useChiptuneStore((state) => state.setLoopRange);
	const setBarSelection = useChiptuneStore((state) => state.setBarSelection);
	const clearBarSelection = useChiptuneStore(
		(state) => state.clearBarSelection
	);
	const selectAllBars = useChiptuneStore((state) => state.selectAllBars);
	const copySelectedBars = useChiptuneStore(
		(state) => state.copySelectedBars
	);
	const pasteBarsAt = useChiptuneStore((state) => state.pasteBarsAt);
	const moveSelectedBarsTo = useChiptuneStore(
		(state) => state.moveSelectedBarsTo
	);
	const duplicateSelectedBarsTo = useChiptuneStore(
		(state) => state.duplicateSelectedBarsTo
	);
	const shiftSelectedBars = useChiptuneStore(
		(state) => state.shiftSelectedBars
	);
	const clearSelectedBarsContent = useChiptuneStore(
		(state) => state.clearSelectedBarsContent
	);

	const activeChannel = song.channels[selectedChannelIndex];
	const currentPatternNumber =
		activeChannel?.barSequence[selectedBarIndex] ?? 0;
	const stepsPerBar = getStepsPerBar(song);

	const defaultArrangeTargetBar = barSelection
		? Math.min(song.totalBars - 1, barSelection.endBar + 1)
		: Math.min(song.totalBars - 1, selectedBarIndex + 1);
	const effectiveArrangeTargetBar =
		arrangeTargetBar !== null && arrangeTargetBar < song.totalBars
			? arrangeTargetBar
			: defaultArrangeTargetBar;

	const handleHeaderPointerDown = (
		barIndex: number,
		event: ReactPointerEvent<HTMLButtonElement>
	): void => {
		if (event.shiftKey) {
			const startBar = Math.min(selectedBarIndex, barIndex);
			const endBar = Math.max(selectedBarIndex, barIndex);
			setBarSelection({
				startBar,
				endBar,
				startChannel: 0,
				endChannel: song.channels.length - 1,
			});
			setStatusAnnouncement(
				`Selected bars ${startBar + 1} to ${endBar + 1} across all tracks`
			);
			return;
		}
		headerDragRef.current = { startBar: barIndex };
		setSelectedBarIndex(barIndex);
	};

	const handleHeaderPointerEnter = (barIndex: number): void => {
		const session = headerDragRef.current;
		if (!session) {
			return;
		}
		const startBar = Math.min(session.startBar, barIndex);
		const endBar = Math.max(session.startBar, barIndex);
		setBarSelection({
			startBar,
			endBar,
			startChannel: 0,
			endChannel: song.channels.length - 1,
		});
	};

	const handleHeaderPointerUp = (): void => {
		headerDragRef.current = null;
	};

	useEffect(() => {
		if (!isPlaying || !followPlayhead) {
			return;
		}
		const container = matrixScrollRef.current;
		if (!container) {
			return;
		}
		const barLeft = selectedBarIndex * BAR_CELL_PITCH;
		const barRight = barLeft + BAR_CELL_PITCH;
		const visibleLeft = container.scrollLeft;
		const visibleRight = visibleLeft + container.clientWidth;
		if (barLeft < visibleLeft) {
			container.scrollTo({
				left: Math.max(0, barLeft - 8),
				behavior: "smooth",
			});
		} else if (barRight > visibleRight) {
			container.scrollTo({
				left: Math.max(0, barRight - container.clientWidth + 8),
				behavior: "smooth",
			});
		}
	}, [followPlayhead, isPlaying, selectedBarIndex]);

	const loopStart = Math.max(
		0,
		Math.min(song.totalBars - 1, song.loopStartBar ?? 0)
	);
	const loopEnd = Math.max(
		loopStart,
		Math.min(song.totalBars - 1, song.loopEndBar ?? song.totalBars - 1)
	);

	const resolveBarFromPointer = (
		event: ReactPointerEvent<HTMLDivElement>
	): { barIndex: number; offsetX: number } => {
		const track = loopTrackRef.current;
		if (!track) {
			return { barIndex: 0, offsetX: 0 };
		}
		const rectangle = track.getBoundingClientRect();
		const offsetX = event.clientX - rectangle.left;
		const barIndex = Math.max(
			0,
			Math.min(song.totalBars - 1, Math.floor(offsetX / BAR_CELL_PITCH))
		);
		return { barIndex, offsetX };
	};

	const handleLoopPointerDown = (
		event: ReactPointerEvent<HTMLDivElement>
	): void => {
		event.currentTarget.setPointerCapture(event.pointerId);
		const { barIndex, offsetX } = resolveBarFromPointer(event);
		const capsuleLeft = loopStart * BAR_CELL_PITCH;
		const capsuleRight = (loopEnd + 1) * BAR_CELL_PITCH - 2;

		if (offsetX >= capsuleLeft - 8 && offsetX <= capsuleLeft + 14) {
			loopDragRef.current = {
				mode: "start",
				anchorBar: barIndex,
				initialStart: loopStart,
				initialEnd: loopEnd,
			};
			return;
		}

		if (offsetX >= capsuleRight - 14 && offsetX <= capsuleRight + 8) {
			loopDragRef.current = {
				mode: "end",
				anchorBar: barIndex,
				initialStart: loopStart,
				initialEnd: loopEnd,
			};
			return;
		}

		if (offsetX > capsuleLeft + 14 && offsetX < capsuleRight - 14) {
			loopDragRef.current = {
				mode: "move",
				anchorBar: barIndex,
				initialStart: loopStart,
				initialEnd: loopEnd,
			};
			return;
		}

		setLoopRange(barIndex, barIndex);
		loopDragRef.current = {
			mode: "end",
			anchorBar: barIndex,
			initialStart: barIndex,
			initialEnd: barIndex,
		};
	};

	const handleLoopPointerMove = (
		event: ReactPointerEvent<HTMLDivElement>
	): void => {
		const session = loopDragRef.current;
		if (!session) {
			return;
		}
		const { barIndex } = resolveBarFromPointer(event);

		if (session.mode === "start") {
			setLoopRange(Math.min(barIndex, session.initialEnd), session.initialEnd);
			return;
		}

		if (session.mode === "end") {
			setLoopRange(
				session.initialStart,
				Math.max(barIndex, session.initialStart)
			);
			return;
		}

		const span = session.initialEnd - session.initialStart;
		const delta = barIndex - session.anchorBar;
		const maxStart = Math.max(0, song.totalBars - 1 - span);
		const nextStart = Math.max(
			0,
			Math.min(maxStart, session.initialStart + delta)
		);
		setLoopRange(nextStart, nextStart + span);
	};

	const handleLoopPointerUp = (): void => {
		loopDragRef.current = null;
	};

	const playheadLeftPixels =
		(playbackBar + playbackStep / Math.max(1, stepsPerBar)) * BAR_CELL_PITCH;
	const capsuleLeftPixels = loopStart * BAR_CELL_PITCH;
	const capsuleWidthPixels = Math.max(
		30,
		(loopEnd - loopStart + 1) * BAR_CELL_PITCH - 2
	);

	return (
		<section
			aria-label="Track pattern matrix and purple loop slider"
			className="studio-chrome-text flex shrink-0 flex-col border-b border-slate-800 bg-black"
		>
			<div aria-live="polite" className="sr-only">
				{statusAnnouncement}
			</div>

			<div className="flex">
				{/* Left Channel Mute / Solo / Drag-Reorder Rail */}
				<div className="flex w-28 shrink-0 flex-col gap-0.5 border-r border-slate-900 bg-slate-950 px-1.5 py-1.5 md:w-36 lg:w-44">
					<div className="flex h-4 items-center justify-between px-1 font-mono text-[9px] font-bold text-slate-500">
						<span>TRACK</span>
						<span>BAR</span>
					</div>

					{song.channels.map((channel, channelIndex) => (
						<ChannelRailRow
							key={`rail-${channel.id}`}
							channel={channel}
							channelCount={song.channels.length}
							channelIndex={channelIndex}
							isSelected={channelIndex === selectedChannelIndex}
							onSelectChannel={setSelectedChannelIndex}
							onToggleMute={toggleChannelMute}
							onToggleSolo={toggleChannelSolo}
							onApplyPreset={(
								targetChannelIndex,
								presetId,
								presetName,
								channelName
							): void => {
								applyInstrumentPreset(targetChannelIndex, presetId);
								setStatusAnnouncement(
									`Applied ${presetName} preset to ${channelName}`
								);
							}}
							onReorderChannels={(fromIndex, toIndex, channelName): void => {
								reorderChannels(fromIndex, toIndex);
								setStatusAnnouncement(
									`Moved ${channelName} to track position ${toIndex + 1}`
								);
							}}
						/>
					))}

					{/* Loop label aligned with the Purple Loop Capsule */}
					<div className="flex h-6 items-center justify-between px-1 font-mono text-[9px] font-bold text-violet-400">
						<span>LOOP</span>
						<span>
							{loopStart + 1}–{loopEnd + 1}
						</span>
					</div>
				</div>

				{/* Right Scrollable UltraBox Bar Grid + Purple Loop Capsule */}
				<div
					ref={matrixScrollRef}
					className="no-scrollbar min-w-0 flex-1 overflow-x-auto bg-black px-1.5 py-1.5"
				>
					<div
						className="relative flex flex-col gap-0.5"
						style={{ width: `${song.totalBars * BAR_CELL_PITCH}px` }}
					>
						{/* Numbered UltraBox Bar Header Strip */}
						<div
							className="flex items-center gap-0.5"
							onPointerUp={handleHeaderPointerUp}
						>
							{Array.from({ length: song.totalBars }, (_, barIndex) => {
								const isBarSelected = barIndex === selectedBarIndex;
								const isBeatGroupStart = barIndex % 4 === 0;
								const isBarInSelection =
									barSelection !== null &&
									barIndex >= barSelection.startBar &&
									barIndex <= barSelection.endBar;

								return (
									<button
										key={`bar-header-${barIndex}`}
										aria-label={`Select bar ${barIndex + 1}. Drag or Shift-click to select multiple bars.`}
										type="button"
										className={`flex h-4 w-8 shrink-0 items-center justify-center rounded-[2px] font-mono text-[9px] font-bold transition select-none ${
											isBarInSelection
												? "bg-cyan-400 text-slate-950 shadow-[0_0_6px_rgba(34,211,238,0.7)]"
												: isBarSelected
													? "bg-slate-200 text-black"
													: isBeatGroupStart
														? "bg-slate-800 text-slate-200 hover:bg-slate-700"
														: "bg-slate-900/90 text-slate-500 hover:bg-slate-800 hover:text-slate-300"
										}`}
										onClick={(event): void => {
											if (event.shiftKey) {
												const minBar = Math.min(selectedBarIndex, barIndex);
												const maxBar = Math.max(selectedBarIndex, barIndex);
												setBarSelection({
													startBar: minBar,
													endBar: maxBar,
													startChannel: 0,
													endChannel: song.channels.length - 1,
												});
												setSelectedBarIndex(barIndex);
												setStatusAnnouncement(
													`Selected bars ${minBar + 1} to ${maxBar + 1} across all tracks`
												);
											} else {
												setSelectedBarIndex(barIndex);
												clearBarSelection();
											}
										}}
										onPointerDown={(event): void => {
											handleHeaderPointerDown(barIndex, event);
										}}
										onPointerEnter={(): void => {
											handleHeaderPointerEnter(barIndex);
										}}
									>
										{barIndex + 1}
									</button>
								);
							})}
						</div>

						{/* Channel Bar Rows + Playhead */}
						<div className="relative flex flex-col gap-0.5">
							{song.channels.map((channel, channelIndex) => {
								const isChannelSelected = channelIndex === selectedChannelIndex;
								return (
									<div key={channel.id} className="flex items-center gap-0.5">
										{channel.barSequence.map((patternNumber, barIndex) => {
											const isSlotSelected =
												isChannelSelected && barIndex === selectedBarIndex;
											const isInMulti =
												barSelection !== null &&
												barIndex >= barSelection.startBar &&
												barIndex <= barSelection.endBar &&
												channelIndex >= barSelection.startChannel &&
												channelIndex <= barSelection.endChannel;

											return (
												<MatrixBarCell
													key={`${channel.id}-bar-${barIndex}`}
													barIndex={barIndex}
													barSelection={barSelection}
													channel={channel}
													channelIndex={channelIndex}
													isInMultiSelection={isInMulti}
													isSlotSelected={isSlotSelected}
													patternNumber={patternNumber}
													onCopyPatternSlot={(
														sourceChannelIndex,
														sourceBarIndex,
														targetChannelIndex,
														targetBarIndex,
														copiedPatternNumber
													): void => {
														copyBarPatternSlot(
															sourceChannelIndex,
															sourceBarIndex,
															targetChannelIndex,
															targetBarIndex
														);
														setStatusAnnouncement(
															`Copied pattern P${copiedPatternNumber} to ${channel.name} bar ${targetBarIndex + 1}`
														);
													}}
													onDecrementPattern={(
														targetChannelIndex,
														targetBarIndex,
														nextPatternNumber
													): void => {
														setBarPatternIndex(
															targetChannelIndex,
															targetBarIndex,
															nextPatternNumber
														);
													}}
													onDropBarRange={(
														targetBarIndex,
														targetChannelIndex
													): void => {
														moveSelectedBarsTo(
															targetBarIndex,
															targetChannelIndex
														);
														setStatusAnnouncement(
															`Moved selected bars to bar ${targetBarIndex + 1}`
														);
													}}
													onIncrementPattern={(
														targetChannelIndex,
														targetBarIndex,
														nextPatternNumber
													): void => {
														setBarPatternIndex(
															targetChannelIndex,
															targetBarIndex,
															nextPatternNumber
														);
													}}
													onSelectOrCycleCell={(
														targetChannelIndex,
														targetBarIndex,
														currentPattern,
														selected
													): void => {
														if (selected) {
															setBarPatternIndex(
																targetChannelIndex,
																targetBarIndex,
																currentPattern + 1
															);
														} else {
															setSelectedChannelIndex(targetChannelIndex);
															setSelectedBarIndex(targetBarIndex);
															clearBarSelection();
														}
													}}
													onShiftSelectCell={(
														targetTrackIndex,
														targetCellBarIndex
													): void => {
														const minBar = Math.min(
															selectedBarIndex,
															targetCellBarIndex
														);
														const maxBar = Math.max(
															selectedBarIndex,
															targetCellBarIndex
														);
														const minChannel = Math.min(
															selectedChannelIndex,
															targetTrackIndex
														);
														const maxChannel = Math.max(
															selectedChannelIndex,
															targetTrackIndex
														);
														setBarSelection({
															startBar: minBar,
															endBar: maxBar,
															startChannel: minChannel,
															endChannel: maxChannel,
														});
														setSelectedBarIndex(targetCellBarIndex);
														setSelectedChannelIndex(targetTrackIndex);
														setStatusAnnouncement(
															`Selected bars ${minBar + 1}–${maxBar + 1} across tracks ${minChannel + 1}–${maxChannel + 1}`
														);
													}}
												/>
											);
										})}
									</div>
								);
							})}

							{/* Vertical White Playhead Line Across All Channel Rows */}
							<div
								aria-hidden="true"
								className="pointer-events-none absolute top-0 w-[3px] bg-white"
								style={{
									height: `${song.channels.length * BAR_CELL_PITCH - 2}px`,
									left: `${isPlaying ? playheadLeftPixels : selectedBarIndex * BAR_CELL_PITCH}px`,
								}}
							/>
						</div>

						{/* UltraBox Hollow Purple Loop Range Slider */}
						<div
							ref={loopTrackRef}
							aria-label={`Loop range bar ${loopStart + 1} to ${loopEnd + 1}. Drag edges to resize or middle to slide.`}
							aria-valuemax={song.totalBars}
							aria-valuemin={1}
							aria-valuenow={loopEnd + 1}
							className="relative mt-0.5 flex h-6 touch-none items-center select-none"
							role="slider"
							tabIndex={0}
							onPointerDown={handleLoopPointerDown}
							onPointerMove={handleLoopPointerMove}
							onPointerUp={handleLoopPointerUp}
							onKeyDown={(event): void => {
								const span = loopEnd - loopStart;
								if (event.key === "ArrowLeft" && loopStart > 0) {
									event.preventDefault();
									setLoopRange(loopStart - 1, loopStart - 1 + span);
								} else if (
									event.key === "ArrowRight" &&
									loopEnd < song.totalBars - 1
								) {
									event.preventDefault();
									setLoopRange(loopStart + 1, loopStart + 1 + span);
								}
							}}
						>
							<div
								className="absolute h-[18px] cursor-grab rounded-full border-[3.5px] border-[#845ef7] bg-[#0a0414]/90 shadow-[0_0_8px_rgba(132,94,247,0.4)] active:cursor-grabbing"
								style={{
									left: `${capsuleLeftPixels}px`,
									width: `${capsuleWidthPixels}px`,
								}}
							/>
						</div>
					</div>
				</div>
			</div>

			{/* Multi-Bar Selection & Arrangement Toolbar */}
			{barSelection && (
				<div
					aria-label="Multiple bar selection and arrange controls"
					className="flex flex-wrap items-center justify-between gap-1.5 border-t border-cyan-500/40 bg-slate-900/95 px-2.5 py-1 text-xs shadow-md"
				>
					<div className="flex min-w-0 items-center gap-1.5 font-mono text-[11px]">
						<span className="flex size-2 rounded-full bg-cyan-400 animate-pulse" />
						<span className="font-bold text-cyan-300">
							Bars {barSelection.startBar + 1}–{barSelection.endBar + 1}
						</span>
						<span className="text-slate-400">
							({barSelection.endBar - barSelection.startBar + 1} bars ·{" "}
							{barSelection.endChannel - barSelection.startChannel + 1} tracks)
						</span>
					</div>

					<div className="flex flex-wrap items-center gap-1">
						{/* Copy Selection */}
						<button
							aria-label="Copy selected bars"
							className="inline-flex h-6 items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2 text-[10px] font-semibold text-slate-200 transition hover:border-cyan-400 hover:text-white"
							title="Copy selected bars (Ctrl+C / ⌘C)"
							type="button"
							onClick={(): void => {
								copySelectedBars();
								setStatusAnnouncement(
									`Copied bars ${barSelection.startBar + 1} to ${barSelection.endBar + 1} to clipboard`
								);
							}}
						>
							<ClipboardDocumentIcon
								aria-hidden="true"
								className="size-3 text-cyan-300"
							/>
							<span>Copy</span>
						</button>

						{/* Paste Clipboard at Selected Bar */}
						{copiedBarsClipboard && (
							<button
								aria-label={`Paste copied bars at bar ${selectedBarIndex + 1}`}
								className="inline-flex h-6 items-center gap-1 rounded border border-cyan-500/50 bg-cyan-500/20 px-2 text-[10px] font-semibold text-cyan-200 transition hover:bg-cyan-500/30 hover:text-white"
								title={`Paste ${copiedBarsClipboard.barCount} bars starting at Bar ${selectedBarIndex + 1} (Ctrl+V / ⌘V)`}
								type="button"
								onClick={(): void => {
									pasteBarsAt(selectedBarIndex);
									setStatusAnnouncement(
										`Pasted ${copiedBarsClipboard.barCount} bars at bar ${selectedBarIndex + 1}`
									);
								}}
							>
								<ClipboardDocumentCheckIcon
									aria-hidden="true"
									className="size-3 text-cyan-300"
								/>
								<span>Paste at B{selectedBarIndex + 1}</span>
							</button>
						)}

						{/* Duplicate Right After Selection */}
						<button
							aria-label="Duplicate selected bars right after"
							className="inline-flex h-6 items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2 text-[10px] font-semibold text-violet-200 transition hover:border-violet-400 hover:text-white"
							title="Duplicate bars immediately after selection (Ctrl+D / ⌘D)"
							type="button"
							onClick={(): void => {
								duplicateSelectedBarsTo(barSelection.endBar + 1);
								setStatusAnnouncement(
									`Duplicated bars to bar ${barSelection.endBar + 2}`
								);
							}}
						>
							<DocumentDuplicateIcon
								aria-hidden="true"
								className="size-3 text-violet-300"
							/>
							<span>Duplicate</span>
						</button>

						{/* Arrange on which bar: Target Bar Selector & Move / Copy */}
						<div className="flex items-center gap-1 rounded border border-slate-700 bg-slate-950 px-1 py-0.5">
							<span className="font-mono text-[9px] font-bold text-slate-400">
								ARRANGE:
							</span>
							<select
								aria-label="Target bar to arrange selected bars"
								className="h-5 rounded border border-slate-700 bg-slate-900 px-1 font-mono text-[10px] font-bold text-amber-300"
								value={effectiveArrangeTargetBar}
								onChange={(event): void => {
									setArrangeTargetBar(Number.parseInt(event.target.value, 10));
								}}
							>
								{Array.from({ length: song.totalBars }, (_, targetBarIndex) => (
									<option
										key={`target-bar-${targetBarIndex}`}
										value={targetBarIndex}
									>
										Bar {targetBarIndex + 1}
									</option>
								))}
							</select>
							<button
								aria-label={`Move selected bars to bar ${effectiveArrangeTargetBar + 1}`}
								className="inline-flex h-5 items-center gap-0.5 rounded bg-amber-500/25 px-1.5 text-[9px] font-bold text-amber-200 hover:bg-amber-500/35 hover:text-white"
								title={`Move selected bars to Bar ${effectiveArrangeTargetBar + 1}`}
								type="button"
								onClick={(): void => {
									moveSelectedBarsTo(effectiveArrangeTargetBar);
									setStatusAnnouncement(
										`Moved bars to bar ${effectiveArrangeTargetBar + 1}`
									);
								}}
							>
								<span>Move</span>
							</button>
							<button
								aria-label={`Copy selected bars to bar ${effectiveArrangeTargetBar + 1}`}
								className="inline-flex h-5 items-center gap-0.5 rounded bg-slate-800 px-1.5 text-[9px] font-bold text-slate-200 hover:bg-slate-700 hover:text-white"
								title={`Copy selected bars to Bar ${effectiveArrangeTargetBar + 1}`}
								type="button"
								onClick={(): void => {
									duplicateSelectedBarsTo(effectiveArrangeTargetBar);
									setStatusAnnouncement(
										`Copied bars to bar ${effectiveArrangeTargetBar + 1}`
									);
								}}
							>
								<span>Copy</span>
							</button>
						</div>

						{/* Nudge / Shift Left & Right */}
						<div className="flex items-center gap-0.5 rounded border border-slate-800 bg-slate-950 p-0.5">
							<button
								aria-label="Shift selected bars 1 bar left"
								className="flex h-5 items-center justify-center rounded px-1 text-[10px] font-semibold text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-30"
								disabled={barSelection.startBar <= 0}
								title="Shift left 1 bar"
								type="button"
								onClick={(): void => {
									shiftSelectedBars(-1);
								}}
							>
								<ArrowLeftIcon aria-hidden="true" className="size-2.5" />
								<span>-1</span>
							</button>
							<button
								aria-label="Shift selected bars 1 bar right"
								className="flex h-5 items-center justify-center rounded px-1 text-[10px] font-semibold text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-30"
								disabled={barSelection.endBar >= song.totalBars - 1}
								title="Shift right 1 bar"
								type="button"
								onClick={(): void => {
									shiftSelectedBars(1);
								}}
							>
								<span>+1</span>
								<ArrowRightIcon aria-hidden="true" className="size-2.5" />
							</button>
						</div>

						{/* Clear Content */}
						<button
							aria-label="Clear contents of selected bars"
							className="inline-flex h-5 items-center gap-0.5 rounded border border-rose-500/40 bg-rose-500/10 px-1.5 text-[10px] font-semibold text-rose-300 hover:border-rose-400 hover:bg-rose-500/20"
							title="Clear patterns in selected bars"
							type="button"
							onClick={(): void => {
								clearSelectedBarsContent();
								setStatusAnnouncement(`Cleared selected bars`);
							}}
						>
							<TrashIcon aria-hidden="true" className="size-2.5" />
							<span className="hidden sm:inline">Clear</span>
						</button>

						{/* Deselect */}
						<button
							aria-label="Deselect bars"
							className="flex size-5 items-center justify-center rounded text-slate-400 hover:bg-slate-800 hover:text-white"
							title="Deselect bars (Esc)"
							type="button"
							onClick={(): void => {
								clearBarSelection();
							}}
						>
							<XMarkIcon aria-hidden="true" className="size-3.5" />
						</button>
					</div>
				</div>
			)}

			{/* Clipboard Banner when no selection is active */}
			{!barSelection && copiedBarsClipboard && (
				<div
					aria-label="Clipboard paste controls"
					className="flex items-center justify-between gap-1.5 border-t border-cyan-500/30 bg-slate-950 px-2.5 py-1 text-xs"
				>
					<span className="font-mono text-[10px] text-cyan-300">
						📋 Clipboard: {copiedBarsClipboard.barCount} bars ·{" "}
						{copiedBarsClipboard.channelCount} tracks
					</span>
					<button
						aria-label={`Paste ${copiedBarsClipboard.barCount} bars at bar ${selectedBarIndex + 1}`}
						className="inline-flex h-5 items-center gap-1 rounded border border-cyan-500/50 bg-cyan-500/20 px-2 text-[10px] font-semibold text-cyan-200 hover:bg-cyan-500/30 hover:text-white"
						type="button"
						onClick={(): void => {
							pasteBarsAt(selectedBarIndex);
							setStatusAnnouncement(
								`Pasted ${copiedBarsClipboard.barCount} bars at bar ${selectedBarIndex + 1}`
							);
						}}
					>
						<ClipboardDocumentCheckIcon
							aria-hidden="true"
							className="size-3 text-cyan-300"
						/>
						<span>Paste at Bar {selectedBarIndex + 1}</span>
					</button>
				</div>
			)}

			{/* Slim Pattern Stepper & Clone Strip */}
			<div className="flex items-center justify-between gap-2 border-t border-slate-900 bg-slate-950 px-2.5 py-1">
				<span className="truncate font-mono text-[10px] text-slate-400">
					Shift-click / drag bar headers to select · Drag cells to arrange ·
					Drag purple bar for loop
				</span>
				<div className="flex shrink-0 items-center gap-1">
					<button
						aria-label="Select all bars across all tracks"
						className="inline-flex h-5 items-center gap-1 rounded border border-slate-800 bg-slate-900 px-1.5 text-[10px] font-semibold text-slate-300 hover:border-slate-700 hover:text-white"
						title="Select all bars (Ctrl+A / ⌘A)"
						type="button"
						onClick={(): void => {
							selectAllBars();
						}}
					>
						<span>Select All</span>
					</button>

					<div className="flex items-center rounded border border-slate-800 bg-black">
						<button
							aria-label="Decrease pattern number"
							className="flex size-5 items-center justify-center text-slate-300 hover:text-white"
							type="button"
							onClick={(): void => {
								setBarPatternIndex(
									selectedChannelIndex,
									selectedBarIndex,
									Math.max(0, currentPatternNumber - 1)
								);
							}}
						>
							<MinusIcon aria-hidden="true" className="size-3" />
						</button>
						<span className="min-w-7 text-center font-mono text-[10px] font-bold text-cyan-300">
							P{currentPatternNumber}
						</span>
						<button
							aria-label="Increase pattern number"
							className="flex size-5 items-center justify-center text-slate-300 hover:text-white"
							type="button"
							onClick={(): void => {
								setBarPatternIndex(
									selectedChannelIndex,
									selectedBarIndex,
									currentPatternNumber + 1
								);
							}}
						>
							<PlusIcon aria-hidden="true" className="size-3" />
						</button>
					</div>

					<button
						aria-label="Clone pattern to unique slot"
						className="inline-flex h-5 items-center gap-1 rounded border border-slate-800 bg-slate-900 px-1.5 text-[10px] font-semibold text-slate-200 hover:border-slate-700"
						title="Clone to unique pattern"
						type="button"
						onClick={(): void => {
							clonePatternToBar(selectedChannelIndex, selectedBarIndex);
						}}
					>
						<DocumentDuplicateIcon
							aria-hidden="true"
							className="size-3 text-cyan-300"
						/>
						<span>Clone</span>
					</button>
				</div>
			</div>
		</section>
	);
};

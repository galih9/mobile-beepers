import {
	DocumentDuplicateIcon,
	MinusIcon,
	PlusIcon,
	SpeakerWaveIcon,
	SpeakerXMarkIcon,
} from "@heroicons/react/24/outline";
import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import type { FunctionComponent } from "../../../common/types";
import { getStepsPerBar } from "../store/songHelpers";
import { useChiptuneStore } from "../store/useChiptuneStore";

const BAR_CELL_PITCH = 34; // 32px square cell + 2px gap

type LoopDragMode = "start" | "end" | "move";

interface LoopDragSession {
	mode: LoopDragMode;
	anchorBar: number;
	initialStart: number;
	initialEnd: number;
}

export const SongMatrixPanel = (): FunctionComponent => {
	const matrixScrollRef = useRef<HTMLDivElement | null>(null);
	const loopTrackRef = useRef<HTMLDivElement | null>(null);
	const loopDragRef = useRef<LoopDragSession | null>(null);

	const song = useChiptuneStore((state) => state.song);
	const selectedChannelIndex = useChiptuneStore(
		(state) => state.selectedChannelIndex
	);
	const selectedBarIndex = useChiptuneStore((state) => state.selectedBarIndex);
	const isPlaying = useChiptuneStore((state) => state.isPlaying);
	const playbackBar = useChiptuneStore((state) => state.playbackBar);
	const playbackStep = useChiptuneStore((state) => state.playbackStep);

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
	const setBarPatternIndex = useChiptuneStore(
		(state) => state.setBarPatternIndex
	);
	const clonePatternToBar = useChiptuneStore(
		(state) => state.clonePatternToBar
	);
	const setLoopRange = useChiptuneStore((state) => state.setLoopRange);

	const activeChannel = song.channels[selectedChannelIndex];
	const currentPatternNumber =
		activeChannel?.barSequence[selectedBarIndex] ?? 0;
	const stepsPerBar = getStepsPerBar(song);

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

		// Clicked outside capsule: start a fresh loop drag at tapped bar
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

		// Move entire loop window preserving length
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
			<div className="flex">
				{/* Left Channel Mute / Solo / Select Rail */}
				<div className="flex w-24 shrink-0 flex-col gap-0.5 border-r border-slate-900 bg-slate-950 px-1.5 py-1.5">
					{song.channels.map((channel, channelIndex) => {
						const isSelected = channelIndex === selectedChannelIndex;
						return (
							<div
								key={`rail-${channel.id}`}
								className={`flex h-7 items-center gap-1 rounded px-1 ${
									isSelected ? "bg-slate-800/90" : "bg-black/40"
								}`}
							>
								<button
									type="button"
									aria-label={
										channel.muted
											? `Unmute ${channel.name}`
											: `Mute ${channel.name}`
									}
									className={`flex size-4 shrink-0 items-center justify-center ${
										channel.muted
											? "text-rose-400"
											: "text-slate-300 hover:text-white"
									}`}
									onClick={(): void => {
										toggleChannelMute(channelIndex);
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
										toggleChannelSolo(channelIndex);
									}}
								>
									S
								</button>
								<button
									className="min-w-0 flex-1 truncate text-left text-[10px] font-semibold"
									style={{ color: channel.color }}
									type="button"
									onClick={(): void => {
										setSelectedChannelIndex(channelIndex);
									}}
								>
									{channel.name}
								</button>
							</div>
						);
					})}

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
						{/* Channel Bar Rows */}
						{song.channels.map((channel, channelIndex) => {
							const isChannelSelected = channelIndex === selectedChannelIndex;
							return (
								<div key={channel.id} className="flex items-center gap-0.5">
									{channel.barSequence.map((patternNumber, barIndex) => {
										const isSlotSelected =
											isChannelSelected && barIndex === selectedBarIndex;
										return (
											<button
												key={`${channel.id}-bar-${barIndex}`}
												aria-label={`${channel.name} bar ${barIndex + 1} pattern ${patternNumber}`}
												className="flex h-7 w-8 shrink-0 items-center justify-center rounded-[2px] font-mono text-xs font-extrabold transition"
												type="button"
												style={{
													backgroundColor: isSlotSelected
														? channel.color
														: patternNumber > 0
															? "#3d3d3d"
															: "#000000",
													color: isSlotSelected ? "#000000" : channel.color,
													opacity:
														!isSlotSelected && patternNumber === 0 ? 0.72 : 1,
												}}
												onClick={(): void => {
													if (isSlotSelected) {
														setBarPatternIndex(
															channelIndex,
															barIndex,
															patternNumber + 1
														);
													} else {
														setSelectedChannelIndex(channelIndex);
														setSelectedBarIndex(barIndex);
													}
												}}
											>
												{patternNumber}
											</button>
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
								height: `${song.channels.length * 30 - 2}px`,
								left: `${isPlaying ? playheadLeftPixels : selectedBarIndex * BAR_CELL_PITCH}px`,
							}}
						/>

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

			{/* Slim Pattern Stepper & Clone Strip */}
			<div className="flex items-center justify-between border-t border-slate-900 bg-slate-950 px-2.5 py-1">
				<span className="font-mono text-[10px] text-slate-400">
					Drag purple bar edges or body to set loop · Tap cell twice to cycle #
				</span>
				<div className="flex shrink-0 items-center gap-1">
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

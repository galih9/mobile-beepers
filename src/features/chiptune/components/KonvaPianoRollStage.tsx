import type Konva from "konva";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Circle, Group, Layer, Line, Rect, Stage, Text } from "react-konva";
import type { FunctionComponent } from "../../../common/types";
import { ARTICULATION_LABELS, ORNAMENT_LABELS } from "../audio/articulation";
import { useChiptuneStore } from "../store/useChiptuneStore";
import { useCanvasPalette } from "./useCanvasPalette";
import type {
	Channel,
	EditorTool,
	NoteArticulation,
	NoteBatchMoveUpdate,
	NoteBendStyle,
	NoteEvent,
	PianoRollRow,
} from "../types/music";

interface GhostChannelLayer {
	color: string;
	notes: Array<NoteEvent>;
}

interface KonvaPianoRollStageProps {
	rows: Array<PianoRollRow>;
	stepsPerBar: number;
	stepsPerBeat: number;
	rowHeight: number;
	stepWidth: number;
	activeChannel: Channel;
	activeNotes: Array<NoteEvent>;
	ghostChannels: Array<GhostChannelLayer>;
	showGhostNotes: boolean;
	isPlayingThisBar: boolean;
	playbackStep: number;
	activeTool: EditorTool;
	defaultNoteDuration: number;
	defaultNoteVelocity: number;
	/** Articulation given to newly drawn notes */
	defaultNoteArticulation?: NoteArticulation;
	onAddOrReplaceNote: (noteInput: Omit<NoteEvent, "id">) => void;
	onRemoveNote: (step: number, pitch: number) => void;
	onResizeNote: (step: number, pitch: number, duration: number) => void;
	onMoveNote: (
		fromStep: number,
		fromPitch: number,
		toStep: number,
		toPitch: number
	) => void;
	onMoveNotesBatch: (
		updates: Array<NoteBatchMoveUpdate>,
		deduplicateUnselected?: boolean
	) => void;
	onCyclePitchBend: (step: number, pitch: number) => void;
	onSetNotePitchBend: (
		step: number,
		pitch: number,
		pitchBend: number,
		bendStyle?: NoteBendStyle
	) => void;
	onCycleNoteFade: (step: number, pitch: number) => void;
	onCycleNoteRatchet: (step: number, pitch: number) => void;
	onPreviewPitch: (pitch: number, note?: NoteEvent) => void;
}

interface DrawingNoteSession {
	step: number;
	pitch: number;
	lastDuration: number;
	lastTargetPitch: number;
}

interface BendDragSession {
	step: number;
	pitch: number;
	duration: number;
	startClientY: number;
	grabRatio: number;
	canBend: boolean;
	didBendDrag: boolean;
	lastPreviewPitch: number;
}

interface SelectionBoxSession {
	startX: number;
	startY: number;
	additive: boolean;
	initialIds: Array<string>;
}

interface SelectionRectBounds {
	x: number;
	y: number;
	width: number;
	height: number;
}

interface GroupNoteSnapshot {
	id: string;
	initialStep: number;
	initialPitch: number;
	duration: number;
	initialRowIndex: number;
}

interface GroupNoteDragSession {
	anchorId: string;
	startPointerX: number;
	startPointerY: number;
	didDrag: boolean;
	minStepDelta: number;
	maxStepDelta: number;
	minRowDelta: number;
	maxRowDelta: number;
	lastAppliedStepDelta: number;
	lastAppliedRowDelta: number;
	snapshots: Array<GroupNoteSnapshot>;
}

const clampValue = (
	value: number,
	minimum: number,
	maximum: number
): number => {
	return Math.max(minimum, Math.min(maximum, value));
};

const resolveEffectiveFadeForNote = (
	note: NoteEvent,
	instrumentFadeInOut: number
): number => {
	if (note.fadeMode === "fadeIn") {
		return -0.85;
	}
	if (note.fadeMode === "fadeOut") {
		return 0.85;
	}
	return clampValue(instrumentFadeInOut, -1, 1);
};

const buildNotePolygonPoints = (options: {
	localEndX: number;
	localStartCenterY: number;
	localEndCenterY: number;
	stepWidth: number;
	duration: number;
	pitchBend: number;
	bendStyle: NoteBendStyle;
	isPitchChannel: boolean;
	baseHalfHeight: number;
	effectiveFade: number;
}): Array<number> => {
	const {
		localEndX,
		localStartCenterY,
		localEndCenterY,
		stepWidth,
		duration,
		pitchBend,
		bendStyle,
		isPitchChannel,
		baseHalfHeight,
		effectiveFade,
	} = options;

	const spine: Array<{ x: number; y: number }> = [];
	if (!isPitchChannel || pitchBend === 0) {
		spine.push({ x: 0, y: localStartCenterY });
		spine.push({ x: localEndX, y: localStartCenterY });
	} else if (duration <= 2 || bendStyle === "continuous") {
		spine.push({ x: 0, y: localStartCenterY });
		spine.push({ x: localEndX, y: localEndCenterY });
	} else if (bendStyle === "early") {
		const bendStartX = Math.min(stepWidth * 0.4, localEndX * 0.2);
		const bendEndX = Math.max(
			bendStartX + 4,
			Math.min(stepWidth * 1.35, localEndX * 0.55)
		);
		spine.push({ x: 0, y: localStartCenterY });
		spine.push({ x: bendStartX, y: localStartCenterY });
		spine.push({ x: bendEndX, y: localEndCenterY });
		spine.push({ x: localEndX, y: localEndCenterY });
	} else {
		const bendStartX = Math.max(
			stepWidth * 0.6,
			localEndX - Math.min(stepWidth * 1.8, localEndX * 0.5)
		);
		spine.push({ x: 0, y: localStartCenterY });
		spine.push({ x: bendStartX, y: localStartCenterY });
		spine.push({ x: localEndX, y: localEndCenterY });
	}

	let startScale = 1;
	let endScale = 1;
	if (effectiveFade < -0.05) {
		startScale = Math.max(0.18, 1 - Math.abs(effectiveFade) * 0.82);
	} else if (effectiveFade > 0.05) {
		endScale = Math.max(0.18, 1 - effectiveFade * 0.82);
	}

	const topPoints: Array<number> = [];
	const bottomPoints: Array<number> = [];
	const totalSpan = Math.max(1, localEndX);

	for (const point of spine) {
		const ratio = clampValue(point.x / totalSpan, 0, 1);
		const halfHeight =
			baseHalfHeight * (startScale + (endScale - startScale) * ratio);
		topPoints.push(point.x, point.y - halfHeight);
	}

	for (let index = spine.length - 1; index >= 0; index -= 1) {
		const point = spine[index];
		if (!point) {
			continue;
		}
		const ratio = clampValue(point.x / totalSpan, 0, 1);
		const halfHeight =
			baseHalfHeight * (startScale + (endScale - startScale) * ratio);
		bottomPoints.push(point.x, point.y + halfHeight);
	}

	return [...topPoints, ...bottomPoints];
};

export const KonvaPianoRollStage = ({
	rows,
	stepsPerBar,
	stepsPerBeat,
	rowHeight,
	stepWidth,
	activeChannel,
	activeNotes,
	ghostChannels,
	showGhostNotes,
	isPlayingThisBar,
	playbackStep,
	activeTool,
	defaultNoteDuration,
	defaultNoteVelocity,
	defaultNoteArticulation,
	onAddOrReplaceNote,
	onRemoveNote,
	onResizeNote,
	onMoveNote,
	onMoveNotesBatch,
	onCyclePitchBend,
	onSetNotePitchBend,
	onCycleNoteFade,
	onCycleNoteRatchet,
	onPreviewPitch,
}: KonvaPianoRollStageProps): FunctionComponent => {
	const stageWidth = Math.max(1, stepsPerBar * stepWidth);
	const stageHeight = Math.max(1, rows.length * rowHeight);

	const drawingNoteRef = useRef<DrawingNoteSession | null>(null);
	const bendDragRef = useRef<BendDragSession | null>(null);
	const selectionBoxRef = useRef<SelectionBoxSession | null>(null);
	const groupDragRef = useRef<GroupNoteDragSession | null>(null);
	const [cursorMode, setCursorMode] = useState<string>("");
	const palette = useCanvasPalette();
	const showNoteVelocityLabels = useChiptuneStore(
		(state) => state.showNoteVelocityLabels
	);
	// Note selection lives in the store so the volume lane and toolbar share it
	const selectedNoteIds = useChiptuneStore((state) => state.selectedNoteIds);
	const setSelectedNoteIds = useChiptuneStore(
		(state) => state.setSelectedNoteIds
	);
	const [selectionBounds, setSelectionBounds] =
		useState<SelectionRectBounds | null>(null);

	const selectedNoteIdSet = useMemo(
		() => new Set(selectedNoteIds),
		[selectedNoteIds]
	);

	const pitchToRowIndex = useMemo(() => {
		const map = new Map<number, number>();
		rows.forEach((row, index) => {
			map.set(row.pitch, index);
		});
		return map;
	}, [rows]);

	const beatColumns = useMemo(() => {
		const columns: Array<{ beat: number; x: number; width: number }> = [];
		for (let beat = 0; beat * stepsPerBeat < stepsPerBar; beat += 1) {
			columns.push({
				beat,
				x: beat * stepsPerBeat * stepWidth,
				width: stepsPerBeat * stepWidth,
			});
		}
		return columns;
	}, [stepWidth, stepsPerBar, stepsPerBeat]);

	const stepDividers = useMemo(() => {
		return Array.from({ length: stepsPerBar + 1 }, (_, step) => ({
			step,
			x: step * stepWidth,
			isBeatBoundary: step % stepsPerBeat === 0,
		}));
	}, [stepWidth, stepsPerBar, stepsPerBeat]);

	const buildGroupMoveUpdates = useCallback(
		(
			session: GroupNoteDragSession,
			stepDelta: number,
			rowDelta: number
		): Array<NoteBatchMoveUpdate> => {
			return session.snapshots.map((snapshot) => {
				const destinationRow = rows[snapshot.initialRowIndex + rowDelta];
				return {
					id: snapshot.id,
					step: snapshot.initialStep + stepDelta,
					pitch: destinationRow ? destinationRow.pitch : snapshot.initialPitch,
				};
			});
		},
		[rows]
	);

	const finishPointerInteractions = useCallback((): void => {
		if (selectionBoxRef.current) {
			selectionBoxRef.current = null;
			setSelectionBounds(null);
			setCursorMode("");
		}
		const groupDrag = groupDragRef.current;
		if (groupDrag) {
			if (
				groupDrag.didDrag &&
				(groupDrag.lastAppliedStepDelta !== 0 ||
					groupDrag.lastAppliedRowDelta !== 0)
			) {
				const finalUpdates = buildGroupMoveUpdates(
					groupDrag,
					groupDrag.lastAppliedStepDelta,
					groupDrag.lastAppliedRowDelta
				);
				onMoveNotesBatch(finalUpdates, true);
			}
			groupDragRef.current = null;
			setCursorMode("");
		}
		const bendDrag = bendDragRef.current;
		if (bendDrag) {
			if (!bendDrag.didBendDrag) {
				if (activeTool === "slide") {
					onCyclePitchBend(bendDrag.step, bendDrag.pitch);
				} else if (activeTool === "draw" || activeTool === "erase") {
					onRemoveNote(bendDrag.step, bendDrag.pitch);
				} else if (activeTool === "fade") {
					onCycleNoteFade(bendDrag.step, bendDrag.pitch);
				} else if (activeTool === "stutter") {
					onCycleNoteRatchet(bendDrag.step, bendDrag.pitch);
				}
			}
			bendDragRef.current = null;
			setCursorMode("");
		}
		drawingNoteRef.current = null;
	}, [
		activeTool,
		buildGroupMoveUpdates,
		onCycleNoteFade,
		onCycleNoteRatchet,
		onCyclePitchBend,
		onMoveNotesBatch,
		onRemoveNote,
	]);

	useEffect(() => {
		const handleWindowPointerEnd = (): void => {
			if (
				bendDragRef.current ||
				drawingNoteRef.current ||
				selectionBoxRef.current ||
				groupDragRef.current
			) {
				finishPointerInteractions();
			}
		};
		window.addEventListener("pointerup", handleWindowPointerEnd);
		window.addEventListener("pointercancel", handleWindowPointerEnd);
		return (): void => {
			window.removeEventListener("pointerup", handleWindowPointerEnd);
			window.removeEventListener("pointercancel", handleWindowPointerEnd);
		};
	}, [finishPointerInteractions]);

	const handleGridPointerDown = (
		event: Konva.KonvaEventObject<PointerEvent>
	): void => {
		const stage = event.target.getStage();
		const pointerPosition = stage?.getPointerPosition();
		if (!pointerPosition) {
			return;
		}
		if (activeTool === "select") {
			const startX = clampValue(pointerPosition.x, 0, stageWidth);
			const startY = clampValue(pointerPosition.y, 0, stageHeight);
			const additive = Boolean(event.evt.shiftKey);
			selectionBoxRef.current = {
				startX,
				startY,
				additive,
				initialIds: additive ? selectedNoteIds : [],
			};
			if (!additive) {
				setSelectedNoteIds([]);
			}
			setCursorMode("crosshair");
			setSelectionBounds({ x: startX, y: startY, width: 0, height: 0 });
			return;
		}
		if (activeTool !== "draw") {
			return;
		}
		const step = clampValue(
			Math.floor(pointerPosition.x / stepWidth),
			0,
			stepsPerBar - 1
		);
		const rowIndex = clampValue(
			Math.floor(pointerPosition.y / rowHeight),
			0,
			rows.length - 1
		);
		const row = rows[rowIndex];
		if (!row) {
			return;
		}

		const initialDuration =
			activeChannel.type === "drum" ? 1 : defaultNoteDuration;
		onAddOrReplaceNote({
			step,
			pitch: row.pitch,
			duration: initialDuration,
			velocity: defaultNoteVelocity,
			pitchBend: 0,
			...(defaultNoteArticulation
				? { articulation: defaultNoteArticulation }
				: {}),
		});
		onPreviewPitch(row.pitch, {
			id: "draw-preview",
			step,
			pitch: row.pitch,
			duration: initialDuration,
			velocity: defaultNoteVelocity,
			pitchBend: 0,
			articulation: defaultNoteArticulation,
		});
		drawingNoteRef.current = {
			step,
			pitch: row.pitch,
			lastDuration: initialDuration,
			lastTargetPitch: row.pitch,
		};
	};

	const handleStagePointerMove = (
		event: Konva.KonvaEventObject<PointerEvent>
	): void => {
		const stage = event.target.getStage();
		const pointerPosition = stage?.getPointerPosition();
		if (!pointerPosition) {
			return;
		}

		const selectionBox = selectionBoxRef.current;
		if (selectionBox) {
			const clampedX = clampValue(pointerPosition.x, 0, stageWidth);
			const clampedY = clampValue(pointerPosition.y, 0, stageHeight);
			const left = Math.min(selectionBox.startX, clampedX);
			const right = Math.max(selectionBox.startX, clampedX);
			const top = Math.min(selectionBox.startY, clampedY);
			const bottom = Math.max(selectionBox.startY, clampedY);
			setSelectionBounds({
				x: left,
				y: top,
				width: right - left,
				height: bottom - top,
			});

			if (right - left >= 2 || bottom - top >= 2) {
				const horizontalInset = stepWidth < 12 ? 1 : 2;
				const hitIds: Array<string> = [];
				for (const note of activeNotes) {
					const rowIndex = pitchToRowIndex.get(note.pitch);
					if (rowIndex === undefined) {
						continue;
					}
					const noteLeft = note.step * stepWidth + horizontalInset;
					const noteRight = Math.max(
						noteLeft + 4,
						(note.step + note.duration) * stepWidth - horizontalInset
					);
					const noteTop = rowIndex * rowHeight;
					const noteBottom = noteTop + rowHeight;
					if (
						noteRight >= left &&
						noteLeft <= right &&
						noteBottom >= top &&
						noteTop <= bottom
					) {
						hitIds.push(note.id);
					}
				}
				if (selectionBox.additive) {
					const merged = new Set(selectionBox.initialIds);
					for (const hitId of hitIds) {
						merged.add(hitId);
					}
					setSelectedNoteIds(Array.from(merged));
				} else {
					setSelectedNoteIds(hitIds);
				}
			}
			return;
		}

		const groupDrag = groupDragRef.current;
		if (groupDrag) {
			const dragDistance = Math.hypot(
				pointerPosition.x - groupDrag.startPointerX,
				pointerPosition.y - groupDrag.startPointerY
			);
			if (!groupDrag.didDrag && dragDistance < 3) {
				return;
			}
			groupDrag.didDrag = true;
			setCursorMode("grabbing");

			const rawStepDelta = Math.round(
				(pointerPosition.x - groupDrag.startPointerX) / stepWidth
			);
			const rawRowDelta = Math.round(
				(pointerPosition.y - groupDrag.startPointerY) / rowHeight
			);
			const clampedStepDelta = clampValue(
				rawStepDelta,
				groupDrag.minStepDelta,
				groupDrag.maxStepDelta
			);
			const clampedRowDelta = clampValue(
				rawRowDelta,
				groupDrag.minRowDelta,
				groupDrag.maxRowDelta
			);

			if (
				clampedStepDelta !== groupDrag.lastAppliedStepDelta ||
				clampedRowDelta !== groupDrag.lastAppliedRowDelta
			) {
				const didRowChange = clampedRowDelta !== groupDrag.lastAppliedRowDelta;
				groupDrag.lastAppliedStepDelta = clampedStepDelta;
				groupDrag.lastAppliedRowDelta = clampedRowDelta;
				const updates = buildGroupMoveUpdates(
					groupDrag,
					clampedStepDelta,
					clampedRowDelta
				);
				onMoveNotesBatch(updates, false);
				if (didRowChange) {
					const anchorUpdate = updates.find(
						(update) => update.id === groupDrag.anchorId
					);
					if (anchorUpdate) {
						onPreviewPitch(anchorUpdate.pitch);
					}
				}
			}
			return;
		}

		const bendDrag = bendDragRef.current;
		if (bendDrag && bendDrag.canBend) {
			const verticalDelta = Math.abs(pointerPosition.y - bendDrag.startClientY);
			if (bendDrag.didBendDrag || verticalDelta >= 4) {
				bendDrag.didBendDrag = true;
				setCursorMode("ns-resize");
				const hoveredRowIndex = clampValue(
					Math.floor(pointerPosition.y / rowHeight),
					0,
					rows.length - 1
				);
				const hoveredRow = rows[hoveredRowIndex];
				if (hoveredRow) {
					const nextPitchBend = clampValue(
						hoveredRow.pitch - bendDrag.pitch,
						-24,
						24
					);
					const nextBendStyle: NoteBendStyle =
						bendDrag.duration <= 2
							? "continuous"
							: bendDrag.grabRatio < 0.45
								? "early"
								: "late";
					onSetNotePitchBend(
						bendDrag.step,
						bendDrag.pitch,
						nextPitchBend,
						nextBendStyle
					);
					if (hoveredRow.pitch !== bendDrag.lastPreviewPitch) {
						bendDrag.lastPreviewPitch = hoveredRow.pitch;
						onPreviewPitch(hoveredRow.pitch);
					}
				}
			}
			return;
		}

		const drawing = drawingNoteRef.current;
		if (!drawing || activeChannel.type === "drum") {
			return;
		}
		const hoveredStep = clampValue(
			Math.floor(pointerPosition.x / stepWidth),
			0,
			stepsPerBar - 1
		);
		const nextDuration = Math.max(1, hoveredStep - drawing.step + 1);
		if (hoveredStep > drawing.step && nextDuration !== drawing.lastDuration) {
			drawing.lastDuration = nextDuration;
			onResizeNote(drawing.step, drawing.pitch, nextDuration);
		}
		const hoveredRowIndex = clampValue(
			Math.floor(pointerPosition.y / rowHeight),
			0,
			rows.length - 1
		);
		const hoveredRow = rows[hoveredRowIndex];
		if (hoveredRow && hoveredRow.pitch !== drawing.lastTargetPitch) {
			const nextPitchBend = clampValue(
				hoveredRow.pitch - drawing.pitch,
				-24,
				24
			);
			drawing.lastTargetPitch = hoveredRow.pitch;
			onSetNotePitchBend(drawing.step, drawing.pitch, nextPitchBend, "late");
			onPreviewPitch(hoveredRow.pitch);
		}
	};

	const defaultStageCursor =
		activeTool === "select"
			? "default"
			: activeTool === "erase"
				? "not-allowed"
				: activeTool === "slide"
					? "ns-resize"
					: activeTool === "fade" || activeTool === "stutter"
						? "pointer"
						: activeTool === "move"
							? "grab"
							: "crosshair";

	const instrumentFadeInOut = activeChannel.instrument.fadeInOut ?? 0;

	return (
		<Stage
			height={stageHeight}
			width={stageWidth}
			style={{
				display: "block",
				cursor: cursorMode || defaultStageCursor,
				touchAction: "pan-y",
			}}
			onPointerMove={handleStagePointerMove}
			onPointerUp={finishPointerInteractions}
		>
			{/* Non-interactive Background Grid, Ghost Notes & Playhead Layer */}
			<Layer listening={false}>
				{beatColumns.map((column) => (
					<Rect
						key={`beat-bg-${column.beat}`}
						fill={column.beat % 2 === 0 ? palette.beatEven : palette.beatOdd}
						height={stageHeight}
						width={column.width}
						x={column.x}
						y={0}
					/>
				))}

				{rows.map((row, rowIndex) => {
					const y = rowIndex * rowHeight;
					const fill = row.isRoot
						? palette.rootRow
						: !row.inScale
							? palette.outOfScaleRow
							: undefined;
					return (
						<Group key={`row-bg-${row.pitch}`}>
							{fill && (
								<Rect
									fill={fill}
									height={rowHeight}
									width={stageWidth}
									x={0}
									y={y}
								/>
							)}
							<Line
								points={[0, y + rowHeight, stageWidth, y + rowHeight]}
								stroke={row.isRoot ? palette.rootRowLine : palette.rowLine}
								strokeWidth={row.isRoot ? 1.2 : 1}
							/>
						</Group>
					);
				})}

				{stepDividers.map((divider) => (
					<Line
						key={`step-div-${divider.step}`}
						points={[divider.x, 0, divider.x, stageHeight]}
						strokeWidth={divider.isBeatBoundary ? 1.5 : 1}
						stroke={
							divider.isBeatBoundary ? palette.beatLine : palette.stepLine
						}
					/>
				))}

				{showGhostNotes &&
					activeChannel.type === "pitch" &&
					ghostChannels.map((ghost, ghostIndex) =>
						ghost.notes.map((note) => {
							const rowIndex = pitchToRowIndex.get(note.pitch);
							if (rowIndex === undefined) {
								return null;
							}
							const x = note.step * stepWidth + 2;
							const centerY = rowIndex * rowHeight + rowHeight / 2;
							const width = Math.max(8, note.duration * stepWidth - 4);
							return (
								<Rect
									key={`ghost-${ghostIndex}-${note.id}`}
									cornerRadius={3}
									fill={ghost.color}
									height={6}
									opacity={0.28}
									width={width}
									x={x}
									y={centerY - 3}
								/>
							);
						})
					)}

				{isPlayingThisBar && (
					<Group>
						<Rect
							fill={palette.playheadFill}
							height={stageHeight}
							width={stepWidth}
							x={playbackStep * stepWidth}
							y={0}
						/>
						<Line
							stroke={palette.playhead}
							strokeWidth={2}
							points={[
								playbackStep * stepWidth,
								0,
								playbackStep * stepWidth,
								stageHeight,
							]}
						/>
					</Group>
				)}
			</Layer>

			{/* Interactive Grid Hit Target + Draggable, Bendable & Fade-Tapered Konva Note Layer */}
			<Layer>
				<Rect
					fill="transparent"
					height={stageHeight}
					width={stageWidth}
					x={0}
					y={0}
					onPointerDown={handleGridPointerDown}
				/>

				{activeNotes.map((note) => {
					const rowIndex = pitchToRowIndex.get(note.pitch);
					if (rowIndex === undefined) {
						return null;
					}
					const row = rows[rowIndex];
					const noteColor =
						activeChannel.type === "drum" && row?.accentColor
							? row.accentColor
							: activeChannel.color;

					const horizontalInset = stepWidth < 12 ? 1 : 2;
					const minNoteSpan = Math.max(
						3,
						Math.min(10, stepWidth - horizontalInset * 2)
					);
					// Micro-timing nudge is drawn as a small horizontal shift
					const offsetPixels = (note.timingOffset ?? 0) * stepWidth;
					// Quieter notes are drawn dimmer (velocity 0.1 → ~42%, 1.0 → 100%)
					const velocityOpacity =
						0.35 + 0.65 * clampValue(note.velocity, 0.1, 1);
					const startX = note.step * stepWidth + horizontalInset + offsetPixels;
					const endX = Math.max(
						startX + minNoteSpan,
						(note.step + note.duration) * stepWidth - horizontalInset
					);
					const localEndX = endX - startX;
					const startRowY = rowIndex * rowHeight;
					const localStartCenterY = rowHeight / 2;

					const targetRowIndex =
						activeChannel.type === "pitch" && note.pitchBend !== 0
							? (pitchToRowIndex.get(note.pitch + note.pitchBend) ??
								clampValue(
									rowIndex - Math.sign(note.pitchBend) * 2,
									0,
									rows.length - 1
								))
							: rowIndex;
					const localEndCenterY =
						targetRowIndex * rowHeight + rowHeight / 2 - startRowY;
					const endCenterY = targetRowIndex * rowHeight + rowHeight / 2;

					const coreHalfHeight = Math.max(5.5, (rowHeight - 4) * 0.38);
					const haloHalfHeight = Math.max(7.5, (rowHeight - 2) * 0.48);
					const effectiveFade = resolveEffectiveFadeForNote(
						note,
						instrumentFadeInOut
					);
					const bendStyle: NoteBendStyle = note.bendStyle ?? "late";

					const haloPoints = buildNotePolygonPoints({
						localEndX,
						localStartCenterY,
						localEndCenterY,
						stepWidth,
						duration: note.duration,
						pitchBend: note.pitchBend,
						bendStyle,
						isPitchChannel: activeChannel.type === "pitch",
						baseHalfHeight: haloHalfHeight,
						effectiveFade,
					});

					const corePoints = buildNotePolygonPoints({
						localEndX,
						localStartCenterY,
						localEndCenterY,
						stepWidth,
						duration: note.duration,
						pitchBend: note.pitchBend,
						bendStyle,
						isPitchChannel: activeChannel.type === "pitch",
						baseHalfHeight: coreHalfHeight,
						effectiveFade,
					});

					const isMoveTool = activeTool === "move";
					const isSelectTool = activeTool === "select";
					const isNoteSelected = selectedNoteIdSet.has(note.id);
					const isMultiSelectedMove =
						isMoveTool && isNoteSelected && selectedNoteIds.length > 1;
					const showResizeHandle =
						activeChannel.type === "pitch" &&
						!isSelectTool &&
						activeTool !== "erase";

					return (
						<Group key={note.id}>
							<Group
								dragDistance={5}
								draggable={isMoveTool && !isMultiSelectedMove}
								x={startX}
								y={startRowY}
								dragBoundFunc={(position): { x: number; y: number } => ({
									x: clampValue(
										position.x,
										2,
										Math.max(2, stageWidth - note.duration * stepWidth + 2)
									),
									y: clampValue(
										position.y,
										0,
										Math.max(0, stageHeight - rowHeight)
									),
								})}
								onClick={(): void => {
									if (isMoveTool) {
										onPreviewPitch(note.pitch, note);
									}
								}}
								onDragEnd={(event): void => {
									setCursorMode("");
									const node = event.target;
									const targetStep = clampValue(
										Math.round((node.x() - 2 - offsetPixels) / stepWidth),
										0,
										stepsPerBar - 1
									);
									const targetRow = clampValue(
										Math.round(node.y() / rowHeight),
										0,
										rows.length - 1
									);
									const destinationRow = rows[targetRow];
									node.position({
										x: targetStep * stepWidth + 2 + offsetPixels,
										y: targetRow * rowHeight,
									});
									if (!destinationRow) {
										node.position({ x: startX, y: startRowY });
										return;
									}
									if (
										targetStep !== note.step ||
										destinationRow.pitch !== note.pitch
									) {
										onMoveNote(
											note.step,
											note.pitch,
											targetStep,
											destinationRow.pitch
										);
										onPreviewPitch(destinationRow.pitch);
									}
								}}
								onDragStart={(): void => {
									setCursorMode("grabbing");
									onPreviewPitch(note.pitch, note);
								}}
								onMouseEnter={(): void => {
									if (groupDragRef.current || selectionBoxRef.current) {
										return;
									}
									setCursorMode(
										isSelectTool
											? isNoteSelected
												? "grab"
												: "pointer"
											: activeTool === "erase"
												? "not-allowed"
												: activeTool === "slide"
													? "ns-resize"
													: activeTool === "fade" || activeTool === "stutter"
														? "pointer"
														: isMoveTool
															? "grab"
															: "ns-resize"
									);
								}}
								onMouseLeave={(): void => {
									if (
										!bendDragRef.current &&
										!groupDragRef.current &&
										!selectionBoxRef.current
									) {
										setCursorMode("");
									}
								}}
								onPointerDown={(event): void => {
									if (isSelectTool || isMultiSelectedMove) {
										event.cancelBubble = true;
										const stage = event.target.getStage();
										const pointerPosition = stage?.getPointerPosition();
										if (!pointerPosition) {
											return;
										}
										const isShiftPressed = Boolean(event.evt.shiftKey);
										if (isSelectTool && isShiftPressed) {
											if (isNoteSelected) {
												setSelectedNoteIds(
													selectedNoteIds.filter((id) => id !== note.id)
												);
												return;
											}
										}

										const effectiveIds =
											isSelectTool && isShiftPressed
												? [...selectedNoteIds, note.id]
												: isNoteSelected
													? selectedNoteIds
													: [note.id];
										if (!isNoteSelected || (isSelectTool && isShiftPressed)) {
											setSelectedNoteIds(effectiveIds);
										}
										onPreviewPitch(note.pitch, note);

										const effectiveIdSet = new Set(effectiveIds);
										const snapshots: Array<GroupNoteSnapshot> = [];
										let minStepDelta = -stepsPerBar;
										let maxStepDelta = stepsPerBar;
										let minRowDelta = -rows.length;
										let maxRowDelta = rows.length;

										for (const item of activeNotes) {
											if (!effectiveIdSet.has(item.id)) {
												continue;
											}
											const itemRowIndex = pitchToRowIndex.get(item.pitch);
											if (itemRowIndex === undefined) {
												continue;
											}
											snapshots.push({
												id: item.id,
												initialStep: item.step,
												initialPitch: item.pitch,
												duration: item.duration,
												initialRowIndex: itemRowIndex,
											});
											minStepDelta = Math.max(minStepDelta, -item.step);
											maxStepDelta = Math.min(
												maxStepDelta,
												stepsPerBar - 1 - item.step
											);
											minRowDelta = Math.max(minRowDelta, -itemRowIndex);
											maxRowDelta = Math.min(
												maxRowDelta,
												rows.length - 1 - itemRowIndex
											);
										}

										if (snapshots.length > 0) {
											groupDragRef.current = {
												anchorId: note.id,
												startPointerX: pointerPosition.x,
												startPointerY: pointerPosition.y,
												didDrag: false,
												minStepDelta,
												maxStepDelta,
												minRowDelta,
												maxRowDelta,
												lastAppliedStepDelta: 0,
												lastAppliedRowDelta: 0,
												snapshots,
											};
											setCursorMode("grabbing");
										}
										return;
									}
									if (isMoveTool) {
										return;
									}
									event.cancelBubble = true;
									const stage = event.target.getStage();
									const pointerPosition = stage?.getPointerPosition();
									if (!pointerPosition) {
										return;
									}
									const canBend =
										activeChannel.type === "pitch" &&
										(activeTool === "draw" || activeTool === "slide");
									if (canBend) {
										onPreviewPitch(note.pitch, note);
									}
									bendDragRef.current = {
										step: note.step,
										pitch: note.pitch,
										duration: note.duration,
										startClientY: pointerPosition.y,
										grabRatio:
											(pointerPosition.x - startX) / Math.max(1, localEndX),
										canBend,
										didBendDrag: false,
										lastPreviewPitch: note.pitch + note.pitchBend,
									};
								}}
							>
								<Rect
									fill="transparent"
									height={rowHeight}
									width={Math.max(6, localEndX - (showResizeHandle ? 6 : 0))}
									x={0}
									y={0}
								/>
								<Line
									closed
									fill={noteColor}
									listening={false}
									opacity={isNoteSelected ? 0.52 : 0.3}
									points={haloPoints}
									stroke={isNoteSelected ? palette.selectedNoteHalo : undefined}
									strokeWidth={isNoteSelected ? 1 : 0}
								/>
								<Line
									closed
									fill={noteColor}
									listening={false}
									opacity={velocityOpacity}
									points={corePoints}
									stroke={
										isNoteSelected
											? palette.selectedNoteOutline
											: palette.noteOutline
									}
									strokeWidth={
										isNoteSelected ? 1.8 : palette.noteOutline ? 0.75 : 0
									}
								/>
								{note.pitchBend !== 0 && (
									<Text
										fill={palette.bendLabel}
										fontFamily="monospace"
										fontSize={9}
										fontStyle="bold"
										listening={false}
										text={`${note.pitchBend > 0 ? "+" : ""}${note.pitchBend}st`}
										x={4}
										y={Math.max(1, localStartCenterY - 11)}
									/>
								)}
								{(note.ratchet ?? 1) > 1 && (
									<Text
										fill={palette.ratchetLabel}
										fontFamily="monospace"
										fontSize={8}
										fontStyle="bold"
										listening={false}
										text={`x${note.ratchet ?? 1}`}
										x={Math.max(4, localEndX / 2 - 6)}
										y={Math.max(1, localStartCenterY + 3)}
									/>
								)}
								{note.fadeMode && note.fadeMode !== "none" && (
									<Text
										fill={palette.fadeLabel}
										fontFamily="monospace"
										fontSize={8}
										fontStyle="bold"
										listening={false}
										text={note.fadeMode === "fadeIn" ? "IN" : "OUT"}
										x={Math.max(4, localEndX - 22)}
										y={Math.max(1, localEndCenterY - 10)}
									/>
								)}
								{(note.articulation || note.ornament) &&
									localEndX >= (showNoteVelocityLabels ? 34 : 16) && (
										<Text
											fill={palette.articulationLabel}
											fontFamily="Chakra Petch, sans-serif"
											fontSize={10}
											fontStyle="bold"
											listening={false}
											x={showNoteVelocityLabels ? 21 : 4}
											y={Math.max(1, localStartCenterY - 5.5)}
											text={`${
												note.articulation
													? ARTICULATION_LABELS[note.articulation].mark
													: ""
											}${note.ornament ? ORNAMENT_LABELS[note.ornament].mark : ""}`}
										/>
									)}
								{showNoteVelocityLabels && localEndX >= 15 && (
									<Text
										fill={palette.velocityLabel}
										fontFamily="Chakra Petch, monospace"
										fontSize={9}
										fontStyle="bold"
										listening={false}
										text={String(Math.round(note.velocity * 100))}
										x={3}
										y={Math.max(1, localStartCenterY - 4.5)}
									/>
								)}
							</Group>

							{showResizeHandle && (
								<Circle
									draggable
									dragDistance={2}
									fill={noteColor}
									hitStrokeWidth={12}
									radius={4}
									stroke={palette.laneStemOutline}
									strokeWidth={1.5}
									x={endX - 3}
									y={endCenterY}
									dragBoundFunc={(position): { x: number; y: number } => ({
										x: clampValue(
											position.x,
											startX + stepWidth - 5,
											stageWidth - 2
										),
										y: endCenterY,
									})}
									onDragEnd={(event): void => {
										setCursorMode("");
										event.target.position({
											x: endX - 3,
											y: endCenterY,
										});
									}}
									onDragMove={(event): void => {
										const handleX = event.target.x() + 5 - offsetPixels;
										const targetEndStep = clampValue(
											Math.round(handleX / stepWidth) - 1,
											note.step,
											stepsPerBar - 1
										);
										const nextDuration = targetEndStep - note.step + 1;
										if (nextDuration !== note.duration) {
											onResizeNote(note.step, note.pitch, nextDuration);
										}
									}}
									onDragStart={(): void => {
										setCursorMode("ew-resize");
									}}
									onMouseEnter={(): void => {
										setCursorMode("ew-resize");
									}}
									onMouseLeave={(): void => {
										setCursorMode("");
									}}
								/>
							)}
						</Group>
					);
				})}

				{selectionBounds && (
					<Rect
						dash={[5, 3]}
						fill={palette.selectionFill}
						height={Math.max(1, selectionBounds.height)}
						listening={false}
						stroke={palette.selectionStroke}
						strokeWidth={1.5}
						width={Math.max(1, selectionBounds.width)}
						x={selectionBounds.x}
						y={selectionBounds.y}
					/>
				)}
			</Layer>
		</Stage>
	);
};

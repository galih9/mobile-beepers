import type Konva from "konva";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Circle, Group, Layer, Line, Rect, Stage, Text } from "react-konva";
import type { FunctionComponent } from "../../../common/types";
import type {
	Channel,
	EditorTool,
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
	onAddOrReplaceNote: (noteInput: Omit<NoteEvent, "id">) => void;
	onRemoveNote: (step: number, pitch: number) => void;
	onResizeNote: (step: number, pitch: number, duration: number) => void;
	onMoveNote: (
		fromStep: number,
		fromPitch: number,
		toStep: number,
		toPitch: number
	) => void;
	onCyclePitchBend: (step: number, pitch: number) => void;
	onSetNotePitchBend: (
		step: number,
		pitch: number,
		pitchBend: number,
		bendStyle?: NoteBendStyle
	) => void;
	onCycleNoteFade: (step: number, pitch: number) => void;
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
	onAddOrReplaceNote,
	onRemoveNote,
	onResizeNote,
	onMoveNote,
	onCyclePitchBend,
	onSetNotePitchBend,
	onCycleNoteFade,
	onPreviewPitch,
}: KonvaPianoRollStageProps): FunctionComponent => {
	const stageWidth = Math.max(1, stepsPerBar * stepWidth);
	const stageHeight = Math.max(1, rows.length * rowHeight);

	const drawingNoteRef = useRef<DrawingNoteSession | null>(null);
	const bendDragRef = useRef<BendDragSession | null>(null);
	const [cursorMode, setCursorMode] = useState<string>("");
	const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

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

	const finishPointerInteractions = useCallback((): void => {
		const bendDrag = bendDragRef.current;
		if (bendDrag) {
			if (!bendDrag.didBendDrag) {
				if (activeTool === "slide") {
					onCyclePitchBend(bendDrag.step, bendDrag.pitch);
				} else if (activeTool === "draw" || activeTool === "erase") {
					onRemoveNote(bendDrag.step, bendDrag.pitch);
				} else if (activeTool === "fade") {
					onCycleNoteFade(bendDrag.step, bendDrag.pitch);
				}
			}
			bendDragRef.current = null;
			setCursorMode("");
		}
		drawingNoteRef.current = null;
	}, [activeTool, onCycleNoteFade, onCyclePitchBend, onRemoveNote]);

	useEffect(() => {
		const handleWindowPointerEnd = (): void => {
			if (bendDragRef.current || drawingNoteRef.current) {
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
		if (activeTool === "select") {
			setSelectedNoteId(null);
			return;
		}
		if (activeTool !== "draw") {
			return;
		}
		const stage = event.target.getStage();
		const pointerPosition = stage?.getPointerPosition();
		if (!pointerPosition) {
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
			velocity: 0.9,
			pitchBend: 0,
		});
		onPreviewPitch(row.pitch);
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
					: activeTool === "fade"
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
						fill={column.beat % 2 === 0 ? "#06080e" : "#0d111a"}
						height={stageHeight}
						width={column.width}
						x={column.x}
						y={0}
					/>
				))}

				{rows.map((row, rowIndex) => {
					const y = rowIndex * rowHeight;
					const fill = row.isRoot
						? "rgba(138, 96, 56, 0.55)"
						: !row.inScale
							? "rgba(2, 4, 8, 0.52)"
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
								strokeWidth={row.isRoot ? 1.2 : 1}
								stroke={
									row.isRoot
										? "rgba(186, 134, 82, 0.55)"
										: "rgba(51, 65, 85, 0.36)"
								}
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
							divider.isBeatBoundary
								? "rgba(148, 163, 184, 0.35)"
								: "rgba(51, 65, 85, 0.25)"
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
							fill="rgba(255, 255, 255, 0.08)"
							height={stageHeight}
							width={stepWidth}
							x={playbackStep * stepWidth}
							y={0}
						/>
						<Line
							stroke="#ffffff"
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
					const startX = note.step * stepWidth + horizontalInset;
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
					const showResizeHandle =
						activeChannel.type === "pitch" &&
						!isSelectTool &&
						activeTool !== "erase";

					return (
						<Group key={note.id}>
							<Group
								dragDistance={5}
								draggable={isMoveTool}
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
										Math.round((node.x() - 2) / stepWidth),
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
										x: targetStep * stepWidth + 2,
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
									setCursorMode(
										isSelectTool
											? "pointer"
											: activeTool === "erase"
												? "not-allowed"
												: activeTool === "slide"
													? "ns-resize"
													: activeTool === "fade"
														? "pointer"
														: isMoveTool
															? "grab"
															: "ns-resize"
									);
								}}
								onMouseLeave={(): void => {
									if (!bendDragRef.current) {
										setCursorMode("");
									}
								}}
								onPointerDown={(event): void => {
									if (isSelectTool) {
										event.cancelBubble = true;
										setSelectedNoteId(note.id);
										onPreviewPitch(note.pitch, note);
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
									opacity={0.3}
									points={haloPoints}
								/>
								<Line
									closed
									fill={noteColor}
									listening={false}
									points={corePoints}
									stroke={selectedNoteId === note.id ? "#ffffff" : undefined}
									strokeWidth={selectedNoteId === note.id ? 1.5 : 0}
								/>
								{note.pitchBend !== 0 && (
									<Text
										fill="#fef08a"
										fontFamily="monospace"
										fontSize={9}
										fontStyle="bold"
										listening={false}
										text={`${note.pitchBend > 0 ? "+" : ""}${note.pitchBend}st`}
										x={4}
										y={Math.max(1, localStartCenterY - 11)}
									/>
								)}
								{note.fadeMode && note.fadeMode !== "none" && (
									<Text
										fill="#e0f2fe"
										fontFamily="monospace"
										fontSize={8}
										fontStyle="bold"
										listening={false}
										text={note.fadeMode === "fadeIn" ? "IN" : "OUT"}
										x={Math.max(4, localEndX - 22)}
										y={Math.max(1, localEndCenterY - 10)}
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
									stroke="#020617"
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
										const handleX = event.target.x() + 5;
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
			</Layer>
		</Stage>
	);
};

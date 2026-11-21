import {
	useRef,
	useState,
	type PointerEvent as ReactPointerEvent,
} from "react";
import type { FunctionComponent } from "../../../common/types";
import {
	clampNoteVelocity,
	type NotePropertyUpdate,
} from "../store/songHelpers";
import type { NoteEvent } from "../types/music";
import {
	computeLanePaintUpdates,
	LANE_PADDING_BOTTOM,
	LANE_PADDING_TOP,
	laneYFromVelocity,
	VELOCITY_LANE_HEIGHT,
	velocityFromLaneY,
	type PaintPoint,
} from "./velocityLaneMath";
import { useCanvasPalette } from "./useCanvasPalette";

/**
 * Per-note volume (velocity) lane, drawn under the piano roll and aligned with
 * its steps. Each note is a vertical stem whose height is its volume.
 *
 * - Click / drag: paint volumes. Dragging across steps draws a straight line,
 *   so you can sweep a crescendo or a fade in one gesture.
 * - With notes selected in the piano roll, only those notes are edited.
 * - Shift + drag: move every editable note's volume up/down by the same amount
 *   (keeps the accents, makes the phrase louder or quieter).
 */

interface VelocityLaneProps {
	notes: Array<NoteEvent>;
	stepsPerBar: number;
	stepsPerBeat: number;
	stepWidth: number;
	color: string;
	selectedNoteIds: Array<string>;
	height?: number;
	onUpdate: (updates: Array<NotePropertyUpdate>) => void;
	onPreview?: (note: NoteEvent, velocity: number) => void;
}

interface LaneDragSession {
	mode: "paint" | "relative";
	last: PaintPoint;
	startY: number;
	baseVelocities: Map<string, number>;
	previewedIds: Set<string>;
}

export const VelocityLane = ({
	notes,
	stepsPerBar,
	stepsPerBeat,
	stepWidth,
	color,
	selectedNoteIds,
	height = VELOCITY_LANE_HEIGHT,
	onUpdate,
	onPreview,
}: VelocityLaneProps): FunctionComponent => {
	const palette = useCanvasPalette();
	const svgRef = useRef<SVGSVGElement | null>(null);
	const dragRef = useRef<LaneDragSession | null>(null);
	const [hoverReadout, setHoverReadout] = useState<{
		x: number;
		label: string;
	} | null>(null);

	const width = Math.max(1, stepsPerBar * stepWidth);
	const selectedSet = new Set(selectedNoteIds);
	const editableIds = selectedNoteIds.length > 0 ? selectedSet : null;
	const editableNotes = editableIds
		? notes.filter((note) => editableIds.has(note.id))
		: notes;

	const resolvePoint = (
		event: ReactPointerEvent<SVGSVGElement>
	): { step: number; velocity: number; x: number; y: number } => {
		const rectangle = svgRef.current?.getBoundingClientRect();
		const x = rectangle ? event.clientX - rectangle.left : 0;
		const y = rectangle ? event.clientY - rectangle.top : 0;
		const step = Math.max(
			0,
			Math.min(stepsPerBar - 1, Math.floor(x / stepWidth))
		);
		return { step, velocity: velocityFromLaneY(y, height), x, y };
	};

	const previewFirstOnStep = (step: number, velocity: number): void => {
		const session = dragRef.current;
		if (!onPreview || !session) {
			return;
		}
		const note = editableNotes.find(
			(candidate) =>
				candidate.step === step && !session.previewedIds.has(candidate.id)
		);
		if (note) {
			session.previewedIds.add(note.id);
			onPreview(note, velocity);
		}
	};

	const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>): void => {
		if (editableNotes.length === 0) {
			return;
		}
		event.preventDefault();
		// setPointerCapture is missing in some test DOMs
		if (typeof event.currentTarget.setPointerCapture === "function") {
			event.currentTarget.setPointerCapture(event.pointerId);
		}
		const point = resolvePoint(event);
		const mode = event.shiftKey ? "relative" : "paint";
		dragRef.current = {
			mode,
			last: { step: point.step, velocity: point.velocity },
			startY: point.y,
			baseVelocities: new Map(
				editableNotes.map((note) => [note.id, note.velocity])
			),
			previewedIds: new Set(),
		};
		if (mode === "paint") {
			onUpdate(
				computeLanePaintUpdates({
					notes,
					from: { step: point.step, velocity: point.velocity },
					to: { step: point.step, velocity: point.velocity },
					editableIds,
				})
			);
			previewFirstOnStep(point.step, point.velocity);
		}
		setHoverReadout({
			x: point.x,
			label: `${Math.round(point.velocity * 100)}%`,
		});
	};

	const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>): void => {
		const point = resolvePoint(event);
		const session = dragRef.current;
		if (!session) {
			const hovered = notes.find((note) => note.step === point.step);
			setHoverReadout(
				hovered
					? { x: point.x, label: `${Math.round(hovered.velocity * 100)}%` }
					: null
			);
			return;
		}
		if (session.mode === "relative") {
			const usable = height - LANE_PADDING_TOP - LANE_PADDING_BOTTOM;
			const delta = (session.startY - point.y) / Math.max(1, usable);
			const updates: Array<NotePropertyUpdate> = [];
			session.baseVelocities.forEach((base, id) => {
				updates.push({ id, velocity: clampNoteVelocity(base + delta) });
			});
			onUpdate(updates);
			setHoverReadout({
				x: point.x,
				label: `${delta >= 0 ? "+" : ""}${Math.round(delta * 100)}%`,
			});
			return;
		}
		const next = { step: point.step, velocity: point.velocity };
		onUpdate(
			computeLanePaintUpdates({
				notes,
				from: session.last,
				to: next,
				editableIds,
			})
		);
		if (next.step !== session.last.step) {
			previewFirstOnStep(next.step, next.velocity);
		}
		session.last = next;
		setHoverReadout({
			x: point.x,
			label: `${Math.round(point.velocity * 100)}%`,
		});
	};

	const finishDrag = (): void => {
		dragRef.current = null;
	};

	const beatLines = Array.from(
		{ length: Math.floor(stepsPerBar / stepsPerBeat) + 1 },
		(_, beat) => beat * stepsPerBeat * stepWidth
	);

	return (
		<div
			className="relative"
			style={{ width: `${width}px`, height: `${height}px` }}
		>
			<svg
				ref={svgRef}
				aria-label="Note volume lane. Drag to paint note volumes. Shift-drag to raise or lower all editable notes together."
				className="block touch-none select-none"
				height={height}
				role="application"
				style={{ cursor: editableNotes.length > 0 ? "ns-resize" : "default" }}
				width={width}
				onPointerCancel={finishDrag}
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={finishDrag}
				onPointerLeave={(): void => {
					if (!dragRef.current) {
						setHoverReadout(null);
					}
				}}
			>
				<rect
					fill={palette.laneBackground}
					height={height}
					width={width}
					x={0}
					y={0}
				/>
				{[0.25, 0.5, 0.75].map((level) => (
					<line
						key={`level-${level}`}
						stroke={palette.laneGuide}
						strokeDasharray="2 3"
						x1={0}
						x2={width}
						y1={laneYFromVelocity(level, height)}
						y2={laneYFromVelocity(level, height)}
					/>
				))}
				{beatLines.map((x) => (
					<line
						key={`beat-${x}`}
						stroke={palette.laneBeatLine}
						x1={x}
						x2={x}
						y1={0}
						y2={height}
					/>
				))}
				{notes.map((note) => {
					const isSelected = selectedSet.has(note.id);
					const isDimmed = editableIds !== null && !isSelected;
					const x =
						(note.step + (note.timingOffset ?? 0)) * stepWidth +
						Math.min(6, stepWidth / 2);
					const topY = laneYFromVelocity(note.velocity, height);
					const stemColor = isSelected ? palette.laneSelected : color;
					return (
						<g key={`vel-${note.id}`} opacity={isDimmed ? 0.3 : 1}>
							<line
								stroke={stemColor}
								strokeLinecap="round"
								strokeWidth={Math.max(2, Math.min(4, stepWidth * 0.18))}
								x1={x}
								x2={x}
								y1={height - LANE_PADDING_BOTTOM}
								y2={topY}
							/>
							<circle
								cx={x}
								cy={topY}
								fill={stemColor}
								r={Math.max(2.5, Math.min(4, stepWidth * 0.2))}
								stroke={palette.laneStemOutline}
								strokeWidth={1}
							/>
						</g>
					);
				})}
			</svg>
			{hoverReadout && (
				<span
					className="pointer-events-none absolute top-0.5 rounded bg-slate-900/90 px-1 font-mono text-[9px] font-bold text-cyan-200"
					style={{
						left: `${Math.max(0, Math.min(width - 34, hoverReadout.x + 6))}px`,
					}}
				>
					{hoverReadout.label}
				</span>
			)}
		</div>
	);
};

import {
	clampNoteVelocity,
	type NotePropertyUpdate,
} from "../store/songHelpers";
import type { NoteEvent } from "../types/music";

export interface PaintPoint {
	step: number;
	velocity: number;
}

export const VELOCITY_LANE_HEIGHT = 64;

export const LANE_PADDING_TOP = 4;
export const LANE_PADDING_BOTTOM = 3;

/** Velocity (0.1–1) for a y position inside the lane. */
export const velocityFromLaneY = (y: number, laneHeight: number): number => {
	const usable = Math.max(
		1,
		laneHeight - LANE_PADDING_TOP - LANE_PADDING_BOTTOM
	);
	const ratio = 1 - (y - LANE_PADDING_TOP) / usable;
	return clampNoteVelocity(ratio);
};

/** y position (top of the stem) for a velocity inside the lane. */
export const laneYFromVelocity = (
	velocity: number,
	laneHeight: number
): number => {
	const usable = laneHeight - LANE_PADDING_TOP - LANE_PADDING_BOTTOM;
	return LANE_PADDING_TOP + (1 - velocity) * usable;
};

/**
 * Updates for a paint stroke from one point to another: every editable note
 * starting on a step in between gets a velocity interpolated along the line.
 */
export const computeLanePaintUpdates = (options: {
	notes: Array<NoteEvent>;
	from: PaintPoint;
	to: PaintPoint;
	editableIds: Set<string> | null;
}): Array<NotePropertyUpdate> => {
	const { notes, from, to, editableIds } = options;
	const firstStep = Math.min(from.step, to.step);
	const lastStep = Math.max(from.step, to.step);
	const span = lastStep - firstStep;
	return notes
		.filter(
			(note) =>
				note.step >= firstStep &&
				note.step <= lastStep &&
				(!editableIds || editableIds.has(note.id))
		)
		.map((note) => {
			const ratio =
				span === 0 ? 1 : (note.step - from.step) / (to.step - from.step);
			const velocity = from.velocity + (to.velocity - from.velocity) * ratio;
			return { id: note.id, velocity: clampNoteVelocity(velocity) };
		})
		.filter((update) => {
			const note = notes.find((candidate) => candidate.id === update.id);
			return note?.velocity !== update.velocity;
		});
};

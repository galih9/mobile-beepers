import type { Channel, NoteEvent, PianoRollRow } from "../types/music";

export interface PianoRollRenderOptions {
	canvas: HTMLCanvasElement;
	rows: Array<PianoRollRow>;
	stepsPerBar: number;
	stepsPerBeat: number;
	rowHeight: number;
	stepWidth: number;
	activeChannel: Channel;
	activeNotes: Array<NoteEvent>;
	ghostChannels: Array<{ color: string; notes: Array<NoteEvent> }>;
	showGhostNotes: boolean;
	isPlayingThisBar: boolean;
	playbackStep: number;
}

const drawCircle = (
	context: CanvasRenderingContext2D,
	centerX: number,
	centerY: number,
	radius: number
): void => {
	context.beginPath();
	context.arc(centerX, centerY, radius, 0, Math.PI * 2);
	context.fill();
};

export const renderPianoRollCanvas = (
	options: PianoRollRenderOptions
): void => {
	const {
		canvas,
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
	} = options;

	const logicalWidth = stepsPerBar * stepWidth;
	const logicalHeight = rows.length * rowHeight;
	const devicePixelRatio = window.devicePixelRatio || 1;

	if (
		canvas.width !== Math.floor(logicalWidth * devicePixelRatio) ||
		canvas.height !== Math.floor(logicalHeight * devicePixelRatio)
	) {
		canvas.width = Math.floor(logicalWidth * devicePixelRatio);
		canvas.height = Math.floor(logicalHeight * devicePixelRatio);
		canvas.style.width = `${logicalWidth}px`;
		canvas.style.height = `${logicalHeight}px`;
	}

	const context = canvas.getContext("2d");
	if (!context) {
		return;
	}

	context.save();
	context.scale(devicePixelRatio, devicePixelRatio);

	// 1. Alternating beat column shading (classic UltraBox / BeepBox checkerboard)
	for (let beat = 0; beat * stepsPerBeat < stepsPerBar; beat += 1) {
		const beatX = beat * stepsPerBeat * stepWidth;
		const beatWidth = stepsPerBeat * stepWidth;
		context.fillStyle = beat % 2 === 0 ? "#06080e" : "#0d111a";
		context.fillRect(beatX, 0, beatWidth, logicalHeight);
	}

	// 2. Row backgrounds with UltraBox warm brown/ochre Root / Tonic octave bands
	rows.forEach((row, rowIndex) => {
		const y = rowIndex * rowHeight;
		if (row.isRoot) {
			context.fillStyle = "rgba(138, 96, 56, 0.55)";
			context.fillRect(0, y, logicalWidth, rowHeight);
		} else if (!row.inScale) {
			context.fillStyle = "rgba(2, 4, 8, 0.52)";
			context.fillRect(0, y, logicalWidth, rowHeight);
		}

		context.strokeStyle = row.isRoot
			? "rgba(186, 134, 82, 0.55)"
			: "rgba(51, 65, 85, 0.36)";
		context.lineWidth = row.isRoot ? 1.2 : 1;
		context.beginPath();
		context.moveTo(0, y + rowHeight);
		context.lineTo(logicalWidth, y + rowHeight);
		context.stroke();
	});

	// 3. Vertical beat and step dividers
	for (let step = 0; step <= stepsPerBar; step += 1) {
		const x = step * stepWidth;
		const isBeatBoundary = step % stepsPerBeat === 0;
		context.strokeStyle = isBeatBoundary
			? "rgba(148, 163, 184, 0.35)"
			: "rgba(51, 65, 85, 0.25)";
		context.lineWidth = isBeatBoundary ? 1.5 : 1;
		context.beginPath();
		context.moveTo(x, 0);
		context.lineTo(x, logicalHeight);
		context.stroke();
	}

	const pitchToRowIndex = new Map<number, number>();
	rows.forEach((row, index) => {
		pitchToRowIndex.set(row.pitch, index);
	});

	// 4. Ghost notes from other melodic channels as thin centered bars
	if (showGhostNotes && activeChannel.type === "pitch") {
		ghostChannels.forEach((ghost) => {
			ghost.notes.forEach((note) => {
				const rowIndex = pitchToRowIndex.get(note.pitch);
				if (rowIndex === undefined) {
					return;
				}
				const x = note.step * stepWidth + 2;
				const centerY = rowIndex * rowHeight + rowHeight / 2;
				const width = Math.max(8, note.duration * stepWidth - 4);

				context.save();
				context.globalAlpha = 0.28;
				context.fillStyle = ghost.color;
				context.fillRect(x, centerY - 3, width, 6);
				context.restore();
			});
		});
	}

	// 5. Playhead column & bright vertical line
	if (isPlayingThisBar) {
		const playheadX = playbackStep * stepWidth;
		context.fillStyle = "rgba(255, 255, 255, 0.08)";
		context.fillRect(playheadX, 0, stepWidth, logicalHeight);

		context.strokeStyle = "#ffffff";
		context.lineWidth = 2;
		context.beginPath();
		context.moveTo(playheadX, 0);
		context.lineTo(playheadX, logicalHeight);
		context.stroke();
	}

	// 6. Active notes in UltraBox style (outer halo + core bar + pitch slide)
	activeNotes.forEach((note) => {
		const rowIndex = pitchToRowIndex.get(note.pitch);
		if (rowIndex === undefined) {
			return;
		}
		const row = rows[rowIndex];
		const noteColor =
			activeChannel.type === "drum" && row?.accentColor
				? row.accentColor
				: activeChannel.color;

		const startX = note.step * stepWidth + 2;
		const endX = Math.max(
			startX + 10,
			(note.step + note.duration) * stepWidth - 2
		);
		const startCenterY = rowIndex * rowHeight + rowHeight / 2;
		const targetRowIndex =
			activeChannel.type === "pitch" && note.pitchBend !== 0
				? (pitchToRowIndex.get(note.pitch + note.pitchBend) ??
					Math.max(
						0,
						Math.min(rows.length - 1, rowIndex - Math.sign(note.pitchBend) * 2)
					))
				: rowIndex;
		const endCenterY = targetRowIndex * rowHeight + rowHeight / 2;

		const haloHalfHeight = Math.max(7, (rowHeight - 4) * 0.44);
		const coreHalfHeight = 3.5;

		// Outer semi-transparent halo polygon
		context.save();
		context.globalAlpha = 0.34;
		context.fillStyle = noteColor;
		context.beginPath();
		context.moveTo(startX, startCenterY - haloHalfHeight);
		context.lineTo(endX, endCenterY - haloHalfHeight);
		context.lineTo(endX, endCenterY + haloHalfHeight);
		context.lineTo(startX, startCenterY + haloHalfHeight);
		context.closePath();
		context.fill();
		context.restore();

		// Bright inner core ribbon
		context.save();
		context.fillStyle = noteColor;
		context.beginPath();
		context.moveTo(startX, startCenterY - coreHalfHeight);
		context.lineTo(endX, endCenterY - coreHalfHeight);
		context.lineTo(endX, endCenterY + coreHalfHeight);
		context.lineTo(startX, startCenterY + coreHalfHeight);
		context.closePath();
		context.fill();

		// Circular UltraBox note node caps
		drawCircle(context, startX + 3, startCenterY, 4.2);
		drawCircle(context, endX - 3, endCenterY, 3.6);
		context.restore();
	});

	context.restore();
};

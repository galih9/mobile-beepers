import {
	AdjustmentsVerticalIcon,
	FingerPrintIcon,
	ViewColumnsIcon,
} from "@heroicons/react/24/outline";
import { useMemo } from "react";
import type { FunctionComponent } from "../../../common/types";
import { getActivePatternForChannel } from "../store/songHelpers";
import { useChiptuneStore } from "../store/useChiptuneStore";

/**
 * Piano roll toolbar group for per-note volume and feel:
 * - Vol: show / hide the note volume lane
 * - Volume slider: with notes selected it sets their volume, otherwise it sets
 *   the volume new notes are drawn with
 * - Humanize: small random volume + timing variation (selected notes or pattern)
 * - Snap: remove timing nudges (back onto the grid)
 */
export const NoteVolumeControls = (): FunctionComponent => {
	const song = useChiptuneStore((state) => state.song);
	const selectedChannelIndex = useChiptuneStore(
		(state) => state.selectedChannelIndex
	);
	const selectedBarIndex = useChiptuneStore((state) => state.selectedBarIndex);
	const selectedNoteIds = useChiptuneStore((state) => state.selectedNoteIds);
	const defaultNoteVelocity = useChiptuneStore(
		(state) => state.defaultNoteVelocity
	);
	const showVelocityLane = useChiptuneStore((state) => state.showVelocityLane);
	const showNoteVelocityLabels = useChiptuneStore(
		(state) => state.showNoteVelocityLabels
	);
	const toggleNoteVelocityLabels = useChiptuneStore(
		(state) => state.toggleNoteVelocityLabels
	);
	const setDefaultNoteVelocity = useChiptuneStore(
		(state) => state.setDefaultNoteVelocity
	);
	const toggleVelocityLane = useChiptuneStore(
		(state) => state.toggleVelocityLane
	);
	const updateNoteProperties = useChiptuneStore(
		(state) => state.updateNoteProperties
	);
	const humanizeCurrentPattern = useChiptuneStore(
		(state) => state.humanizeCurrentPattern
	);
	const quantizeCurrentPattern = useChiptuneStore(
		(state) => state.quantizeCurrentPattern
	);

	const activeChannel = song.channels[selectedChannelIndex];
	const notes = useMemo(
		() =>
			activeChannel
				? (getActivePatternForChannel(activeChannel, selectedBarIndex)?.notes ??
					[])
				: [],
		[activeChannel, selectedBarIndex]
	);
	const selectedNotes = useMemo(() => {
		const idSet = new Set(selectedNoteIds);
		return notes.filter((note) => idSet.has(note.id));
	}, [notes, selectedNoteIds]);

	const isEditingSelection = selectedNotes.length > 0;
	const sliderVelocity = isEditingSelection
		? selectedNotes.reduce((sum, note) => sum + note.velocity, 0) /
			selectedNotes.length
		: defaultNoteVelocity;
	const sliderPercent = Math.round(sliderVelocity * 100);
	const hasTimingNudges = notes.some(
		(note) =>
			(note.timingOffset ?? 0) !== 0 &&
			(!isEditingSelection || selectedNoteIds.includes(note.id))
	);

	return (
		<div
			aria-label="Note volume and feel"
			className="flex items-center gap-0.5 rounded border border-slate-800 bg-slate-950 p-0.5"
			role="group"
		>
			<button
				aria-label="Show note volume lane"
				aria-pressed={showVelocityLane}
				title="Show or hide the note volume lane under the piano roll"
				type="button"
				className={`inline-flex h-5 items-center gap-0.5 rounded px-1.5 text-[10px] font-semibold transition ${
					showVelocityLane
						? "bg-emerald-500/25 text-emerald-200"
						: "text-slate-400 hover:text-white"
				}`}
				onClick={toggleVelocityLane}
			>
				<AdjustmentsVerticalIcon aria-hidden="true" className="size-3" />
				<span>Vol</span>
			</button>

			<button
				aria-label="Show volume numbers on notes"
				aria-pressed={showNoteVelocityLabels}
				title="Show or hide each note's volume (%) printed on the note"
				type="button"
				className={`inline-flex h-5 items-center rounded px-1.5 font-mono text-[10px] font-bold transition ${
					showNoteVelocityLabels
						? "bg-emerald-500/25 text-emerald-200"
						: "text-slate-400 hover:text-white"
				}`}
				onClick={toggleNoteVelocityLabels}
			>
				%
			</button>

			<label
				className="flex items-center gap-1 px-1"
				title={
					isEditingSelection
						? `Volume of the ${selectedNotes.length} selected note${selectedNotes.length === 1 ? "" : "s"}`
						: "Volume for newly drawn notes"
				}
			>
				<span
					className={`font-mono text-[9px] font-bold ${
						isEditingSelection ? "text-white" : "text-slate-500"
					}`}
				>
					{isEditingSelection ? "SEL" : "NEW"}
				</span>
				<input
					className="h-1 w-14 cursor-pointer accent-emerald-400 md:w-20"
					max={100}
					min={10}
					step={1}
					type="range"
					value={sliderPercent}
					aria-label={
						isEditingSelection ? "Selected notes volume" : "New note volume"
					}
					onChange={(event): void => {
						const nextVelocity = Number.parseInt(event.target.value, 10) / 100;
						if (!Number.isFinite(nextVelocity)) {
							return;
						}
						if (isEditingSelection) {
							updateNoteProperties(
								selectedNotes.map((note) => ({
									id: note.id,
									velocity: nextVelocity,
								})),
								"note-velocity-slider"
							);
						} else {
							setDefaultNoteVelocity(nextVelocity);
						}
					}}
				/>
				<span className="w-7 text-right font-mono text-[10px] font-bold text-emerald-200">
					{sliderPercent}%
				</span>
			</label>

			<button
				aria-label="Humanize notes"
				className="inline-flex h-5 items-center gap-0.5 rounded px-1.5 text-[10px] font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white disabled:pointer-events-none disabled:opacity-30"
				disabled={notes.length === 0}
				title={`Humanize ${isEditingSelection ? "selected notes" : "this pattern"}: small random volume and timing changes so it sounds played, not programmed`}
				type="button"
				onClick={(): void => {
					humanizeCurrentPattern();
				}}
			>
				<FingerPrintIcon aria-hidden="true" className="size-3" />
				<span className="hidden sm:inline">Humanize</span>
			</button>

			<button
				aria-label="Snap notes to grid"
				className="inline-flex h-5 items-center gap-0.5 rounded px-1.5 text-[10px] font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white disabled:pointer-events-none disabled:opacity-30"
				disabled={!hasTimingNudges}
				title={`Snap ${isEditingSelection ? "selected notes" : "this pattern"} back onto the grid (remove timing nudges)`}
				type="button"
				onClick={quantizeCurrentPattern}
			>
				<ViewColumnsIcon aria-hidden="true" className="size-3" />
				<span className="hidden sm:inline">Snap</span>
			</button>
		</div>
	);
};

import { useMemo } from "react";
import type { FunctionComponent } from "../../../common/types";
import {
	ARTICULATION_LABELS,
	isNoteArticulation,
	isNoteOrnament,
	NOTE_ARTICULATIONS,
	NOTE_ORNAMENTS,
	ORNAMENT_LABELS,
} from "../audio/articulation";
import { getActivePatternForChannel } from "../store/songHelpers";
import { useChiptuneStore } from "../store/useChiptuneStore";
import type { NoteArticulation, NoteOrnament } from "../types/music";

/** Drum hits are one-shots: only the weight articulations change them. */
const DRUM_ARTICULATIONS: Array<NoteArticulation> = ["accent", "marcato"];

const MIXED = "__mixed__";

/**
 * Piano roll toolbar group for how notes are played:
 * - Articulation: with notes selected it sets theirs, otherwise it sets the
 *   articulation newly drawn notes get
 * - Ornament: grace note / mordent / trill on the selected notes
 */
export const ArticulationControls = (): FunctionComponent => {
	const song = useChiptuneStore((state) => state.song);
	const selectedChannelIndex = useChiptuneStore(
		(state) => state.selectedChannelIndex
	);
	const selectedBarIndex = useChiptuneStore((state) => state.selectedBarIndex);
	const selectedNoteIds = useChiptuneStore((state) => state.selectedNoteIds);
	const defaultNoteArticulation = useChiptuneStore(
		(state) => state.defaultNoteArticulation
	);
	const setDefaultNoteArticulation = useChiptuneStore(
		(state) => state.setDefaultNoteArticulation
	);
	const updateNoteProperties = useChiptuneStore(
		(state) => state.updateNoteProperties
	);

	const activeChannel = song.channels[selectedChannelIndex];
	const isDrum = activeChannel?.type === "drum";
	const selectedNotes = useMemo(() => {
		if (!activeChannel) {
			return [];
		}
		const idSet = new Set(selectedNoteIds);
		return (
			getActivePatternForChannel(activeChannel, selectedBarIndex)?.notes ?? []
		).filter((note) => idSet.has(note.id));
	}, [activeChannel, selectedBarIndex, selectedNoteIds]);

	const isEditingSelection = selectedNotes.length > 0;
	const articulationOptions = isDrum ? DRUM_ARTICULATIONS : NOTE_ARTICULATIONS;

	const sharedValue = <T,>(values: Array<T>): T | typeof MIXED | undefined =>
		values.every((value) => value === values[0]) ? values[0] : MIXED;

	const rawArticulationValue = isEditingSelection
		? (sharedValue(selectedNotes.map((note) => note.articulation)) ?? "normal")
		: (defaultNoteArticulation ?? "normal");
	const articulationValue =
		rawArticulationValue === MIXED ||
		rawArticulationValue === "normal" ||
		articulationOptions.includes(rawArticulationValue)
			? rawArticulationValue
			: "normal";
	const ornamentValue = isEditingSelection
		? (sharedValue(selectedNotes.map((note) => note.ornament)) ?? "none")
		: "none";

	const selectionLabel = `${selectedNotes.length} selected note${selectedNotes.length === 1 ? "" : "s"}`;

	return (
		<div
			aria-label="Articulation and ornaments"
			className="flex items-center gap-1 rounded border border-slate-800 bg-slate-950 p-0.5"
			role="group"
		>
			<label
				className="flex items-center gap-1 pl-1"
				title={
					isEditingSelection
						? `How the ${selectionLabel} are played`
						: "How newly drawn notes are played"
				}
			>
				<span
					className={`font-mono text-[9px] font-bold ${
						isEditingSelection ? "text-white" : "text-slate-500"
					}`}
				>
					{isEditingSelection ? "SEL" : "NEW"}
				</span>
				<select
					className="h-5 rounded border border-slate-800 bg-slate-900 px-1 text-[10px] font-semibold text-sky-200 focus-visible:outline-2 focus-visible:outline-sky-400"
					value={articulationValue}
					aria-label={
						isEditingSelection
							? "Articulation of selected notes"
							: "Articulation for new notes"
					}
					onChange={(event): void => {
						const next = event.target.value;
						const articulation = isNoteArticulation(next) ? next : null;
						if (isEditingSelection) {
							updateNoteProperties(
								selectedNotes.map((note) => ({ id: note.id, articulation })),
								"note-articulation"
							);
						} else {
							setDefaultNoteArticulation(articulation);
						}
					}}
				>
					{articulationValue === MIXED && (
						<option disabled value={MIXED}>
							Mixed
						</option>
					)}
					<option value="normal">{ARTICULATION_LABELS.normal.name}</option>
					{articulationOptions.map((articulation) => (
						<option key={articulation} value={articulation}>
							{ARTICULATION_LABELS[articulation].mark}{" "}
							{ARTICULATION_LABELS[articulation].name}
						</option>
					))}
				</select>
			</label>

			{!isDrum && (
				<label
					className="flex items-center gap-1 pr-0.5"
					title={
						isEditingSelection
							? `Ornament on the ${selectionLabel}`
							: "Select notes to add a grace note, mordent or trill"
					}
				>
					<span className="sr-only">Ornament</span>
					<select
						aria-label="Ornament of selected notes"
						className="h-5 rounded border border-slate-800 bg-slate-900 px-1 text-[10px] font-semibold text-sky-200 focus-visible:outline-2 focus-visible:outline-sky-400 disabled:opacity-40"
						disabled={!isEditingSelection}
						value={ornamentValue}
						onChange={(event): void => {
							const next = event.target.value;
							const ornament: NoteOrnament | null = isNoteOrnament(next)
								? next
								: null;
							updateNoteProperties(
								selectedNotes.map((note) => ({ id: note.id, ornament })),
								"note-ornament"
							);
						}}
					>
						{ornamentValue === MIXED && (
							<option disabled value={MIXED}>
								Mixed
							</option>
						)}
						<option value="none">Ornament: none</option>
						{NOTE_ORNAMENTS.map((ornament) => (
							<option key={ornament} value={ornament}>
								{ORNAMENT_LABELS[ornament].mark}{" "}
								{ORNAMENT_LABELS[ornament].name}
							</option>
						))}
					</select>
				</label>
			)}
		</div>
	);
};

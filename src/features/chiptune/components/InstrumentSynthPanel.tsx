import { PlusIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import type { FunctionComponent } from "../../../common/types";
import { useChiptuneStore } from "../store/useChiptuneStore";
import { InstrumentSlidersSection } from "./InstrumentSlidersSection";
import { SongSlidersSection } from "./SongSlidersSection";

export const InstrumentSynthPanel = (): FunctionComponent => {
	const [inspectorTab, setInspectorTab] = useState<"instrument" | "song">(
		"instrument"
	);

	const song = useChiptuneStore((state) => state.song);
	const selectedChannelIndex = useChiptuneStore(
		(state) => state.selectedChannelIndex
	);
	const scaleLockOnly = useChiptuneStore((state) => state.scaleLockOnly);
	const showGhostNotes = useChiptuneStore((state) => state.showGhostNotes);

	const updateChannelInstrument = useChiptuneStore(
		(state) => state.updateChannelInstrument
	);
	const applyInstrumentPreset = useChiptuneStore(
		(state) => state.applyInstrumentPreset
	);
	const updateSongMetadata = useChiptuneStore(
		(state) => state.updateSongMetadata
	);
	const setTotalBars = useChiptuneStore((state) => state.setTotalBars);
	const addChannel = useChiptuneStore((state) => state.addChannel);
	const removeChannel = useChiptuneStore((state) => state.removeChannel);
	const toggleScaleLockOnly = useChiptuneStore(
		(state) => state.toggleScaleLockOnly
	);
	const toggleShowGhostNotes = useChiptuneStore(
		(state) => state.toggleShowGhostNotes
	);

	const activeChannel = song.channels[selectedChannelIndex] ?? song.channels[0];
	if (!activeChannel) {
		return null;
	}

	return (
		<section
			aria-label="Instrument and song sliders"
			className="safe-bottom-bar flex min-h-0 flex-1 flex-col bg-slate-950"
		>
			{/* Compact UltraBox Settings Switcher on Mobile (< lg) */}
			<div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/70 px-2.5 py-1 lg:hidden">
				<div className="flex items-center gap-1">
					<button
						aria-pressed={inspectorTab === "instrument"}
						type="button"
						className={`rounded px-2.5 py-1 text-[11px] font-bold transition ${
							inspectorTab === "instrument"
								? "bg-cyan-500/20 text-cyan-200"
								: "text-slate-400 hover:text-white"
						}`}
						onClick={(): void => {
							setInspectorTab("instrument");
						}}
					>
						Instrument Sliders
					</button>
					<button
						aria-pressed={inspectorTab === "song"}
						type="button"
						className={`rounded px-2.5 py-1 text-[11px] font-bold transition ${
							inspectorTab === "song"
								? "bg-cyan-500/20 text-cyan-200"
								: "text-slate-400 hover:text-white"
						}`}
						onClick={(): void => {
							setInspectorTab("song");
						}}
					>
						Song & Scale ({song.bpm} BPM)
					</button>
				</div>

				<div className="flex items-center gap-1">
					<button
						className="inline-flex h-6 items-center gap-0.5 rounded border border-slate-700 bg-slate-950 px-1.5 text-[10px] font-semibold text-cyan-300"
						title="Add synth channel"
						type="button"
						onClick={(): void => {
							addChannel("pitch");
						}}
					>
						<PlusIcon aria-hidden="true" className="size-3" />
						<span>Ch</span>
					</button>
					<button
						className="inline-flex h-6 items-center gap-0.5 rounded border border-slate-700 bg-slate-950 px-1.5 text-[10px] font-semibold text-violet-300"
						title="Add drum channel"
						type="button"
						onClick={(): void => {
							addChannel("drum");
						}}
					>
						<PlusIcon aria-hidden="true" className="size-3" />
						<span>Dr</span>
					</button>
				</div>
			</div>

			{/* Two-Column Label | Slider Inspector Body */}
			<div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
				<div className="flex flex-col gap-3">
					<div
						className={
							inspectorTab === "instrument" ? "block" : "hidden lg:block"
						}
					>
						<InstrumentSlidersSection
							activeChannel={activeChannel}
							channelCount={song.channels.length}
							selectedChannelIndex={selectedChannelIndex}
							onAddChannel={addChannel}
							onApplyPreset={applyInstrumentPreset}
							onRemoveChannel={removeChannel}
							onUpdateInstrument={updateChannelInstrument}
						/>
					</div>

					<div
						className={
							inspectorTab === "song"
								? "block"
								: "hidden border-t border-slate-800 pt-2 lg:block"
						}
					>
						<SongSlidersSection
							scaleLockOnly={scaleLockOnly}
							showGhostNotes={showGhostNotes}
							song={song}
							onSetTotalBars={setTotalBars}
							onToggleGhostNotes={toggleShowGhostNotes}
							onToggleScaleLock={toggleScaleLockOnly}
							onUpdateMetadata={updateSongMetadata}
						/>
					</div>
				</div>
			</div>
		</section>
	);
};

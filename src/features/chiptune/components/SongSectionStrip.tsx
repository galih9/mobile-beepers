import { XMarkIcon } from "@heroicons/react/24/outline";
import type { FunctionComponent } from "../../../common/types";
import { useChiptuneStore } from "../store/useChiptuneStore";
import type { SongSection } from "../types/music";
import { channelInk, useCanvasPalette } from "./useCanvasPalette";

const SECTION_COLORS = ["#f472b6", "#22d3ee", "#facc15", "#a78bfa", "#34d399"];

interface SongSectionStripProps {
	sections: Array<SongSection>;
	barCellPitch: number;
	loopStartBar: number;
	loopEndBar: number;
}

/**
 * Row of named song sections under the loop bar. Click a section to loop it
 * (great for game music where each section must loop on its own), double-click
 * to rename, × to delete.
 */
export const SongSectionStrip = ({
	sections,
	barCellPitch,
	loopStartBar,
	loopEndBar,
}: SongSectionStripProps): FunctionComponent => {
	const palette = useCanvasPalette();
	const loopSection = useChiptuneStore((state) => state.loopSection);
	const renameSection = useChiptuneStore((state) => state.renameSection);
	const removeSection = useChiptuneStore((state) => state.removeSection);

	return (
		<div aria-label="Song sections" className="relative mt-0.5 h-5" role="list">
			{sections.map((section, index) => {
				const color =
					SECTION_COLORS[index % SECTION_COLORS.length] ?? "#a78bfa";
				const isLooped =
					section.startBar === loopStartBar && section.endBar === loopEndBar;
				const barCount = section.endBar - section.startBar + 1;
				return (
					<div
						key={section.id}
						className="group absolute top-0 flex h-5 items-center"
						role="listitem"
						style={{
							left: `${section.startBar * barCellPitch}px`,
							width: `${barCount * barCellPitch - 2}px`,
						}}
					>
						<button
							aria-label={`Loop section ${section.name}, bars ${section.startBar + 1} to ${section.endBar + 1}`}
							aria-pressed={isLooped}
							className="flex h-5 min-w-0 flex-1 items-center gap-1 truncate rounded-[3px] border px-1.5 text-left font-mono text-[9px] font-bold transition"
							title={`${section.name}: bars ${section.startBar + 1}–${section.endBar + 1}. Click to loop, double-click to rename.`}
							type="button"
							style={{
								borderColor: color,
								backgroundColor: isLooped ? `${color}40` : `${color}14`,
								color: isLooped
									? (palette.matrixInk ?? "#ffffff")
									: channelInk(color, palette),
							}}
							onClick={(): void => {
								loopSection(section.id);
							}}
							onDoubleClick={(): void => {
								const nextName = window.prompt("Section name", section.name);
								if (nextName !== null && nextName.trim()) {
									renameSection(section.id, nextName);
								}
							}}
						>
							<span className="truncate">{section.name}</span>
							<span className="shrink-0 opacity-60">
								{section.startBar + 1}–{section.endBar + 1}
							</span>
						</button>
						<button
							aria-label={`Delete section ${section.name}`}
							className="ml-0.5 hidden size-4 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-800 hover:text-rose-300 group-hover:flex"
							title="Delete section (bars are kept)"
							type="button"
							onClick={(): void => {
								removeSection(section.id);
							}}
						>
							<XMarkIcon aria-hidden="true" className="size-3" />
						</button>
					</div>
				);
			})}
		</div>
	);
};

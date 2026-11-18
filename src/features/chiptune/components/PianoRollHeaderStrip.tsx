import {
	ArrowTrendingUpIcon,
	SparklesIcon,
	TrashIcon,
} from "@heroicons/react/24/outline";
import type { FunctionComponent } from "../../../common/types";
import type { Channel, EditorTool } from "../types/music";

const DURATION_OPTIONS: Array<{ label: string; steps: number }> = [
	{ label: "1/16", steps: 1 },
	{ label: "1/8", steps: 2 },
	{ label: "1/4", steps: 4 },
	{ label: "1/2", steps: 8 },
];

interface PianoRollHeaderStripProps {
	activeChannel: Channel;
	selectedBarIndex: number;
	patternNumber: number;
	activeTool: EditorTool;
	defaultNoteDuration: number;
	onSelectDuration: (steps: number) => void;
	onToggleSlideTool: () => void;
	onGenerateRiff: () => void;
	onClearPattern: () => void;
}

export const PianoRollHeaderStrip = ({
	activeChannel,
	selectedBarIndex,
	patternNumber,
	activeTool,
	defaultNoteDuration,
	onSelectDuration,
	onToggleSlideTool,
	onGenerateRiff,
	onClearPattern,
}: PianoRollHeaderStripProps): FunctionComponent => {
	return (
		<div className="studio-chrome-text flex h-8 shrink-0 items-center justify-between gap-1.5 border-b border-slate-800 bg-slate-900/90 px-2">
			<div className="flex min-w-0 items-center gap-1.5">
				<span
					className="size-2.5 shrink-0 rounded-full"
					style={{ backgroundColor: activeChannel.color }}
				/>
				<span className="truncate text-[11px] font-bold text-white">
					{activeChannel.name}
				</span>
				<span className="font-mono text-[10px] font-semibold text-cyan-300">
					B{selectedBarIndex + 1}·P{patternNumber}
				</span>
			</div>

			<div className="flex shrink-0 items-center gap-1">
				{activeChannel.type === "pitch" && (
					<div className="flex items-center rounded bg-slate-950 p-0.5">
						{DURATION_OPTIONS.map((option) => (
							<button
								key={option.label}
								aria-pressed={defaultNoteDuration === option.steps}
								type="button"
								className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold transition ${
									defaultNoteDuration === option.steps
										? "bg-cyan-500/25 text-cyan-200"
										: "text-slate-400 hover:text-white"
								}`}
								onClick={(): void => {
									onSelectDuration(option.steps);
								}}
							>
								{option.label}
							</button>
						))}
					</div>
				)}

				<button
					aria-pressed={activeTool === "slide"}
					title="Toggle note pitch glide mode"
					type="button"
					className={`inline-flex h-6 items-center gap-0.5 rounded border px-1.5 text-[10px] font-semibold ${
						activeTool === "slide"
							? "border-amber-400 bg-amber-500/20 text-amber-200"
							: "border-slate-700 bg-slate-950 text-slate-300"
					}`}
					onClick={onToggleSlideTool}
				>
					<ArrowTrendingUpIcon aria-hidden="true" className="size-3" />
					<span className="hidden sm:inline">Glide</span>
				</button>

				<button
					aria-label="Generate chiptune riff"
					className="inline-flex h-6 items-center gap-0.5 rounded border border-cyan-500/40 bg-cyan-500/15 px-1.5 text-[10px] font-semibold text-cyan-200 hover:bg-cyan-500/25"
					title="Auto-generate in-key riff"
					type="button"
					onClick={onGenerateRiff}
				>
					<SparklesIcon aria-hidden="true" className="size-3" />
					<span>Riff</span>
				</button>

				<button
					aria-label="Clear pattern notes"
					className="inline-flex h-6 items-center rounded border border-rose-500/30 bg-rose-500/10 px-1.5 text-[10px] text-rose-300 hover:bg-rose-500/20"
					title="Clear pattern"
					type="button"
					onClick={onClearPattern}
				>
					<TrashIcon aria-hidden="true" className="size-3" />
				</button>
			</div>
		</div>
	);
};

import {
	ArrowsPointingOutIcon,
	ArrowTrendingUpIcon,
	BackspaceIcon,
	CursorArrowRaysIcon,
	PencilIcon,
	SignalIcon,
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

const ZOOM_OPTIONS: Array<{ label: string; value: number }> = [
	{ label: "0.25x", value: 0.25 },
	{ label: "0.5x", value: 0.5 },
	{ label: "0.75x", value: 0.75 },
	{ label: "1x", value: 1 },
	{ label: "1.5x", value: 1.5 },
	{ label: "2x", value: 2 },
];

const TRANSPOSE_OPTIONS: Array<{ label: string; semitones: number }> = [
	{ label: "-12", semitones: -12 },
	{ label: "-1", semitones: -1 },
	{ label: "+1", semitones: 1 },
	{ label: "+12", semitones: 12 },
];

interface PianoRollHeaderStripProps {
	activeChannel: Channel;
	selectedBarIndex: number;
	patternNumber: number;
	activeTool: EditorTool;
	defaultNoteDuration: number;
	pianoRollZoom: number;
	onSelectTool: (tool: EditorTool) => void;
	onSelectDuration: (steps: number) => void;
	onSelectZoom: (zoom: number) => void;
	onTransposePattern: (semitones: number) => void;
	onGenerateRiff: () => void;
	onClearPattern: () => void;
}

export const PianoRollHeaderStrip = ({
	activeChannel,
	selectedBarIndex,
	patternNumber,
	activeTool,
	defaultNoteDuration,
	pianoRollZoom,
	onSelectTool,
	onSelectDuration,
	onSelectZoom,
	onTransposePattern,
	onGenerateRiff,
	onClearPattern,
}: PianoRollHeaderStripProps): FunctionComponent => {
	return (
		<div className="studio-chrome-text flex min-h-9 shrink-0 flex-wrap items-center justify-between gap-1.5 border-b border-slate-800 bg-slate-900/90 px-2 py-1">
			<div className="flex min-w-0 items-center gap-1.5">
				<span
					className="size-2.5 shrink-0 rounded-full"
					style={{ backgroundColor: activeChannel.color }}
				/>
				<span className="truncate text-[11px] font-bold text-white md:text-xs">
					{activeChannel.name}
				</span>
				<span className="font-mono text-[10px] font-semibold text-cyan-300">
					B{selectedBarIndex + 1}·P{patternNumber}
				</span>
			</div>

			<div className="flex flex-wrap items-center gap-1.5">
				{/* Tool Selector: Select / Draw / Move / Erase / Bend / Fade */}
				<div
					aria-label="Note editing tools"
					className="flex items-center rounded border border-slate-800 bg-slate-950 p-0.5"
					role="group"
				>
					<button
						aria-pressed={activeTool === "select"}
						title="Select and listen to notes without modifying them"
						type="button"
						className={`inline-flex h-5 items-center gap-0.5 rounded px-1.5 text-[10px] font-semibold transition ${
							activeTool === "select"
								? "bg-violet-500/25 text-violet-200"
								: "text-slate-400 hover:text-white"
						}`}
						onClick={(): void => {
							onSelectTool("select");
						}}
					>
						<CursorArrowRaysIcon aria-hidden="true" className="size-3" />
						<span className="hidden sm:inline">Select</span>
					</button>
					<button
						aria-pressed={activeTool === "draw"}
						title="Draw and edit notes"
						type="button"
						className={`inline-flex h-5 items-center gap-0.5 rounded px-1.5 text-[10px] font-semibold transition ${
							activeTool === "draw"
								? "bg-cyan-500/25 text-cyan-200"
								: "text-slate-400 hover:text-white"
						}`}
						onClick={(): void => {
							onSelectTool("draw");
						}}
					>
						<PencilIcon aria-hidden="true" className="size-3" />
						<span className="hidden sm:inline">Draw</span>
					</button>
					<button
						aria-pressed={activeTool === "move"}
						title="Drag notes across steps and pitch"
						type="button"
						className={`inline-flex h-5 items-center gap-0.5 rounded px-1.5 text-[10px] font-semibold transition ${
							activeTool === "move"
								? "bg-emerald-500/25 text-emerald-200"
								: "text-slate-400 hover:text-white"
						}`}
						onClick={(): void => {
							onSelectTool("move");
						}}
					>
						<ArrowsPointingOutIcon aria-hidden="true" className="size-3" />
						<span className="hidden sm:inline">Move</span>
					</button>
					<button
						aria-pressed={activeTool === "erase"}
						title="Erase notes on click"
						type="button"
						className={`inline-flex h-5 items-center gap-0.5 rounded px-1.5 text-[10px] font-semibold transition ${
							activeTool === "erase"
								? "bg-rose-500/25 text-rose-200"
								: "text-slate-400 hover:text-white"
						}`}
						onClick={(): void => {
							onSelectTool("erase");
						}}
					>
						<BackspaceIcon aria-hidden="true" className="size-3" />
						<span className="hidden sm:inline">Erase</span>
					</button>
					<button
						aria-pressed={activeTool === "slide"}
						title="Drag note vertically to bend pitch, or click to cycle"
						type="button"
						className={`inline-flex h-5 items-center gap-0.5 rounded px-1.5 text-[10px] font-semibold transition ${
							activeTool === "slide"
								? "bg-amber-500/25 text-amber-200"
								: "text-slate-400 hover:text-white"
						}`}
						onClick={(): void => {
							onSelectTool(activeTool === "slide" ? "draw" : "slide");
						}}
					>
						<ArrowTrendingUpIcon aria-hidden="true" className="size-3" />
						<span className="hidden sm:inline">Bend</span>
					</button>
					<button
						aria-pressed={activeTool === "fade"}
						title="Click a note to cycle Fade In / Fade Out envelope"
						type="button"
						className={`inline-flex h-5 items-center gap-0.5 rounded px-1.5 text-[10px] font-semibold transition ${
							activeTool === "fade"
								? "bg-sky-500/25 text-sky-200"
								: "text-slate-400 hover:text-white"
						}`}
						onClick={(): void => {
							onSelectTool(activeTool === "fade" ? "draw" : "fade");
						}}
					>
						<SignalIcon aria-hidden="true" className="size-3" />
						<span className="hidden sm:inline">Fade</span>
					</button>
				</div>

				{/* Note Length Selector */}
				{activeChannel.type === "pitch" && (
					<div className="flex items-center rounded border border-slate-800 bg-slate-950 p-0.5">
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

				{/* Tablet & Desktop Transpose Controls */}
				{activeChannel.type === "pitch" && (
					<div
						aria-label="Transpose pattern"
						className="hidden items-center rounded border border-slate-800 bg-slate-950 p-0.5 md:flex"
						role="group"
					>
						{TRANSPOSE_OPTIONS.map((option) => (
							<button
								key={option.label}
								className="rounded px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-300 transition hover:bg-slate-800 hover:text-cyan-200"
								title={`Transpose pattern ${option.label} semitones`}
								type="button"
								onClick={(): void => {
									onTransposePattern(option.semitones);
								}}
							>
								{option.label}
							</button>
						))}
					</div>
				)}

				{/* Zoom Controls */}
				<div
					aria-label="Piano roll horizontal zoom"
					className="flex items-center rounded border border-slate-800 bg-slate-950 p-0.5"
					role="group"
				>
					{ZOOM_OPTIONS.map((option) => (
						<button
							key={option.label}
							aria-pressed={pianoRollZoom === option.value}
							type="button"
							className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold transition ${
								pianoRollZoom === option.value
									? "bg-violet-500/25 text-violet-200"
									: "text-slate-400 hover:text-white"
							}`}
							onClick={(): void => {
								onSelectZoom(option.value);
							}}
						>
							{option.label}
						</button>
					))}
				</div>

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

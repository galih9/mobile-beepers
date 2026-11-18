import {
	BoltIcon,
	DocumentPlusIcon,
	SparklesIcon,
} from "@heroicons/react/24/outline";
import type { FunctionComponent } from "../../../common/types";
import { SFX_PRESETS } from "../constants/sfxPresets";
import { useChiptuneStore } from "../store/useChiptuneStore";
import type { SfxCategory, SfxGeneratorArchetype } from "../types/music";

const SHORT_BAR_LENGTHS: Array<number> = [1, 2, 3, 4];

const QUICK_SFX_GENERATORS: Array<{
	label: string;
	archetype: SfxGeneratorArchetype;
}> = [
	{ label: "+ Laser", archetype: "laser" },
	{ label: "+ Hurt", archetype: "hurt" },
	{ label: "+ Jump", archetype: "jump" },
];

const CATEGORY_BADGE_CLASSES: Record<SfxCategory, string> = {
	combat: "bg-rose-500/20 text-rose-300 border-rose-500/40",
	feedback: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
	jingle: "bg-amber-500/20 text-amber-300 border-amber-500/40",
};

export const SfxCreatorBanner = (): FunctionComponent => {
	const song = useChiptuneStore((state) => state.song);
	const loadSfxPreset = useChiptuneStore((state) => state.loadSfxPreset);
	const setTotalBars = useChiptuneStore((state) => state.setTotalBars);
	const generateSfxPattern = useChiptuneStore(
		(state) => state.generateSfxPattern
	);
	const createNewSfxProject = useChiptuneStore(
		(state) => state.createNewSfxProject
	);
	const setIsPlaying = useChiptuneStore((state) => state.setIsPlaying);

	const handleTriggerPreset = (presetId: string): void => {
		const wasPlaying = useChiptuneStore.getState().isPlaying;
		loadSfxPreset(presetId);
		if (wasPlaying) {
			window.setTimeout(() => {
				useChiptuneStore.getState().setIsPlaying(true);
			}, 0);
		} else {
			setIsPlaying(true);
		}
	};

	return (
		<div className="studio-chrome-text flex shrink-0 flex-col gap-1.5 border-b border-amber-500/25 bg-slate-900/95 px-2.5 py-1.5">
			{/* Top Row: Mode badge + Preset Soundboard Chips */}
			<div className="flex items-center gap-2">
				<div className="hidden shrink-0 items-center gap-1 rounded border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold tracking-wider text-amber-200 uppercase sm:inline-flex">
					<BoltIcon aria-hidden="true" className="size-3 text-amber-300" />
					<span>Retro SFX</span>
				</div>

				<div
					aria-label="Retro SFX examples"
					className="no-scrollbar flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-0.5"
					role="group"
				>
					{SFX_PRESETS.map((preset) => {
						const isActive = song.title === preset.title;
						const badgeClass = CATEGORY_BADGE_CLASSES[preset.category];
						return (
							<button
								key={preset.id}
								aria-pressed={isActive}
								title={`${preset.description} (Click to load and audition)`}
								type="button"
								className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border px-2 text-[11px] font-semibold transition active:scale-95 ${
									isActive
										? "border-amber-400 bg-amber-500/20 text-white shadow-[0_0_10px_rgba(251,191,36,0.2)]"
										: "border-slate-700/90 bg-slate-950 text-slate-300 hover:border-amber-400/50 hover:text-white"
								}`}
								onClick={(): void => {
									handleTriggerPreset(preset.id);
								}}
							>
								<span
									className={`rounded border px-1 py-0.5 font-mono text-[9px] font-bold ${badgeClass}`}
								>
									{preset.badge}
								</span>
								<span>{preset.title}</span>
							</button>
						);
					})}
				</div>
			</div>

			{/* Bottom Row: Short Track Bar Length + Procedural SFX Generators */}
			<div className="flex flex-wrap items-center justify-between gap-1.5">
				<div className="flex items-center gap-1">
					<span className="font-mono text-[10px] font-bold text-slate-400 uppercase">
						Short Length:
					</span>
					<div
						aria-label="Short SFX track bar length"
						className="flex items-center rounded border border-slate-800 bg-slate-950 p-0.5"
						role="group"
					>
						{SHORT_BAR_LENGTHS.map((bars) => (
							<button
								key={bars}
								aria-pressed={song.totalBars === bars}
								type="button"
								className={`h-6 rounded px-2 font-mono text-[10px] font-bold transition ${
									song.totalBars === bars
										? "bg-amber-500/25 text-amber-200"
										: "text-slate-400 hover:text-white"
								}`}
								onClick={(): void => {
									setTotalBars(bars);
								}}
							>
								{bars === 1 ? "1 Bar" : `${bars} Bars`}
							</button>
						))}
					</div>
				</div>

				<div className="flex flex-wrap items-center gap-1">
					{QUICK_SFX_GENERATORS.map((generator) => (
						<button
							key={generator.archetype}
							className="inline-flex h-6 items-center rounded border border-slate-700 bg-slate-950 px-2 text-[10px] font-semibold text-cyan-200 transition hover:border-cyan-400/60 hover:bg-cyan-500/15"
							title={`Generate ${generator.archetype} SFX notes on active channel`}
							type="button"
							onClick={(): void => {
								generateSfxPattern(generator.archetype);
							}}
						>
							{generator.label}
						</button>
					))}

					<button
						className="inline-flex h-6 items-center gap-1 rounded border border-amber-400/50 bg-amber-500/15 px-2 text-[10px] font-semibold text-amber-200 transition hover:bg-amber-500/25"
						title="Generate a randomized retro SFX pattern on active channel"
						type="button"
						onClick={(): void => {
							generateSfxPattern("random");
						}}
					>
						<SparklesIcon aria-hidden="true" className="size-3" />
						<span>Mutate SFX</span>
					</button>

					<button
						className="inline-flex h-6 items-center gap-1 rounded border border-slate-700 bg-slate-950 px-2 text-[10px] font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white"
						title="Create a clean 1-bar blank SFX project"
						type="button"
						onClick={(): void => {
							createNewSfxProject();
						}}
					>
						<DocumentPlusIcon aria-hidden="true" className="size-3" />
						<span>Blank SFX</span>
					</button>
				</div>
			</div>
		</div>
	);
};

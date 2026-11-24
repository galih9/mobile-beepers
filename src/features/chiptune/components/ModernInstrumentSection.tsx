import {
	ArrowUpTrayIcon,
	ExclamationTriangleIcon,
	SparklesIcon,
	TrashIcon,
} from "@heroicons/react/24/outline";
import {
	useEffect,
	useId,
	useRef,
	useState,
	useSyncExternalStore,
	type ReactNode,
} from "react";
import type { FunctionComponent } from "../../../common/types";
import { isModernDrumEngine } from "../audio/modern/modernVoices";
import {
	ENGINE_SAMPLE_INSTRUMENT,
	getBuiltInInstrumentStatus,
	getSampleStatusVersion,
	getUserSampleStatus,
	importUserSampleFile,
	loadBuiltInInstrument,
	loadUserSample,
	subscribeSampleStatus,
	type SampleStatus,
} from "../audio/modern/sampleLibrary";
import { INSTRUMENT_PRESETS } from "../constants/instrumentPresets";
import {
	DELAY_DIVISION_OPTIONS,
	MODERN_ENGINE_LABELS,
	MODERN_INSTRUMENT_PRESETS,
	MODERN_PRESET_GROUPS,
	SYNTH_ENGINES,
} from "../constants/modernPresets";
import { midiToNoteName } from "../constants/scalesAndNotes";
import type {
	Channel,
	DelayDivision,
	InstrumentConfiguration,
	ModernInstrumentSettings,
} from "../types/music";
import { DraggablePresetChip } from "./InstrumentSlidersSection";
import { SliderControl } from "./SliderControl";

interface ModernInstrumentSectionProps {
	activeChannel: Channel;
	channelCount: number;
	selectedChannelIndex: number;
	onAddChannel: (channelType: "pitch" | "drum") => void;
	onRemoveChannel: (channelIndex: number) => void;
	onApplyPreset: (channelIndex: number, presetId: string) => void;
	onUpdateInstrument: (
		channelIndex: number,
		updates: Partial<InstrumentConfiguration>
	) => void;
	onUpdateModern: (
		channelIndex: number,
		updates: Partial<ModernInstrumentSettings>
	) => void;
}

// Log-scale helpers so filter sliders feel even across the audible range
const toLogPosition = (value: number, min: number, max: number): number =>
	Math.log(Math.max(min, value) / min) / Math.log(max / min);
const fromLogPosition = (position: number, min: number, max: number): number =>
	Math.round(min * Math.pow(max / min, position));
const formatHz = (value: number): string =>
	value >= 1000
		? `${(value / 1000).toFixed(1)} kHz`
		: `${Math.round(value)} Hz`;
const percent = (value: number): string => `${Math.round(value * 100)}%`;
const offWhenZero = (value: number): string =>
	value < 0.01 ? "Off" : percent(value);
const milliseconds = (value: number): string =>
	value >= 1 ? `${value.toFixed(2)} s` : `${Math.round(value * 1000)} ms`;

const SLICE_COUNT_OPTIONS = [4, 8, 16, 32];
const SLICE_BAR_OPTIONS = [0.5, 1, 2, 4];

const STATUS_TEXT: Record<SampleStatus, string> = {
	idle: "Not loaded",
	loading: "Loading samples…",
	ready: "Ready",
	missing: "Sample not found on this device — load it again",
	error: "Couldn't load samples",
};

const useSampleStatusVersion = (): number =>
	useSyncExternalStore(subscribeSampleStatus, getSampleStatusVersion);

const SectionCard = ({
	title,
	hint,
	children,
}: {
	title: string;
	hint?: string;
	children: ReactNode;
}): FunctionComponent => (
	<section
		aria-label={title}
		className="flex flex-col gap-1.5 rounded-lg border border-slate-800/80 bg-slate-900/50 p-2"
	>
		<div className="flex items-baseline justify-between gap-2">
			<h3 className="text-[10px] font-bold tracking-wider text-slate-300 uppercase">
				{title}
			</h3>
			{hint && (
				<span className="truncate text-[9px] text-slate-500">{hint}</span>
			)}
		</div>
		<div className="grid grid-cols-1 gap-1.5 @md:grid-cols-2 @md:gap-x-3">
			{children}
		</div>
	</section>
);

const SamplePanel = ({
	settings,
	accentColor,
	onUpdate,
}: {
	settings: ModernInstrumentSettings;
	accentColor: string;
	onUpdate: (updates: Partial<ModernInstrumentSettings>) => void;
}): FunctionComponent => {
	const inputId = useId();
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isImporting, setIsImporting] = useState(false);
	useSampleStatusVersion();

	const status = settings.sampleId
		? getUserSampleStatus(settings.sampleId)
		: "idle";
	useEffect(() => {
		if (settings.sampleId) {
			void loadUserSample(settings.sampleId);
		}
	}, [settings.sampleId]);
	const isSlicer = settings.engine === "slicer";

	return (
		<section
			aria-label={isSlicer ? "Break slicer" : "Sampler"}
			className="flex flex-col gap-2 rounded-lg border border-violet-500/30 bg-violet-500/5 p-2"
		>
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="min-w-0">
					<p className="text-[10px] font-bold tracking-wider text-violet-200 uppercase">
						{isSlicer ? "Your break" : "Your sample"}
					</p>
					<p className="truncate text-xs font-semibold text-white">
						{settings.sampleName ?? "Nothing loaded yet"}
					</p>
					{settings.sampleId && status !== "ready" && (
						<p
							className={`flex items-center gap-1 text-[10px] ${
								status === "missing" || status === "error"
									? "text-rose-300"
									: "text-slate-400"
							}`}
						>
							{(status === "missing" || status === "error") && (
								<ExclamationTriangleIcon
									aria-hidden="true"
									className="size-3"
								/>
							)}
							{STATUS_TEXT[status]}
						</p>
					)}
				</div>
				<label
					htmlFor={inputId}
					className={`inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border border-violet-400/50 bg-violet-500/15 px-2 text-[11px] font-bold text-violet-100 hover:border-violet-300 ${
						isImporting ? "opacity-60" : ""
					}`}
				>
					<ArrowUpTrayIcon aria-hidden="true" className="size-3.5" />
					{isImporting
						? "Loading…"
						: settings.sampleId
							? "Replace…"
							: isSlicer
								? "Load break…"
								: "Load sample…"}
				</label>
				<input
					ref={fileInputRef}
					accept="audio/*,.wav,.mp3,.ogg,.flac,.m4a,.aif,.aiff"
					className="sr-only"
					disabled={isImporting}
					id={inputId}
					type="file"
					onChange={(event): void => {
						const file = event.target.files?.[0];
						if (!file) {
							return;
						}
						setError(null);
						setIsImporting(true);
						importUserSampleFile(file)
							.then((info) => {
								onUpdate({ sampleId: info.id, sampleName: info.name });
							})
							.catch((importError: unknown) => {
								setError(
									importError instanceof Error
										? importError.message
										: "Couldn't load that file."
								);
							})
							.finally(() => {
								setIsImporting(false);
								if (fileInputRef.current) {
									fileInputRef.current.value = "";
								}
							});
					}}
				/>
			</div>
			{error && (
				<p className="text-[10px] text-rose-300" role="alert">
					{error}
				</p>
			)}

			{isSlicer ? (
				<>
					<div className="grid grid-cols-2 gap-2">
						<label className="flex flex-col gap-0.5 text-[11px] font-medium text-slate-300">
							Slices
							<select
								className="h-7 rounded border border-slate-700 bg-slate-900 px-2 text-xs font-semibold text-white"
								value={settings.sliceCount ?? 16}
								onChange={(event): void => {
									onUpdate({ sliceCount: Number(event.target.value) });
								}}
							>
								{SLICE_COUNT_OPTIONS.map((count) => (
									<option key={count} value={count}>
										{count} slices
									</option>
								))}
							</select>
						</label>
						<label className="flex flex-col gap-0.5 text-[11px] font-medium text-slate-300">
							Break length
							<select
								className="h-7 rounded border border-slate-700 bg-slate-900 px-2 text-xs font-semibold text-white"
								value={settings.sliceBars ?? 1}
								onChange={(event): void => {
									onUpdate({ sliceBars: Number(event.target.value) });
								}}
							>
								{SLICE_BAR_OPTIONS.map((barsOption) => (
									<option key={barsOption} value={barsOption}>
										{barsOption === 0.5
											? "½ bar"
											: `${barsOption} bar${barsOption > 1 ? "s" : ""}`}
									</option>
								))}
							</select>
						</label>
					</div>
					<label className="flex cursor-pointer items-center justify-between gap-2 text-[11px] font-medium text-slate-300">
						<span>
							Fit to song tempo
							<span className="block text-[10px] text-slate-500">
								Re-pitches the break so it lasts exactly the break length
							</span>
						</span>
						<input
							checked={settings.fitToTempo !== false}
							className="settings-switch"
							role="switch"
							type="checkbox"
							onChange={(event): void => {
								onUpdate({ fitToTempo: event.target.checked });
							}}
						/>
					</label>
					<p className="text-[10px] leading-snug text-slate-400">
						Each key plays one slice — C3 is slice 1, C#3 slice 2… Draw them in
						a new order in the piano roll to chop the break.
					</p>
				</>
			) : (
				<SliderControl
					inline
					accentColor={accentColor}
					formatValue={(value): string => midiToNoteName(value)}
					label="Original pitch"
					max={84}
					min={36}
					step={1}
					value={settings.sampleRootMidi ?? 60}
					onChange={(value): void => {
						onUpdate({ sampleRootMidi: value });
					}}
				/>
			)}
		</section>
	);
};

export const ModernInstrumentSection = ({
	activeChannel,
	channelCount,
	selectedChannelIndex,
	onAddChannel,
	onRemoveChannel,
	onApplyPreset,
	onUpdateInstrument,
	onUpdateModern,
}: ModernInstrumentSectionProps): FunctionComponent => {
	const presetSelectId = useId();
	const instrument = activeChannel.instrument;
	const settings = instrument.modern;
	const accentColor = activeChannel.color;
	const engine = settings?.engine;
	const isDrumKit = engine ? isModernDrumEngine(engine) : false;
	const isSampleEngine = engine === "sampler" || engine === "slicer";
	const builtInInstrument = engine
		? ENGINE_SAMPLE_INSTRUMENT[engine]
		: undefined;
	useSampleStatusVersion();

	const builtInStatus = builtInInstrument
		? getBuiltInInstrumentStatus(builtInInstrument)
		: "ready";
	useEffect(() => {
		if (builtInInstrument) {
			void loadBuiltInInstrument(builtInInstrument);
		}
	}, [builtInInstrument]);

	const updateModern = (updates: Partial<ModernInstrumentSettings>): void => {
		onUpdateModern(selectedChannelIndex, updates);
	};
	const updateInstrument = (
		updates: Partial<InstrumentConfiguration>
	): void => {
		onUpdateInstrument(selectedChannelIndex, updates);
	};

	const palettePresets = MODERN_INSTRUMENT_PRESETS.filter((preset) =>
		activeChannel.type === "drum"
			? preset.category === "drum"
			: preset.category === "pitch"
	);

	return (
		<div className="flex flex-col gap-2.5">
			<div className="flex items-center justify-between border-b border-slate-800/80 pb-1">
				<div className="flex min-w-0 items-center gap-1.5">
					<span
						className="size-2.5 shrink-0 rounded-full"
						style={{ backgroundColor: accentColor }}
					/>
					<h2 className="truncate text-xs font-bold tracking-wider text-slate-200 uppercase">
						Instrument: {activeChannel.name}
					</h2>
				</div>
				<div className="flex items-center gap-1">
					<button
						className="hidden h-6 items-center gap-0.5 rounded border border-slate-700 bg-slate-900 px-1.5 text-[10px] font-semibold text-cyan-300 md:inline-flex"
						type="button"
						onClick={(): void => {
							onAddChannel("pitch");
						}}
					>
						+ Instrument
					</button>
					<button
						className="hidden h-6 items-center gap-0.5 rounded border border-slate-700 bg-slate-900 px-1.5 text-[10px] font-semibold text-violet-300 md:inline-flex"
						type="button"
						onClick={(): void => {
							onAddChannel("drum");
						}}
					>
						+ Drums
					</button>
					{channelCount > 1 && (
						<button
							aria-label={`Remove ${activeChannel.name}`}
							className="flex size-6 items-center justify-center rounded border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
							type="button"
							onClick={(): void => {
								onRemoveChannel(selectedChannelIndex);
							}}
						>
							<TrashIcon aria-hidden="true" className="size-3" />
						</button>
					)}
				</div>
			</div>

			{/* Engine badge + sample loading status */}
			<div className="flex items-center justify-between gap-2 rounded-md border border-violet-500/25 bg-violet-500/10 px-2 py-1">
				<span className="flex min-w-0 items-center gap-1.5 text-[11px] font-bold text-violet-100">
					<SparklesIcon aria-hidden="true" className="size-3.5 shrink-0" />
					<span className="truncate">
						{engine ? MODERN_ENGINE_LABELS[engine] : "Retro chip voice"}
					</span>
				</span>
				{builtInInstrument && builtInStatus !== "ready" && (
					<span
						className={`shrink-0 font-mono text-[9px] font-bold ${
							builtInStatus === "error" ? "text-rose-300" : "text-slate-400"
						}`}
					>
						{builtInStatus === "error"
							? "Samples missing — restart the dev server"
							: "Loading samples…"}
					</span>
				)}
			</div>

			{/* Grouped, draggable preset palette */}
			<div className="hidden flex-col gap-1.5 md:flex">
				{MODERN_PRESET_GROUPS.map((group) => {
					const presets = palettePresets.filter(
						(preset) => preset.group === group.id
					);
					if (presets.length === 0) {
						return null;
					}
					return (
						<div key={group.id} className="flex flex-col gap-1">
							<span className="text-[9px] font-bold tracking-wider text-slate-500 uppercase">
								{group.label}
							</span>
							<div className="grid grid-cols-2 gap-1 xl:grid-cols-3">
								{presets.map((preset) => (
									<DraggablePresetChip
										key={preset.id}
										accentColor={accentColor}
										isActive={instrument.presetId === preset.id}
										preset={preset}
										onApply={(presetId): void => {
											onApplyPreset(selectedChannelIndex, presetId);
										}}
									/>
								))}
							</div>
						</div>
					);
				})}
			</div>

			<div className="grid grid-cols-[6.75rem_minmax(0,1fr)] items-center gap-2">
				<label
					className="text-[11px] font-medium text-slate-300"
					htmlFor={presetSelectId}
				>
					Preset
				</label>
				<select
					className="h-7 rounded border border-slate-700 bg-slate-900 px-2 text-xs font-semibold text-white"
					id={presetSelectId}
					value={instrument.presetId}
					onChange={(event): void => {
						onApplyPreset(selectedChannelIndex, event.target.value);
					}}
				>
					{MODERN_PRESET_GROUPS.map((group) => (
						<optgroup key={group.id} label={group.label}>
							{MODERN_INSTRUMENT_PRESETS.filter(
								(preset) => preset.group === group.id
							).map((preset) => (
								<option key={preset.id} value={preset.id}>
									{preset.name}
								</option>
							))}
						</optgroup>
					))}
					<optgroup label="Retro chip voices">
						{INSTRUMENT_PRESETS.map((preset) => (
							<option key={preset.id} value={preset.id}>
								{preset.name}
							</option>
						))}
					</optgroup>
				</select>
			</div>

			{!settings ? (
				<>
					<p className="rounded-md border border-slate-800 bg-slate-900/60 p-2 text-[11px] leading-snug text-slate-400">
						This channel uses a retro chip voice. It still plays through the
						modern mixer — pick a modern preset above for sampled and studio
						sounds, or switch to Chiptune mode in Settings to edit chip
						parameters.
					</p>
					<div className="grid grid-cols-1 gap-1.5 @md:grid-cols-2 @md:gap-x-3">
						<SliderControl
							inline
							accentColor={accentColor}
							formatValue={percent}
							label="Volume"
							max={1}
							min={0}
							step={0.01}
							value={instrument.volume}
							onChange={(volume): void => {
								updateInstrument({ volume });
							}}
						/>
					</div>
				</>
			) : (
				<>
					{isSampleEngine && (
						<SamplePanel
							accentColor={accentColor}
							settings={settings}
							onUpdate={updateModern}
						/>
					)}

					<SectionCard title="Mix">
						<SliderControl
							inline
							accentColor={accentColor}
							formatValue={percent}
							label="Volume"
							max={1}
							min={0}
							step={0.01}
							value={instrument.volume}
							onChange={(volume): void => {
								updateInstrument({ volume });
							}}
						/>
						<SliderControl
							inline
							accentColor={accentColor}
							label="Panning"
							max={1}
							min={-1}
							step={0.05}
							value={instrument.pan}
							formatValue={(value): string =>
								Math.abs(value) < 0.01
									? "Center"
									: value < 0
										? `${Math.round(Math.abs(value) * 100)}L`
										: `${Math.round(value * 100)}R`
							}
							onChange={(pan): void => {
								updateInstrument({ pan });
							}}
						/>
						<SliderControl
							inline
							accentColor={accentColor}
							label={isDrumKit ? "Kit Pitch" : "Tune"}
							max={24}
							min={-24}
							step={1}
							value={settings.tune}
							formatValue={(value): string =>
								value === 0 ? "0 st" : `${value > 0 ? "+" : ""}${value} st`
							}
							onChange={(tune): void => {
								updateModern({ tune });
							}}
						/>
					</SectionCard>

					{!isDrumKit && (
						<SectionCard title="Tone">
							<SliderControl
								inline
								accentColor={accentColor}
								label="Filter Cutoff"
								max={1}
								min={0}
								step={0.005}
								value={toLogPosition(settings.cutoff, 60, 18_000)}
								formatValue={(position): string =>
									formatHz(fromLogPosition(position, 60, 18_000))
								}
								onChange={(position): void => {
									updateModern({
										cutoff: fromLogPosition(position, 60, 18_000),
									});
								}}
							/>
							<SliderControl
								inline
								accentColor={accentColor}
								formatValue={(value): string => value.toFixed(1)}
								label="Resonance"
								max={12}
								min={0.5}
								step={0.1}
								value={settings.resonance}
								onChange={(resonance): void => {
									updateModern({ resonance });
								}}
							/>
							{engine && SYNTH_ENGINES.has(engine) && (
								<>
									<SliderControl
										inline
										accentColor={accentColor}
										label="Filter Env"
										max={6}
										min={0}
										step={0.1}
										value={settings.filterEnv}
										formatValue={(value): string =>
											value < 0.05 ? "Off" : `${value.toFixed(1)} oct`
										}
										onChange={(filterEnv): void => {
											updateModern({ filterEnv });
										}}
									/>
									<SliderControl
										inline
										accentColor={accentColor}
										label="Unison Spread"
										max={60}
										min={0}
										step={1}
										value={settings.spread}
										formatValue={(value): string =>
											value < 0.5 ? "Mono" : `${Math.round(value)} cts`
										}
										onChange={(spread): void => {
											updateModern({ spread });
										}}
									/>
								</>
							)}
						</SectionCard>
					)}

					{!isDrumKit && (
						<SectionCard title="Envelope">
							<SliderControl
								inline
								accentColor={accentColor}
								formatValue={milliseconds}
								label="Attack"
								max={2}
								min={0.001}
								step={0.001}
								value={instrument.attack}
								onChange={(attack): void => {
									updateInstrument({ attack });
								}}
							/>
							<SliderControl
								inline
								accentColor={accentColor}
								formatValue={milliseconds}
								label="Decay"
								max={3}
								min={0.02}
								step={0.01}
								value={instrument.decay}
								onChange={(decay): void => {
									updateInstrument({ decay });
								}}
							/>
							<SliderControl
								inline
								accentColor={accentColor}
								formatValue={percent}
								label="Sustain"
								max={1}
								min={0}
								step={0.01}
								value={instrument.sustain}
								onChange={(sustain): void => {
									updateInstrument({ sustain });
								}}
							/>
							<SliderControl
								inline
								accentColor={accentColor}
								formatValue={milliseconds}
								label="Release"
								max={4}
								min={0.01}
								step={0.01}
								value={instrument.release}
								onChange={(release): void => {
									updateInstrument({ release });
								}}
							/>
						</SectionCard>
					)}

					<SectionCard hint="Sidechain ducks to any kit kick" title="Effects">
						<SliderControl
							inline
							accentColor={accentColor}
							formatValue={offWhenZero}
							label="Drive"
							max={1}
							min={0}
							step={0.01}
							value={settings.drive}
							onChange={(drive): void => {
								updateModern({ drive });
							}}
						/>
						<SliderControl
							inline
							accentColor={accentColor}
							formatValue={offWhenZero}
							label="Chorus"
							max={1}
							min={0}
							step={0.01}
							value={settings.chorus}
							onChange={(chorus): void => {
								updateModern({ chorus });
							}}
						/>
						<SliderControl
							inline
							accentColor={accentColor}
							formatValue={offWhenZero}
							label="Delay"
							max={1}
							min={0}
							step={0.01}
							value={settings.delayMix}
							onChange={(delayMix): void => {
								updateModern({ delayMix });
							}}
						/>
						<div className="grid grid-cols-[6.75rem_minmax(0,1fr)_3.5rem] items-center gap-2">
							<label
								className="text-[11px] font-medium text-slate-300"
								htmlFor={`${presetSelectId}-delay-time`}
							>
								Delay Time
							</label>
							<select
								className="col-span-2 h-6 rounded border border-slate-700 bg-slate-900 px-1.5 text-[11px] font-semibold text-white"
								id={`${presetSelectId}-delay-time`}
								value={settings.delayDivision}
								onChange={(event): void => {
									updateModern({
										delayDivision: event.target.value as DelayDivision,
									});
								}}
							>
								{DELAY_DIVISION_OPTIONS.map((option) => (
									<option key={option.value} value={option.value}>
										{option.label}
									</option>
								))}
							</select>
						</div>
						<SliderControl
							inline
							accentColor={accentColor}
							formatValue={percent}
							label="Delay Feedback"
							max={0.85}
							min={0}
							step={0.01}
							value={settings.delayFeedback}
							onChange={(delayFeedback): void => {
								updateModern({ delayFeedback });
							}}
						/>
						<SliderControl
							inline
							accentColor={accentColor}
							label="Reverb"
							max={1}
							min={0}
							step={0.01}
							value={settings.reverbSend}
							formatValue={(value): string =>
								value < 0.01 ? "Dry" : percent(value)
							}
							onChange={(reverbSend): void => {
								updateModern({ reverbSend });
							}}
						/>
						<SliderControl
							inline
							accentColor={accentColor}
							formatValue={offWhenZero}
							label="Sidechain"
							max={1}
							min={0}
							step={0.01}
							value={settings.sidechain}
							onChange={(sidechain): void => {
								updateModern({ sidechain });
							}}
						/>
						<SliderControl
							inline
							accentColor={accentColor}
							label="Low Cut"
							max={1}
							min={0}
							step={0.005}
							value={toLogPosition(settings.lowCut, 20, 1200)}
							formatValue={(position): string => {
								const value = fromLogPosition(position, 20, 1200);
								return value <= 21 ? "Off" : formatHz(value);
							}}
							onChange={(position): void => {
								updateModern({ lowCut: fromLogPosition(position, 20, 1200) });
							}}
						/>
					</SectionCard>
				</>
			)}
		</div>
	);
};

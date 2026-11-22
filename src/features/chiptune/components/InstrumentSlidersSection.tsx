import { TrashIcon } from "@heroicons/react/24/outline";
import { useDrag } from "react-dnd";
import type { FunctionComponent } from "../../../common/types";
import {
	ARP_MODE_OPTIONS,
	INSTRUMENT_PRESETS,
	WAVEFORM_OPTIONS,
} from "../constants/instrumentPresets";
import type {
	ArpMode,
	Channel,
	InstrumentConfiguration,
	InstrumentPresetDefinition,
	WaveformType,
} from "../types/music";
import { DND_ITEM_TYPES, type InstrumentPresetDragItem } from "./dndTypes";
import { SliderControl } from "./SliderControl";

interface DraggablePresetChipProps {
	preset: InstrumentPresetDefinition;
	isActive: boolean;
	accentColor: string;
	onApply: (presetId: string) => void;
}

export const DraggablePresetChip = ({
	preset,
	isActive,
	accentColor,
	onApply,
}: DraggablePresetChipProps): FunctionComponent => {
	const [{ isDragging }, dragPresetRef] = useDrag<
		InstrumentPresetDragItem,
		void,
		{ isDragging: boolean }
	>(
		() => ({
			type: DND_ITEM_TYPES.INSTRUMENT_PRESET,
			item: {
				type: DND_ITEM_TYPES.INSTRUMENT_PRESET,
				presetId: preset.id,
				presetName: preset.name,
			},
			collect: (monitor): { isDragging: boolean } => ({
				isDragging: monitor.isDragging(),
			}),
		}),
		[preset.id, preset.name]
	);

	return (
		<button
			ref={(element): void => {
				dragPresetRef(element);
			}}
			aria-pressed={isActive}
			style={isActive ? { borderColor: accentColor } : undefined}
			title={`${preset.description} (Click to apply, or drag onto any track / piano roll)`}
			type="button"
			className={`cursor-grab rounded-md border px-2 py-1 text-left text-[10px] font-semibold transition select-none active:cursor-grabbing ${
				isDragging ? "opacity-50" : "opacity-100"
			} ${
				isActive
					? "border-cyan-400/70 bg-cyan-500/15 text-cyan-100"
					: "border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-600 hover:text-white"
			}`}
			onClick={(): void => {
				onApply(preset.id);
			}}
		>
			<span className="block truncate">{preset.name}</span>
		</button>
	);
};

interface InstrumentSlidersSectionProps {
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
}

export const InstrumentSlidersSection = ({
	activeChannel,
	channelCount,
	selectedChannelIndex,
	onAddChannel,
	onRemoveChannel,
	onApplyPreset,
	onUpdateInstrument,
}: InstrumentSlidersSectionProps): FunctionComponent => {
	const instrument = activeChannel.instrument;

	return (
		<div className="flex flex-col gap-2.5">
			<div className="flex items-center justify-between border-b border-slate-800/80 pb-1">
				<div className="flex items-center gap-1.5">
					<span
						className="size-2.5 rounded-full"
						style={{ backgroundColor: activeChannel.color }}
					/>
					<h2 className="text-xs font-bold tracking-wider text-slate-200 uppercase">
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
						+ Synth
					</button>
					<button
						className="hidden h-6 items-center gap-0.5 rounded border border-slate-700 bg-slate-900 px-1.5 text-[10px] font-semibold text-violet-300 md:inline-flex"
						type="button"
						onClick={(): void => {
							onAddChannel("drum");
						}}
					>
						+ Drum
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

			{/* Draggable Instrument Preset Bank for Tablet & Desktop */}
			<div className="hidden flex-col gap-1 md:flex">
				<div className="flex items-center justify-between text-[10px] font-semibold text-slate-400">
					<span>Draggable Preset Palette</span>
					<span className="font-mono text-[9px] text-cyan-400/80">
						Click or drag to track
					</span>
				</div>
				<div className="grid grid-cols-2 gap-1 xl:grid-cols-3">
					{INSTRUMENT_PRESETS.map((preset) => (
						<DraggablePresetChip
							key={preset.id}
							accentColor={activeChannel.color}
							isActive={instrument.presetId === preset.id}
							preset={preset}
							onApply={(presetId): void => {
								onApplyPreset(selectedChannelIndex, presetId);
							}}
						/>
					))}
				</div>
			</div>

			<div className="grid grid-cols-[6.75rem_minmax(0,1fr)] items-center gap-2">
				<label
					className="text-[11px] font-medium text-slate-300"
					htmlFor="inst-preset-select"
				>
					Preset
				</label>
				<select
					className="h-7 rounded border border-slate-700 bg-slate-900 px-2 text-xs font-semibold text-white"
					id="inst-preset-select"
					value={instrument.presetId}
					onChange={(event): void => {
						onApplyPreset(selectedChannelIndex, event.target.value);
					}}
				>
					{INSTRUMENT_PRESETS.map((preset) => (
						<option key={preset.id} value={preset.id}>
							{preset.name}
						</option>
					))}
				</select>
			</div>

			{activeChannel.type === "pitch" && (
				<div className="grid grid-cols-1 gap-2 @sm:grid-cols-2">
					<div className="grid grid-cols-[6.75rem_minmax(0,1fr)] items-center gap-2 @sm:grid-cols-1 @sm:gap-1">
						<label
							className="text-[11px] font-medium text-slate-300"
							htmlFor="inst-wave-select"
						>
							Wave
						</label>
						<select
							className="h-7 rounded border border-slate-700 bg-slate-900 px-2 text-xs font-semibold text-white"
							id="inst-wave-select"
							value={instrument.waveform}
							onChange={(event): void => {
								onUpdateInstrument(selectedChannelIndex, {
									waveform: event.target.value as WaveformType,
								});
							}}
						>
							{WAVEFORM_OPTIONS.filter(
								(option) => option.value !== "retroKit"
							).map((option) => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</select>
					</div>

					<div className="grid grid-cols-[6.75rem_minmax(0,1fr)] items-center gap-2 @sm:grid-cols-1 @sm:gap-1">
						<label
							className="text-[11px] font-medium text-slate-300"
							htmlFor="inst-arp-select"
						>
							Arp Chord
						</label>
						<select
							className="h-7 rounded border border-slate-700 bg-slate-900 px-2 text-xs font-semibold text-white"
							id="inst-arp-select"
							value={instrument.arpMode}
							onChange={(event): void => {
								onUpdateInstrument(selectedChannelIndex, {
									arpMode: event.target.value as ArpMode,
								});
							}}
						>
							{ARP_MODE_OPTIONS.map((option) => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</select>
					</div>
				</div>
			)}

			<div className="flex flex-col gap-1 rounded border border-slate-800/80 bg-slate-900/50 p-1.5">
				<div className="flex items-center justify-between gap-2">
					<span className="text-[10px] font-semibold text-slate-300">
						UltraBox Fade Envelope
					</span>
					<div className="flex items-center gap-1">
						{[
							{ label: "Fade In", value: -0.85 },
							{ label: "Flat", value: 0 },
							{ label: "Fade Out", value: 0.85 },
						].map((presetOption) => {
							const currentFade = instrument.fadeInOut ?? 0;
							const isSelected =
								presetOption.value === 0
									? Math.abs(currentFade) < 0.05
									: presetOption.value < 0
										? currentFade <= -0.3
										: currentFade >= 0.3;
							return (
								<button
									key={presetOption.label}
									aria-pressed={isSelected}
									type="button"
									className={`rounded px-1.5 py-0.5 text-[9px] font-bold transition ${
										isSelected
											? "bg-cyan-500/25 text-cyan-200"
											: "bg-slate-800 text-slate-400 hover:text-white"
									}`}
									onClick={(): void => {
										onUpdateInstrument(selectedChannelIndex, {
											fadeInOut: presetOption.value,
										});
									}}
								>
									{presetOption.label}
								</button>
							);
						})}
					</div>
				</div>
				<SliderControl
					inline
					accentColor={activeChannel.color}
					label="Fade In / Out"
					max={1}
					min={-1}
					step={0.05}
					value={instrument.fadeInOut ?? 0}
					formatValue={(value): string => {
						if (Math.abs(value) < 0.02) {
							return "Neutral";
						}
						return value < 0
							? `In ${Math.round(Math.abs(value) * 100)}%`
							: `Out ${Math.round(value * 100)}%`;
					}}
					onChange={(nextValue): void => {
						onUpdateInstrument(selectedChannelIndex, { fadeInOut: nextValue });
					}}
				/>
			</div>

			<div className="grid grid-cols-1 gap-1.5 @md:grid-cols-2 @md:gap-x-3">
				<SliderControl
					inline
					accentColor={activeChannel.color}
					formatValue={(value): string => `${Math.round(value * 100)}%`}
					label="Volume"
					max={1}
					min={0}
					step={0.01}
					value={instrument.volume}
					onChange={(nextValue): void => {
						onUpdateInstrument(selectedChannelIndex, { volume: nextValue });
					}}
				/>

				<SliderControl
					inline
					accentColor={activeChannel.color}
					label="Panning"
					max={1}
					min={-1}
					step={0.05}
					value={instrument.pan}
					formatValue={(value): string =>
						value === 0
							? "Center"
							: value < 0
								? `${Math.round(Math.abs(value) * 100)}L`
								: `${Math.round(value * 100)}R`
					}
					onChange={(nextValue): void => {
						onUpdateInstrument(selectedChannelIndex, { pan: nextValue });
					}}
				/>

				<SliderControl
					inline
					accentColor={activeChannel.color}
					label="Drive / Crush"
					max={1}
					min={0}
					step={0.05}
					value={instrument.drive ?? 0}
					formatValue={(value): string =>
						value < 0.05 ? "Clean" : `${Math.round(value * 100)}%`
					}
					onChange={(nextValue): void => {
						onUpdateInstrument(selectedChannelIndex, { drive: nextValue });
					}}
				/>

				<SliderControl
					inline
					accentColor={activeChannel.color}
					label="Hall Reverb"
					max={1}
					min={0}
					step={0.02}
					value={instrument.reverbMix ?? 0}
					formatValue={(value): string =>
						value < 0.01 ? "Dry" : `${Math.round(value * 100)}%`
					}
					onChange={(nextValue): void => {
						onUpdateInstrument(selectedChannelIndex, { reverbMix: nextValue });
					}}
				/>

				<SliderControl
					inline
					accentColor={activeChannel.color}
					label="Punch / Glue"
					max={1}
					min={0}
					step={0.05}
					value={instrument.punch ?? 0}
					formatValue={(value): string =>
						value < 0.05 ? "Off" : `${Math.round(value * 100)}%`
					}
					onChange={(nextValue): void => {
						onUpdateInstrument(selectedChannelIndex, { punch: nextValue });
					}}
				/>

				{activeChannel.type === "pitch" && (
					<>
						<SliderControl
							inline
							accentColor={activeChannel.color}
							formatValue={(value): string => `${Math.round(value)} Hz`}
							label="Filter Cutoff"
							max={10000}
							min={400}
							step={100}
							value={instrument.filterCutoff}
							onChange={(nextValue): void => {
								onUpdateInstrument(selectedChannelIndex, {
									filterCutoff: nextValue,
								});
							}}
						/>
						<SliderControl
							inline
							accentColor={activeChannel.color}
							formatValue={(value): string => `${Math.round(value)} cts`}
							label="Detune"
							max={50}
							min={-50}
							step={1}
							value={instrument.detuneCents}
							onChange={(nextValue): void => {
								onUpdateInstrument(selectedChannelIndex, {
									detuneCents: nextValue,
								});
							}}
						/>
						<SliderControl
							inline
							accentColor={activeChannel.color}
							formatValue={(value): string => `${Math.round(value * 1000)} ms`}
							label="Attack"
							max={2}
							min={0.002}
							step={0.002}
							value={instrument.attack}
							onChange={(nextValue): void => {
								onUpdateInstrument(selectedChannelIndex, { attack: nextValue });
							}}
						/>
						<SliderControl
							inline
							accentColor={activeChannel.color}
							formatValue={(value): string => `${Math.round(value * 1000)} ms`}
							label="Decay"
							max={0.5}
							min={0.02}
							step={0.01}
							value={instrument.decay}
							onChange={(nextValue): void => {
								onUpdateInstrument(selectedChannelIndex, { decay: nextValue });
							}}
						/>
						<SliderControl
							inline
							accentColor={activeChannel.color}
							formatValue={(value): string => `${Math.round(value * 100)}%`}
							label="Sustain"
							max={1}
							min={0.05}
							step={0.02}
							value={instrument.sustain}
							onChange={(nextValue): void => {
								onUpdateInstrument(selectedChannelIndex, {
									sustain: nextValue,
								});
							}}
						/>
						<SliderControl
							inline
							accentColor={activeChannel.color}
							formatValue={(value): string => `${Math.round(value * 1000)} ms`}
							label="Release"
							max={4}
							min={0.02}
							step={0.01}
							value={instrument.release}
							onChange={(nextValue): void => {
								onUpdateInstrument(selectedChannelIndex, {
									release: nextValue,
								});
							}}
						/>
						<SliderControl
							inline
							accentColor={activeChannel.color}
							formatValue={(value): string => `${Math.round(value)} cts`}
							label="Vibrato"
							max={45}
							min={0}
							step={1}
							value={instrument.vibratoDepth}
							onChange={(nextValue): void => {
								onUpdateInstrument(selectedChannelIndex, {
									vibratoDepth: nextValue,
								});
							}}
						/>
						<SliderControl
							inline
							accentColor={activeChannel.color}
							formatValue={(value): string => `${Math.round(value * 100)}%`}
							label="Echo Mix"
							max={0.65}
							min={0}
							step={0.02}
							value={instrument.echoMix}
							onChange={(nextValue): void => {
								onUpdateInstrument(selectedChannelIndex, {
									echoMix: nextValue,
								});
							}}
						/>
						<SliderControl
							inline
							accentColor={activeChannel.color}
							formatValue={(value): string => `${Math.round(value * 1000)} ms`}
							label="Echo Time"
							max={0.55}
							min={0.06}
							step={0.01}
							value={instrument.echoTimeSeconds}
							onChange={(nextValue): void => {
								onUpdateInstrument(selectedChannelIndex, {
									echoTimeSeconds: nextValue,
								});
							}}
						/>
					</>
				)}
			</div>
		</div>
	);
};

import { TrashIcon } from "@heroicons/react/24/outline";
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
	WaveformType,
} from "../types/music";
import { SliderControl } from "./SliderControl";

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
		<div className="flex flex-col gap-2">
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
						className="hidden h-6 items-center gap-0.5 rounded border border-slate-700 bg-slate-900 px-1.5 text-[10px] font-semibold text-cyan-300 lg:inline-flex"
						type="button"
						onClick={(): void => {
							onAddChannel("pitch");
						}}
					>
						+ Synth
					</button>
					<button
						className="hidden h-6 items-center gap-0.5 rounded border border-slate-700 bg-slate-900 px-1.5 text-[10px] font-semibold text-violet-300 lg:inline-flex"
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
				<>
					<div className="grid grid-cols-[6.75rem_minmax(0,1fr)] items-center gap-2">
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

					<div className="grid grid-cols-[6.75rem_minmax(0,1fr)] items-center gap-2">
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
				</>
			)}

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
						formatValue={(value): string => `${Math.round(value * 1000)} ms`}
						label="Attack"
						max={0.3}
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
						label="Release"
						max={0.6}
						min={0.02}
						step={0.01}
						value={instrument.release}
						onChange={(nextValue): void => {
							onUpdateInstrument(selectedChannelIndex, { release: nextValue });
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
							onUpdateInstrument(selectedChannelIndex, { echoMix: nextValue });
						}}
					/>
				</>
			)}
		</div>
	);
};

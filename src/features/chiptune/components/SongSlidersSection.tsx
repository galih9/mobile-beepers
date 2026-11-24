import { useEffect, useRef, useState } from "react";
import type { FunctionComponent } from "../../../common/types";
import {
	calculateTapBpm,
	MAX_BPM,
	MIN_BPM,
	playOneShotMetronomeClick,
	recordTapTimestamp,
	TAP_TEMPO_RESET_MS,
} from "../audio/metronome";
import { MAX_SONG_BARS } from "../constants/limits";
import { MUSICAL_KEYS, SCALE_DEFINITIONS } from "../constants/scalesAndNotes";
import type { MusicalKey, ScaleType, SongProject } from "../types/music";
import { SliderControl } from "./SliderControl";

interface SongSlidersSectionProps {
	song: SongProject;
	scaleLockOnly: boolean;
	showGhostNotes: boolean;
	metronomeEnabled: boolean;
	onUpdateMetadata: (
		updates: Partial<
			Pick<
				SongProject,
				"title" | "bpm" | "rootKey" | "scale" | "swing" | "masterVolume"
			>
		>
	) => void;
	onSetTotalBars: (totalBars: number) => void;
	onToggleScaleLock: () => void;
	onToggleGhostNotes: () => void;
	onToggleMetronome: () => void;
}

export const SongSlidersSection = ({
	song,
	scaleLockOnly,
	showGhostNotes,
	metronomeEnabled,
	onUpdateMetadata,
	onSetTotalBars,
	onToggleScaleLock,
	onToggleGhostNotes,
	onToggleMetronome,
}: SongSlidersSectionProps): FunctionComponent => {
	const tapHistoryRef = useRef<Array<number>>([]);
	const tapResetTimerRef = useRef<number | null>(null);
	const [tapCount, setTapCount] = useState(0);

	useEffect(() => {
		return (): void => {
			if (tapResetTimerRef.current !== null) {
				window.clearTimeout(tapResetTimerRef.current);
				tapResetTimerRef.current = null;
			}
		};
	}, []);

	const handleTapTempo = (): void => {
		const nextHistory = recordTapTimestamp(
			tapHistoryRef.current,
			performance.now()
		);
		tapHistoryRef.current = nextHistory;
		setTapCount(nextHistory.length);
		if (tapResetTimerRef.current !== null) {
			window.clearTimeout(tapResetTimerRef.current);
		}
		tapResetTimerRef.current = window.setTimeout(() => {
			tapHistoryRef.current = [];
			setTapCount(0);
			tapResetTimerRef.current = null;
		}, TAP_TEMPO_RESET_MS);
		playOneShotMetronomeClick(
			(nextHistory.length - 1) % Math.max(1, song.beatsPerBar) === 0,
			0.65
		);
		const calculated = calculateTapBpm(nextHistory, MIN_BPM, MAX_BPM);
		if (calculated !== null) {
			onUpdateMetadata({ bpm: calculated });
		}
	};
	return (
		<div className="flex flex-col gap-2">
			<h2 className="border-b border-slate-800/80 pb-1 text-xs font-bold tracking-wider text-slate-200 uppercase">
				Song & Scale Settings
			</h2>

			<div className="grid grid-cols-[6.75rem_minmax(0,1fr)] items-center gap-2">
				<label
					className="text-[11px] font-medium text-slate-300"
					htmlFor="song-scale-select"
				>
					Scale
				</label>
				<select
					className="h-7 rounded border border-slate-700 bg-slate-900 px-2 text-xs font-semibold text-white"
					id="song-scale-select"
					value={song.scale}
					onChange={(event): void => {
						onUpdateMetadata({ scale: event.target.value as ScaleType });
					}}
				>
					{Object.entries(SCALE_DEFINITIONS).map(([scaleKey, definition]) => (
						<option key={scaleKey} value={scaleKey}>
							{definition.label}
						</option>
					))}
				</select>
			</div>

			<div className="grid grid-cols-[6.75rem_minmax(0,1fr)] items-center gap-2">
				<label
					className="text-[11px] font-medium text-slate-300"
					htmlFor="song-key-select"
				>
					Root Key
				</label>
				<select
					className="h-7 rounded border border-slate-700 bg-slate-900 px-2 text-xs font-semibold text-white"
					id="song-key-select"
					value={song.rootKey}
					onChange={(event): void => {
						onUpdateMetadata({ rootKey: event.target.value as MusicalKey });
					}}
				>
					{MUSICAL_KEYS.map((keyName) => (
						<option key={keyName} value={keyName}>
							{keyName}
						</option>
					))}
				</select>
			</div>

			<SliderControl
				inline
				formatValue={(value): string => `${Math.round(value)} BPM`}
				label="Tempo"
				max={MAX_BPM}
				min={MIN_BPM}
				step={1}
				value={song.bpm}
				onChange={(nextValue): void => {
					onUpdateMetadata({ bpm: nextValue });
				}}
			/>

			<div className="grid grid-cols-2 gap-2">
				<button
					aria-label="Tap tempo to detect BPM"
					className="h-7 rounded border border-amber-400/50 bg-amber-500/15 text-[11px] font-semibold text-amber-200 transition hover:border-amber-300 hover:bg-amber-500/25 active:scale-[0.98]"
					title="Tap repeatedly along with a beat to calculate BPM"
					type="button"
					onClick={handleTapTempo}
				>
					{tapCount > 0 ? `Tap Tempo (${tapCount})` : "Tap BPM"}
				</button>
				<button
					aria-pressed={metronomeEnabled}
					type="button"
					className={`h-7 rounded border text-[11px] font-semibold transition ${
						metronomeEnabled
							? "border-cyan-400/60 bg-cyan-500/15 text-cyan-200"
							: "border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200"
					}`}
					onClick={onToggleMetronome}
				>
					{metronomeEnabled ? "Metronome: ON" : "Metronome: OFF"}
				</button>
			</div>

			<SliderControl
				inline
				formatValue={(value): string => `${Math.round(value * 100)}%`}
				label="Swing"
				max={0.6}
				min={0}
				step={0.02}
				value={song.swing}
				onChange={(nextValue): void => {
					onUpdateMetadata({ swing: nextValue });
				}}
			/>

			<SliderControl
				inline
				label="Song Length"
				max={MAX_SONG_BARS}
				min={1}
				step={1}
				value={song.totalBars}
				formatValue={(value): string => {
					const rounded = Math.round(value);
					return rounded === 1 ? "1 Bar" : `${rounded} Bars`;
				}}
				onChange={onSetTotalBars}
			/>

			<div className="grid grid-cols-2 gap-2 pt-1">
				<button
					aria-pressed={scaleLockOnly}
					type="button"
					className={`h-7 rounded border text-[11px] font-semibold transition ${
						scaleLockOnly
							? "border-emerald-400/60 bg-emerald-500/15 text-emerald-300"
							: "border-slate-700 bg-slate-900 text-slate-400"
					}`}
					onClick={onToggleScaleLock}
				>
					{scaleLockOnly ? "Scale Lock: ON" : "Scale Lock: OFF"}
				</button>
				<button
					aria-pressed={showGhostNotes}
					type="button"
					className={`h-7 rounded border text-[11px] font-semibold transition ${
						showGhostNotes
							? "border-cyan-400/60 bg-cyan-500/15 text-cyan-300"
							: "border-slate-700 bg-slate-900 text-slate-400"
					}`}
					onClick={onToggleGhostNotes}
				>
					{showGhostNotes ? "Ghost Notes: ON" : "Ghost Notes: OFF"}
				</button>
			</div>
		</div>
	);
};

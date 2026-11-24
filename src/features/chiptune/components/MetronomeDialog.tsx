import {
	ClockIcon,
	HandRaisedIcon,
	PlayIcon,
	StopIcon,
	XMarkIcon,
} from "@heroicons/react/24/outline";
import {
	useCallback,
	useEffect,
	useId,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import type { FunctionComponent } from "../../../common/types";
import {
	calculateTapBpm,
	clampBpm,
	GENRE_BPM_PRESETS,
	MAX_BPM,
	MIN_BPM,
	playOneShotMetronomeClick,
	recordTapTimestamp,
	standaloneMetronome,
	TAP_TEMPO_RESET_MS,
} from "../audio/metronome";
import { useChiptuneStore } from "../store/useChiptuneStore";
import { SliderControl } from "./SliderControl";

interface MetronomeDialogProps {
	isOpen: boolean;
	onClose: () => void;
}

/**
 * Interactive Metronome, Tap Tempo & Genre BPM Reference modal.
 * Uses native <dialog> top-layer semantics with Safari light-dismiss fallback.
 */
export const MetronomeDialog = ({
	isOpen,
	onClose,
}: MetronomeDialogProps): FunctionComponent => {
	const titleId = useId();
	const playbackClickId = useId();
	const accentSwitchId = useId();
	const dialogRef = useRef<HTMLDialogElement | null>(null);
	const tapHistoryRef = useRef<Array<number>>([]);
	const tapResetTimerRef = useRef<number | null>(null);

	const { isRunning: isStandaloneRunning, currentBeat: standaloneBeat } =
		useSyncExternalStore(
			standaloneMetronome.subscribe,
			standaloneMetronome.getSnapshot
		);
	const [tapCount, setTapCount] = useState(0);

	const song = useChiptuneStore((state) => state.song);
	const isPlaying = useChiptuneStore((state) => state.isPlaying);
	const playbackStep = useChiptuneStore((state) => state.playbackStep);
	const setIsPlaying = useChiptuneStore((state) => state.setIsPlaying);
	const metronomeEnabled = useChiptuneStore((state) => state.metronomeEnabled);
	const metronomeVolume = useChiptuneStore((state) => state.metronomeVolume);
	const metronomeAccent = useChiptuneStore((state) => state.metronomeAccent);
	const setMetronomeEnabled = useChiptuneStore(
		(state) => state.setMetronomeEnabled
	);
	const setMetronomeVolume = useChiptuneStore(
		(state) => state.setMetronomeVolume
	);
	const setMetronomeAccent = useChiptuneStore(
		(state) => state.setMetronomeAccent
	);
	const updateSongMetadata = useChiptuneStore(
		(state) => state.updateSongMetadata
	);

	const beatsPerBar = Math.max(1, song.beatsPerBar);

	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) {
			return;
		}
		if (isOpen && !dialog.open) {
			dialog.showModal();
		} else if (!isOpen && dialog.open) {
			dialog.close();
		}
	}, [isOpen]);

	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) {
			return;
		}
		const handleNativeClose = (): void => {
			dialog.returnValue = "";
			standaloneMetronome.stop();
			onClose();
		};
		dialog.addEventListener("close", handleNativeClose);

		if (!("closedBy" in HTMLDialogElement.prototype)) {
			let pressedOutside = false;
			const isPointerOutside = (event: PointerEvent): boolean => {
				const rectangle = dialog.getBoundingClientRect();
				return (
					event.clientX < rectangle.left ||
					event.clientX > rectangle.right ||
					event.clientY < rectangle.top ||
					event.clientY > rectangle.bottom
				);
			};
			const handlePointerDown = (event: PointerEvent): void => {
				pressedOutside = isPointerOutside(event);
			};
			const handlePointerUp = (event: PointerEvent): void => {
				if (pressedOutside && isPointerOutside(event)) {
					dialog.close();
				}
			};
			dialog.addEventListener("pointerdown", handlePointerDown);
			dialog.addEventListener("pointerup", handlePointerUp);
			return (): void => {
				dialog.removeEventListener("close", handleNativeClose);
				dialog.removeEventListener("pointerdown", handlePointerDown);
				dialog.removeEventListener("pointerup", handlePointerUp);
			};
		}

		return (): void => {
			dialog.removeEventListener("close", handleNativeClose);
		};
	}, [onClose]);

	useEffect(() => {
		return (): void => {
			standaloneMetronome.stop();
			if (tapResetTimerRef.current !== null) {
				window.clearTimeout(tapResetTimerRef.current);
				tapResetTimerRef.current = null;
			}
		};
	}, []);

	useEffect(() => {
		if (!isOpen || isPlaying) {
			standaloneMetronome.stop();
		}
	}, [isOpen, isPlaying]);

	useEffect(() => {
		if (isStandaloneRunning) {
			standaloneMetronome.update(
				song.bpm,
				beatsPerBar,
				metronomeVolume,
				metronomeAccent
			);
		}
	}, [
		isStandaloneRunning,
		song.bpm,
		beatsPerBar,
		metronomeVolume,
		metronomeAccent,
	]);

	const handleTapTempo = useCallback((): void => {
		const now = performance.now();
		const nextHistory = recordTapTimestamp(tapHistoryRef.current, now);
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

		const isAccentTap =
			metronomeAccent && (nextHistory.length - 1) % beatsPerBar === 0;
		playOneShotMetronomeClick(isAccentTap, metronomeVolume * 0.85);

		const calculated = calculateTapBpm(nextHistory, MIN_BPM, MAX_BPM);
		if (calculated !== null) {
			updateSongMetadata({ bpm: calculated });
		}
	}, [beatsPerBar, metronomeAccent, metronomeVolume, updateSongMetadata]);

	useEffect(() => {
		if (!isOpen) {
			return;
		}
		const handleKeyDown = (event: KeyboardEvent): void => {
			const target = event.target as HTMLElement | null;
			const tagName = target?.tagName.toLowerCase();
			if (tagName === "input" || tagName === "textarea" || tagName === "select") {
				return;
			}
			if (
				!event.ctrlKey &&
				!event.metaKey &&
				!event.altKey &&
				event.key.toLowerCase() === "t"
			) {
				event.preventDefault();
				handleTapTempo();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return (): void => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [isOpen, handleTapTempo]);

	const toggleStandaloneMetronome = (): void => {
		if (isStandaloneRunning) {
			standaloneMetronome.stop();
			return;
		}
		if (isPlaying) {
			setIsPlaying(false);
		}
		standaloneMetronome.start(
			song.bpm,
			beatsPerBar,
			metronomeVolume,
			metronomeAccent
		);
	};

	const activeBeatIndex = isPlaying
		? Math.floor(playbackStep / Math.max(1, song.stepsPerBeat)) % beatsPerBar
		: standaloneBeat;

	const resetTapHistory = (): void => {
		tapHistoryRef.current = [];
		setTapCount(0);
		if (tapResetTimerRef.current !== null) {
			window.clearTimeout(tapResetTimerRef.current);
			tapResetTimerRef.current = null;
		}
	};

	const applyBpm = (nextBpm: number): void => {
		updateSongMetadata({ bpm: clampBpm(nextBpm) });
	};

	return (
		<dialog
			ref={dialogRef}
			aria-labelledby={titleId}
			className="settings-dialog m-auto max-h-[min(90dvh,46rem)] w-[min(94vw,40rem)] flex-col overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900 p-0 text-slate-100 shadow-2xl open:flex"
			{...({ closedby: "any" } as Record<string, string>)}
		>
			<div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
				<div className="flex items-center gap-2.5">
					<span
						aria-hidden="true"
						className="flex size-8 items-center justify-center rounded-lg border border-cyan-500/40 bg-cyan-500/15 text-cyan-300"
					>
						<ClockIcon className="size-4" />
					</span>
					<div>
						<h2 className="text-base font-bold text-white" id={titleId}>
							Metronome &amp; BPM Guide
						</h2>
						<p className="text-xs text-slate-400">
							Audition your beat, tap a rhythm to find its BPM, or pick a genre
							tempo.
						</p>
					</div>
				</div>
				<form method="dialog">
					<button
						autoFocus
						aria-label="Close metronome dialog"
						className="flex size-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:text-white"
						type="submit"
						value="close"
					>
						<XMarkIcon aria-hidden="true" className="size-4" />
					</button>
				</form>
			</div>

			<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
				{/* Live BPM & Beat Indicator + Standalone / Tap Actions */}
				<div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3.5">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div>
							<span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
								Current Song Tempo
							</span>
							<div className="flex items-baseline gap-2">
								<span className="font-mono text-3xl font-bold text-white">
									{Math.round(song.bpm)}
								</span>
								<span className="font-mono text-xs font-bold text-cyan-300">
									BPM · {beatsPerBar}/4
								</span>
							</div>
						</div>

						{/* Visual Beat LEDs */}
						<div
							aria-label={`Beat indicator (${beatsPerBar} beats per bar)`}
							className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2"
						>
							{Array.from({ length: beatsPerBar }, (_, beatIndex) => {
								const isLit = activeBeatIndex === beatIndex;
								const isAccentBeat = beatIndex === 0;
								return (
									<span
										key={beatIndex}
										className={`flex size-5 items-center justify-center rounded-full border font-mono text-[10px] font-bold transition ${
											isLit
												? isAccentBeat
													? "scale-110 border-amber-300 bg-amber-400 text-slate-950 shadow-[0_0_10px_rgba(251,191,36,0.7)]"
													: "scale-110 border-cyan-300 bg-cyan-400 text-slate-950 shadow-[0_0_10px_rgba(34,211,238,0.65)]"
												: "border-slate-700 bg-slate-950 text-slate-500"
										}`}
									>
										{beatIndex + 1}
									</span>
								);
							})}
						</div>
					</div>

					<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
						<button
							aria-pressed={isStandaloneRunning}
							type="button"
							className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-bold transition ${
								isStandaloneRunning
									? "border-rose-400/70 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30"
									: "border-cyan-400/60 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/25"
							}`}
							onClick={toggleStandaloneMetronome}
						>
							{isStandaloneRunning ? (
								<>
									<StopIcon aria-hidden="true" className="size-4" />
									<span>Stop Click Track</span>
								</>
							) : (
								<>
									<PlayIcon aria-hidden="true" className="size-4" />
									<span>
										{isPlaying ? "Audition Click Solo" : "Play Click Track"}
									</span>
								</>
							)}
						</button>

						<div className="flex gap-1.5">
							<button
								aria-label="Tap tempo along with your beat (shortcut T)"
								className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-amber-400/60 bg-amber-500/15 px-3 text-xs font-bold text-amber-100 transition hover:bg-amber-500/25 active:scale-[0.98]"
								type="button"
								onClick={handleTapTempo}
							>
								<HandRaisedIcon aria-hidden="true" className="size-4" />
								<span>
									{tapCount > 0 ? `Tap Tempo (${tapCount})` : "Tap Tempo (T)"}
								</span>
							</button>
							{tapCount > 0 && (
								<button
									aria-label="Reset tap tempo count"
									className="inline-flex h-10 items-center rounded-lg border border-slate-700 bg-slate-900 px-2.5 text-[11px] font-semibold text-slate-300 hover:border-slate-500 hover:text-white"
									type="button"
									onClick={resetTapHistory}
								>
									Reset
								</button>
							)}
						</div>
					</div>

					{/* Fine BPM Slider & Nudge Buttons */}
					<div className="flex flex-col gap-2 border-t border-slate-800/80 pt-2.5">
						<SliderControl
							inline
							formatValue={(value): string => `${Math.round(value)} BPM`}
							label="Tempo"
							max={MAX_BPM}
							min={MIN_BPM}
							step={1}
							value={song.bpm}
							onChange={applyBpm}
						/>
						<div className="flex flex-wrap items-center justify-between gap-1.5">
							<div
								aria-label="Tempo nudge buttons"
								className="flex flex-wrap items-center gap-1"
								role="group"
							>
								{[
									{ label: "-5", next: song.bpm - 5 },
									{ label: "-1", next: song.bpm - 1 },
									{ label: "+1", next: song.bpm + 1 },
									{ label: "+5", next: song.bpm + 5 },
									{ label: "÷2", next: song.bpm / 2 },
									{ label: "×2", next: song.bpm * 2 },
								].map((action) => (
									<button
										key={action.label}
										className="h-7 rounded border border-slate-700 bg-slate-900 px-2 font-mono text-[11px] font-bold text-slate-200 transition hover:border-cyan-400/60 hover:text-cyan-200"
										type="button"
										onClick={(): void => {
											applyBpm(action.next);
										}}
									>
										{action.label}
									</button>
								))}
							</div>
							<span className="text-[11px] text-slate-400">
								Range: {MIN_BPM}–{MAX_BPM} BPM
							</span>
						</div>
					</div>
				</div>

				{/* Playback Click Settings */}
				<section
					aria-label="Click track behavior"
					className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3"
				>
					<h3 className="text-xs font-bold tracking-wider text-slate-300 uppercase">
						Click Track Settings
					</h3>
					<div className="flex items-center justify-between gap-3 rounded-lg px-1 py-1">
						<label
							className="min-w-0 flex-1 cursor-pointer"
							htmlFor={playbackClickId}
						>
							<span className="block text-xs font-semibold text-slate-100">
								Play metronome click during song playback
							</span>
							<span className="block text-[10px] text-slate-400">
								Keeps the beat audible while composing (never included in WAV
								exports).
							</span>
						</label>
						<input
							checked={metronomeEnabled}
							className="settings-switch"
							id={playbackClickId}
							role="switch"
							type="checkbox"
							onChange={(event): void => {
								setMetronomeEnabled(event.target.checked);
							}}
						/>
					</div>

					<div className="flex items-center justify-between gap-3 rounded-lg px-1 py-1">
						<label
							className="min-w-0 flex-1 cursor-pointer"
							htmlFor={accentSwitchId}
						>
							<span className="block text-xs font-semibold text-slate-100">
								Accent Beat 1
							</span>
							<span className="block text-[10px] text-slate-400">
								Plays a higher pitched woodblock tick on the downbeat of each
								bar.
							</span>
						</label>
						<input
							checked={metronomeAccent}
							className="settings-switch"
							id={accentSwitchId}
							role="switch"
							type="checkbox"
							onChange={(event): void => {
								setMetronomeAccent(event.target.checked);
							}}
						/>
					</div>

					<div className="px-1 pt-1">
						<SliderControl
							inline
							formatValue={(value): string => `${Math.round(value * 100)}%`}
							label="Click Volume"
							max={1}
							min={0.1}
							step={0.05}
							value={metronomeVolume}
							onChange={setMetronomeVolume}
						/>
					</div>
				</section>

				{/* Genre BPM Presets */}
				<section aria-label="Genre tempo reference">
					<div className="mb-2 flex items-baseline justify-between gap-2">
						<h3 className="text-xs font-bold tracking-wider text-slate-300 uppercase">
							Genre Tempo Guide
						</h3>
						<span className="text-[10px] text-slate-400">
							Click a genre to set its standard BPM
						</span>
					</div>
					<div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
						{GENRE_BPM_PRESETS.map((preset) => {
							const isCurrentRange =
								song.bpm >= preset.minBpm && song.bpm <= preset.maxBpm;
							const isExactBpm = Math.round(song.bpm) === preset.bpm;
							return (
								<button
									key={preset.id}
									aria-pressed={isExactBpm}
									type="button"
									className={`flex flex-col items-start rounded-lg border px-2.5 py-2 text-left transition ${
										isExactBpm
											? "border-cyan-400 bg-cyan-500/20 text-white"
											: isCurrentRange
												? "border-cyan-500/50 bg-cyan-500/10 text-slate-100 hover:border-cyan-400"
												: "border-slate-800 bg-slate-950/70 text-slate-300 hover:border-slate-600 hover:text-white"
									}`}
									onClick={(): void => {
										applyBpm(preset.bpm);
									}}
								>
									<span className="text-xs font-bold">{preset.label}</span>
									<span className="mt-0.5 flex w-full items-center justify-between font-mono text-[10px]">
										<span className="font-bold text-cyan-300">
											{preset.bpm} BPM
										</span>
										<span className="text-slate-500">{preset.range}</span>
									</span>
								</button>
							);
						})}
					</div>
				</section>
			</div>
		</dialog>
	);
};

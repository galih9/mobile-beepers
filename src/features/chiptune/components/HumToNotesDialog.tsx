import {
	CheckIcon,
	MicrophoneIcon,
	PlayIcon,
	StopIcon,
	TrashIcon,
	XMarkIcon,
} from "@heroicons/react/24/outline";
import {
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import type { FunctionComponent } from "../../../common/types";
import { playPreviewNote } from "../audio/channelPreview";
import {
	DEFAULT_MIN_CLARITY,
	DEFAULT_MIN_RMS,
	type HumPitchFrame,
	type HumQuantizeGrid,
	type LivePitchReading,
	quantizeHumFramesToNotes,
} from "../audio/humToNotes";
import { playOneShotMetronomeClick } from "../audio/metronome";
import { MicrophonePitchTracker } from "../audio/microphonePitchTracker";
import { midiToNoteName, SCALE_DEFINITIONS } from "../constants/scalesAndNotes";
import type { RecordedNotesInsertMode } from "../store/songHelpers";
import { useChiptuneStore } from "../store/useChiptuneStore";
import { SliderControl } from "./SliderControl";

type CapturePhase = "idle" | "monitoring" | "countIn" | "recording";

interface BeatProgressState {
	barNumber: number;
	beatNumber: number;
	progressPercent: number;
}

interface HumToNotesDialogProps {
	isOpen: boolean;
	onClose: () => void;
}

const EMPTY_READING: LivePitchReading = {
	frequencyHz: 0,
	clarity: 0,
	rms: 0,
	midi: null,
	noteName: null,
	centsOffset: 0,
};

const BAR_COUNT_OPTIONS = [1, 2, 4];
const QUANTIZE_OPTIONS: Array<{ value: HumQuantizeGrid; label: string }> = [
	{ value: 1, label: "1/16" },
	{ value: 2, label: "1/8" },
	{ value: 4, label: "1/4" },
];
const OCTAVE_OPTIONS = [-2, -1, 0, 1, 2];

/**
 * Humming-to-Notes studio modal powered by Pitchy (McLeod Pitch Method).
 * Captures microphone pitch synced to the song tempo, quantizes into scale-aware
 * notes, auditions them on the target instrument, and inserts with single-step undo.
 */
export const HumToNotesDialog = ({
	isOpen,
	onClose,
}: HumToNotesDialogProps): FunctionComponent => {
	const titleId = useId();
	const channelSelectId = useId();
	const startBarSelectId = useId();
	const countInSwitchId = useId();
	const clickSwitchId = useId();
	const snapScaleSwitchId = useId();

	const dialogRef = useRef<HTMLDialogElement | null>(null);
	const trackerRef = useRef<MicrophonePitchTracker | null>(null);
	const phaseRef = useRef<CapturePhase>("idle");
	const recordStartMsRef = useRef<number>(0);
	const framesRef = useRef<Array<HumPitchFrame>>([]);
	const captureTimerRef = useRef<number | null>(null);
	const previewTimersRef = useRef<Array<number>>([]);

	const song = useChiptuneStore((state) => state.song);
	const selectedChannelIndex = useChiptuneStore(
		(state) => state.selectedChannelIndex
	);
	const selectedBarIndex = useChiptuneStore((state) => state.selectedBarIndex);
	const isPlaying = useChiptuneStore((state) => state.isPlaying);
	const setIsPlaying = useChiptuneStore((state) => state.setIsPlaying);
	const metronomeVolume = useChiptuneStore((state) => state.metronomeVolume);
	const metronomeAccent = useChiptuneStore((state) => state.metronomeAccent);
	const addChannel = useChiptuneStore((state) => state.addChannel);
	const applyRecordedNotesToChannel = useChiptuneStore(
		(state) => state.applyRecordedNotesToChannel
	);

	const pitchChannels = useMemo(
		() =>
			song.channels
				.map((channel, index) => ({ channel, index }))
				.filter((entry) => entry.channel.type === "pitch"),
		[song.channels]
	);

	const [targetChannelOverride, setTargetChannelOverride] = useState<
		number | null
	>(null);
	const [startBarOverride, setStartBarOverride] = useState<number | null>(null);
	const [barCount, setBarCount] = useState<number>(2);

	const defaultChannelIndex =
		song.channels[selectedChannelIndex]?.type === "pitch"
			? selectedChannelIndex
			: (pitchChannels[0]?.index ?? 0);
	const targetChannelIndex =
		targetChannelOverride !== null &&
		song.channels[targetChannelOverride]?.type === "pitch"
			? targetChannelOverride
			: defaultChannelIndex;
	const startBarIndex =
		startBarOverride !== null && startBarOverride < song.totalBars
			? startBarOverride
			: selectedBarIndex;
	const [countInEnabled, setCountInEnabled] = useState<boolean>(true);
	const [clickEnabled, setClickEnabled] = useState<boolean>(true);
	const [minimumRms, setMinimumRms] = useState<number>(DEFAULT_MIN_RMS);
	const [snapToScale, setSnapToScale] = useState<boolean>(true);
	const [quantizeSteps, setQuantizeSteps] = useState<HumQuantizeGrid>(2);
	const [octaveShift, setOctaveShift] = useState<number>(0);
	const [insertMode, setInsertMode] =
		useState<RecordedNotesInsertMode>("replace");

	const [phase, setPhase] = useState<CapturePhase>("idle");
	const [liveReading, setLiveReading] =
		useState<LivePitchReading>(EMPTY_READING);
	const [recordedFrames, setRecordedFrames] = useState<Array<HumPitchFrame>>(
		[]
	);
	const [beatProgress, setBeatProgress] = useState<BeatProgressState>({
		barNumber: 1,
		beatNumber: 1,
		progressPercent: 0,
	});
	const [statusMessage, setStatusMessage] = useState<string>(
		"Ready — test your microphone or press Record Hum to sing a melody."
	);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [isPreviewing, setIsPreviewing] = useState<boolean>(false);
	const [activePreviewIndex, setActivePreviewIndex] = useState<number | null>(
		null
	);

	const clearCaptureTimer = useCallback((): void => {
		if (captureTimerRef.current !== null) {
			window.clearInterval(captureTimerRef.current);
			captureTimerRef.current = null;
		}
	}, []);

	const stopPreviewPlayback = useCallback((): void => {
		previewTimersRef.current.forEach((timerId) => {
			window.clearTimeout(timerId);
		});
		previewTimersRef.current = [];
		setIsPreviewing(false);
		setActivePreviewIndex(null);
	}, []);

	const stopAllCapture = useCallback((): void => {
		clearCaptureTimer();
		phaseRef.current = "idle";
		setPhase("idle");
		trackerRef.current?.stop();
		setLiveReading(EMPTY_READING);
	}, [clearCaptureTimer]);

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
			stopAllCapture();
			stopPreviewPlayback();
			setTargetChannelOverride(null);
			setStartBarOverride(null);
			setErrorMessage(null);
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
	}, [onClose, stopAllCapture, stopPreviewPlayback]);

	useEffect(() => {
		trackerRef.current = new MicrophonePitchTracker();
		return (): void => {
			clearCaptureTimer();
			stopPreviewPlayback();
			trackerRef.current?.stop();
			trackerRef.current = null;
		};
	}, [clearCaptureTimer, stopPreviewPlayback]);

	useEffect(() => {
		trackerRef.current?.updateThresholds(DEFAULT_MIN_CLARITY, minimumRms);
	}, [minimumRms]);

	const quantized = useMemo(
		() =>
			quantizeHumFramesToNotes(recordedFrames, {
				bpm: song.bpm,
				beatsPerBar: song.beatsPerBar,
				stepsPerBeat: song.stepsPerBeat,
				barCount,
				rootKey: song.rootKey,
				scale: song.scale,
				snapToScale,
				quantizeSteps,
				octaveShift,
				minimumClarity: DEFAULT_MIN_CLARITY,
				minimumRms,
			}),
		[
			barCount,
			minimumRms,
			octaveShift,
			quantizeSteps,
			recordedFrames,
			snapToScale,
			song.beatsPerBar,
			song.bpm,
			song.rootKey,
			song.scale,
			song.stepsPerBeat,
		]
	);

	const handlePitchReading = useCallback(
		(reading: LivePitchReading, timestampMs: number): void => {
			setLiveReading(reading);
			if (phaseRef.current === "recording") {
				framesRef.current.push({
					timeMs: Math.max(0, timestampMs - recordStartMsRef.current),
					frequencyHz: reading.frequencyHz,
					clarity: reading.clarity,
					rms: reading.rms,
				});
			}
		},
		[]
	);

	const startMicMonitoring = async (): Promise<void> => {
		if (!trackerRef.current) {
			return;
		}
		if (phase !== "idle") {
			stopAllCapture();
			setStatusMessage("Microphone stopped.");
			return;
		}
		stopPreviewPlayback();
		setErrorMessage(null);
		try {
			await trackerRef.current.start(handlePitchReading, {
				minimumClarity: DEFAULT_MIN_CLARITY,
				minimumRms,
			});
			phaseRef.current = "monitoring";
			setPhase("monitoring");
			setStatusMessage(
				"Mic active — hum a note to check pitch detection and noise gate."
			);
		} catch (error: unknown) {
			setErrorMessage(
				error instanceof Error
					? error.message
					: "Unable to start microphone."
			);
		}
	};

	const finishRecordingTake = useCallback((): void => {
		const captured = [...framesRef.current];
		stopAllCapture();
		setRecordedFrames(captured);
		const result = quantizeHumFramesToNotes(captured, {
			bpm: song.bpm,
			beatsPerBar: song.beatsPerBar,
			stepsPerBeat: song.stepsPerBeat,
			barCount,
			rootKey: song.rootKey,
			scale: song.scale,
			snapToScale,
			quantizeSteps,
			octaveShift,
			minimumClarity: DEFAULT_MIN_CLARITY,
			minimumRms,
		});
		const count = result.flatNotes.length;
		setStatusMessage(
			count > 0
				? `Captured ${count} note${count === 1 ? "" : "s"} across ${barCount} bar${barCount === 1 ? "" : "s"}. Adjust grid/scale or preview below.`
				: "No clear pitches detected — try humming louder or lowering the noise gate."
		);
	}, [
		barCount,
		minimumRms,
		octaveShift,
		quantizeSteps,
		snapToScale,
		song.beatsPerBar,
		song.bpm,
		song.rootKey,
		song.scale,
		song.stepsPerBeat,
		stopAllCapture,
	]);

	const startRecordingTake = async (): Promise<void> => {
		if (!trackerRef.current) {
			return;
		}
		if (phase === "countIn" || phase === "recording") {
			finishRecordingTake();
			return;
		}

		stopPreviewPlayback();
		if (isPlaying) {
			setIsPlaying(false);
		}
		setErrorMessage(null);
		clearCaptureTimer();
		framesRef.current = [];
		setRecordedFrames([]);

		if (!trackerRef.current.getIsActive()) {
			try {
				await trackerRef.current.start(handlePitchReading, {
					minimumClarity: DEFAULT_MIN_CLARITY,
					minimumRms,
				});
			} catch (error: unknown) {
				setErrorMessage(
					error instanceof Error
						? error.message
						: "Unable to start microphone."
				);
				return;
			}
		}

		const beatsPerBar = Math.max(1, song.beatsPerBar);
		const beatDurationMs = (60 / Math.max(30, song.bpm)) * 1000;
		const countInBeats = countInEnabled ? beatsPerBar : 0;
		const countInDurationMs = countInBeats * beatDurationMs;
		const totalRecordBeats = barCount * beatsPerBar;
		const totalRecordMs = totalRecordBeats * beatDurationMs;
		const sessionStartMs = performance.now();

		let lastCountInBeat = -1;
		let lastRecordBeat = -1;

		if (countInEnabled) {
			phaseRef.current = "countIn";
			setPhase("countIn");
			setBeatProgress({
				barNumber: 1,
				beatNumber: 1,
				progressPercent: 0,
			});
			setStatusMessage(`Count-in: Beat 1 of ${beatsPerBar}`);
			if (clickEnabled) {
				playOneShotMetronomeClick(metronomeAccent, metronomeVolume);
			}
			lastCountInBeat = 0;
		} else {
			recordStartMsRef.current = sessionStartMs;
			phaseRef.current = "recording";
			setPhase("recording");
			setBeatProgress({
				barNumber: 1,
				beatNumber: 1,
				progressPercent: 0,
			});
			setStatusMessage(`Recording Bar 1 of ${barCount}…`);
			if (clickEnabled) {
				playOneShotMetronomeClick(metronomeAccent, metronomeVolume);
			}
			lastRecordBeat = 0;
		}

		captureTimerRef.current = window.setInterval(() => {
			const elapsed = performance.now() - sessionStartMs;
			if (elapsed < countInDurationMs) {
				const currentBeat = Math.min(
					countInBeats - 1,
					Math.floor(elapsed / beatDurationMs)
				);
				if (currentBeat > lastCountInBeat) {
					lastCountInBeat = currentBeat;
					if (clickEnabled) {
						playOneShotMetronomeClick(
							metronomeAccent && currentBeat === 0,
							metronomeVolume
						);
					}
					setStatusMessage(`Count-in: Beat ${currentBeat + 1} of ${beatsPerBar}`);
				}
				setBeatProgress({
					barNumber: 1,
					beatNumber: currentBeat + 1,
					progressPercent: Math.round((elapsed / countInDurationMs) * 100),
				});
				return;
			}

			const recordElapsed = elapsed - countInDurationMs;
			if (phaseRef.current !== "recording") {
				recordStartMsRef.current = sessionStartMs + countInDurationMs;
				phaseRef.current = "recording";
				setPhase("recording");
			}

			if (recordElapsed >= totalRecordMs) {
				finishRecordingTake();
				return;
			}

			const currentRecordBeat = Math.min(
				totalRecordBeats - 1,
				Math.floor(recordElapsed / beatDurationMs)
			);
			const barNumber = Math.floor(currentRecordBeat / beatsPerBar) + 1;
			const beatNumber = (currentRecordBeat % beatsPerBar) + 1;

			if (currentRecordBeat > lastRecordBeat) {
				lastRecordBeat = currentRecordBeat;
				if (clickEnabled) {
					playOneShotMetronomeClick(
						metronomeAccent && beatNumber === 1,
						metronomeVolume
					);
				}
				setStatusMessage(
					`Recording Bar ${barNumber} of ${barCount} (Beat ${beatNumber})…`
				);
			}

			setBeatProgress({
				barNumber,
				beatNumber,
				progressPercent: Math.min(
					100,
					Math.round((recordElapsed / totalRecordMs) * 100)
				),
			});
		}, 25);
	};

	const targetChannel =
		song.channels[targetChannelIndex] ?? pitchChannels[0]?.channel;

	const handlePreviewTake = (): void => {
		if (isPreviewing) {
			stopPreviewPlayback();
			return;
		}
		if (!targetChannel || quantized.flatNotes.length === 0) {
			return;
		}
		if (isPlaying) {
			setIsPlaying(false);
		}
		stopPreviewPlayback();

		const stepSeconds = 60 / Math.max(30, song.bpm) / Math.max(1, song.stepsPerBeat);
		const sortedNotes = quantized.flatNotes;
		const firstStep = sortedNotes[0]?.globalStep ?? 0;
		setIsPreviewing(true);

		let lastEndMs = 0;
		const timers: Array<number> = [];

		sortedNotes.forEach((note, index) => {
			const delayMs = Math.max(
				0,
				Math.round((note.globalStep - firstStep) * stepSeconds * 1000)
			);
			const endMs = delayMs + Math.round(note.duration * stepSeconds * 1000);
			lastEndMs = Math.max(lastEndMs, endMs);

			const timerId = window.setTimeout(() => {
				setActivePreviewIndex(index);
				playPreviewNote(
					note.pitch,
					targetChannel,
					{
						duration: note.duration,
						velocity: note.velocity,
					},
					stepSeconds
				);
			}, delayMs);
			timers.push(timerId);
		});

		const finishTimer = window.setTimeout(() => {
			stopPreviewPlayback();
		}, lastEndMs + 160);
		timers.push(finishTimer);
		previewTimersRef.current = timers;
	};

	const handleClearTake = (): void => {
		stopPreviewPlayback();
		framesRef.current = [];
		setRecordedFrames([]);
		setStatusMessage("Cleared captured take. Ready to record again.");
	};

	const handleApplyToTrack = (): void => {
		if (!targetChannel || quantized.flatNotes.length === 0) {
			return;
		}
		stopAllCapture();
		stopPreviewPlayback();
		applyRecordedNotesToChannel({
			channelIndex: targetChannelIndex,
			startBarIndex,
			notesByBar: quantized.notesByBar,
			mode: insertMode,
		});
		dialogRef.current?.close();
	};

	const scaleLabel = SCALE_DEFINITIONS[song.scale]?.label ?? song.scale;
	const rmsPercent = Math.min(100, Math.round((liveReading.rms / 0.16) * 100));
	const gatePercent = Math.min(100, Math.round((minimumRms / 0.16) * 100));
	const centsPosition = Math.max(
		0,
		Math.min(100, 50 + liveReading.centsOffset)
	);
	const totalPreviewSteps =
		barCount * Math.max(1, song.beatsPerBar) * Math.max(1, song.stepsPerBeat);

	const previewPitchBounds = useMemo(() => {
		if (quantized.flatNotes.length === 0) {
			return { minPitch: 48, maxPitch: 72 };
		}
		const pitches = quantized.flatNotes.map((note) => note.pitch);
		const minPitch = Math.min(...pitches) - 2;
		const maxPitch = Math.max(...pitches) + 2;
		return {
			minPitch,
			maxPitch: Math.max(minPitch + 6, maxPitch),
		};
	}, [quantized.flatNotes]);

	const isCapturing = phase === "countIn" || phase === "recording";

	return (
		<dialog
			ref={dialogRef}
			aria-labelledby={titleId}
			className="settings-dialog m-auto max-h-[min(92dvh,50rem)] w-[min(95vw,44rem)] flex-col overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900 p-0 text-slate-100 shadow-2xl open:flex"
			{...({ closedby: "any" } as Record<string, string>)}
		>
			<div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
				<div className="flex items-center gap-2.5">
					<span
						aria-hidden="true"
						className="flex size-8 items-center justify-center rounded-lg border border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-300"
					>
						<MicrophoneIcon className="size-4" />
					</span>
					<div>
						<h2 className="text-base font-bold text-white" id={titleId}>
							Hum to Notes
						</h2>
						<p className="text-xs text-slate-400">
							{Math.round(song.bpm)} BPM · {song.rootKey}{" "}
							{scaleLabel.toLowerCase()} · powered by Pitchy
						</p>
					</div>
				</div>
				<form method="dialog">
					<button
						autoFocus
						aria-label="Close Hum to Notes"
						className="flex size-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:text-white"
						type="submit"
						value="close"
					>
						<XMarkIcon aria-hidden="true" className="size-4" />
					</button>
				</form>
			</div>

			<div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto p-4">
				{/* Target Channel & Capture Settings */}
				<section
					aria-label="Recording target and capture options"
					className="flex flex-col gap-2.5 rounded-xl border border-slate-800 bg-slate-950/60 p-3"
				>
					{pitchChannels.length === 0 ? (
						<div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5">
							<p className="text-xs text-amber-100">
								Your song currently has no melodic instrument track.
							</p>
							<button
								className="rounded-lg border border-cyan-400/60 bg-cyan-500/20 px-2.5 py-1 text-xs font-bold text-cyan-100 hover:bg-cyan-500/30"
								type="button"
								onClick={(): void => {
									addChannel("pitch");
								}}
							>
								+ Add Instrument Track
							</button>
						</div>
					) : (
						<div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
							<div className="flex flex-col gap-1">
								<label
									className="text-[11px] font-semibold text-slate-300"
									htmlFor={channelSelectId}
								>
									Target Track
								</label>
								<select
									className="h-8 rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs font-semibold text-white"
									disabled={isCapturing}
									id={channelSelectId}
									value={targetChannelIndex}
									onChange={(event): void => {
										setTargetChannelOverride(Number(event.target.value));
									}}
								>
									{pitchChannels.map((entry) => (
										<option key={entry.channel.id} value={entry.index}>
											{entry.channel.name}
										</option>
									))}
								</select>
							</div>

							<div className="flex flex-col gap-1">
								<label
									className="text-[11px] font-semibold text-slate-300"
									htmlFor={startBarSelectId}
								>
									Start Bar
								</label>
								<select
									className="h-8 rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs font-semibold text-white"
									disabled={isCapturing}
									id={startBarSelectId}
									value={startBarIndex}
									onChange={(event): void => {
										setStartBarOverride(Number(event.target.value));
									}}
								>
									{Array.from({ length: song.totalBars }, (_, barIndex) => (
										<option key={barIndex} value={barIndex}>
											Bar {barIndex + 1}
										</option>
									))}
								</select>
							</div>

							<div className="flex flex-col gap-1">
								<span className="text-[11px] font-semibold text-slate-300">
									Capture Length
								</span>
								<div
									aria-label="Capture length in bars"
									className="grid h-8 grid-cols-3 gap-1 rounded-lg border border-slate-800 bg-slate-900 p-0.5"
									role="group"
								>
									{BAR_COUNT_OPTIONS.map((count) => (
										<button
											key={count}
											aria-pressed={barCount === count}
											disabled={isCapturing}
											type="button"
											className={`rounded text-[11px] font-bold transition ${
												barCount === count
													? "bg-fuchsia-500/30 text-fuchsia-100"
													: "text-slate-400 hover:text-white"
											}`}
											onClick={(): void => {
												setBarCount(count);
											}}
										>
											{count} Bar{count > 1 ? "s" : ""}
										</button>
									))}
								</div>
							</div>
						</div>
					)}

					<div className="grid grid-cols-1 gap-2 border-t border-slate-800/70 pt-2 sm:grid-cols-2">
						<div className="flex items-center justify-between gap-2">
							<label
								className="cursor-pointer text-xs font-semibold text-slate-200"
								htmlFor={countInSwitchId}
							>
								1-Bar Count-in
							</label>
							<input
								checked={countInEnabled}
								className="settings-switch"
								disabled={isCapturing}
								id={countInSwitchId}
								role="switch"
								type="checkbox"
								onChange={(event): void => {
									setCountInEnabled(event.target.checked);
								}}
							/>
						</div>

						<div className="flex items-center justify-between gap-2">
							<label
								className="min-w-0 cursor-pointer"
								htmlFor={clickSwitchId}
							>
								<span className="block text-xs font-semibold text-slate-200">
									Metronome Click
								</span>
								<span className="block text-[10px] text-slate-400">
									Headphones recommended with click on
								</span>
							</label>
							<input
								checked={clickEnabled}
								className="settings-switch"
								disabled={isCapturing}
								id={clickSwitchId}
								role="switch"
								type="checkbox"
								onChange={(event): void => {
									setClickEnabled(event.target.checked);
								}}
							/>
						</div>
					</div>
				</section>

				{/* Live Pitch Tuner & Microphone Controls */}
				<section
					aria-label="Live pitch detector"
					className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/80 p-3.5"
				>
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div className="flex items-center gap-3">
							<div
								aria-hidden="true"
								className={`flex h-14 w-16 flex-col items-center justify-center rounded-xl border font-mono ${
									liveReading.noteName
										? "border-cyan-400/70 bg-cyan-500/15 text-cyan-100"
										: "border-slate-800 bg-slate-900 text-slate-500"
								}`}
							>
								<span className="text-xl leading-none font-bold">
									{liveReading.noteName ?? "—"}
								</span>
								<span className="mt-1 text-[10px]">
									{liveReading.midi !== null
										? `${Math.round(liveReading.frequencyHz)} Hz`
										: "Silent"}
								</span>
							</div>

							<div className="flex min-w-36 flex-col gap-1.5">
								{/* Cents Tuning Meter */}
								<div className="flex items-center justify-between text-[10px] font-semibold text-slate-400">
									<span>Flat</span>
									<span className="font-mono text-slate-300">
										{liveReading.midi !== null
											? `${liveReading.centsOffset > 0 ? "+" : ""}${liveReading.centsOffset}c`
											: "Tune"}
									</span>
									<span>Sharp</span>
								</div>
								<div className="relative h-2 w-40 overflow-hidden rounded-full bg-slate-800">
									<div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-slate-600" />
									{liveReading.midi !== null && (
										<div
											className="absolute top-0 bottom-0 w-2 -translate-x-1/2 rounded-full bg-cyan-400 transition-[left] duration-75"
											style={{ left: `${centsPosition}%` }}
										/>
									)}
								</div>

								{/* Input Level Meter + Gate Marker */}
								<div className="relative h-1.5 w-40 overflow-hidden rounded-full bg-slate-800">
									<div
										style={{ width: `${rmsPercent}%` }}
										className={`h-full transition-[width] duration-75 ${
											liveReading.rms >= minimumRms
												? "bg-emerald-400"
												: "bg-slate-500"
										}`}
									/>
									<div
										aria-hidden="true"
										className="absolute inset-y-0 w-0.5 bg-amber-400"
										style={{ left: `${gatePercent}%` }}
									/>
								</div>
							</div>
						</div>

						<div className="flex flex-wrap items-center gap-2">
							<button
								aria-pressed={phase === "monitoring"}
								disabled={isCapturing}
								type="button"
								className={`inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition disabled:opacity-40 ${
									phase === "monitoring"
										? "border-cyan-400 bg-cyan-500/20 text-cyan-100"
										: "border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500"
								}`}
								onClick={(): void => {
									void startMicMonitoring();
								}}
							>
								<MicrophoneIcon aria-hidden="true" className="size-4" />
								<span>{phase === "monitoring" ? "Stop Mic" : "Test Mic"}</span>
							</button>

							<button
								aria-pressed={isCapturing}
								disabled={pitchChannels.length === 0}
								type="button"
								className={`inline-flex h-10 items-center gap-1.5 rounded-lg border px-4 text-xs font-bold transition disabled:opacity-40 ${
									isCapturing
										? "border-rose-400 bg-rose-500/25 text-rose-100 hover:bg-rose-500/35"
										: "border-fuchsia-400/70 bg-fuchsia-500/25 text-fuchsia-100 hover:bg-fuchsia-500/35"
								}`}
								onClick={(): void => {
									void startRecordingTake();
								}}
							>
								{isCapturing ? (
									<>
										<StopIcon aria-hidden="true" className="size-4" />
										<span>Stop Capture</span>
									</>
								) : (
									<>
										<MicrophoneIcon aria-hidden="true" className="size-4" />
										<span>Record Hum</span>
									</>
								)}
							</button>
						</div>
					</div>

					{/* Capture Progress Bar */}
					{isCapturing && (
						<div className="flex flex-col gap-1">
							<div className="flex items-center justify-between font-mono text-[11px] font-bold">
								<span
									className={
										phase === "countIn" ? "text-amber-300" : "text-fuchsia-300"
									}
								>
									{phase === "countIn"
										? `COUNT-IN · BEAT ${beatProgress.beatNumber}/${song.beatsPerBar}`
										: `REC · BAR ${beatProgress.barNumber}/${barCount} · BEAT ${beatProgress.beatNumber}`}
								</span>
								<span className="text-slate-400">
									{beatProgress.progressPercent}%
								</span>
							</div>
							<div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
								<div
									style={{ width: `${beatProgress.progressPercent}%` }}
									className={`h-full transition-[width] duration-75 ${
										phase === "countIn" ? "bg-amber-400" : "bg-fuchsia-400"
									}`}
								/>
							</div>
						</div>
					)}

					<SliderControl
						inline
						formatValue={(value): string => `${Math.round(value * 1000)}`}
						label="Noise Gate"
						max={0.06}
						min={0.005}
						step={0.002}
						value={minimumRms}
						onChange={setMinimumRms}
					/>

					{/* Discrete Status Announcement */}
					<p
						aria-live="polite"
						className="rounded-lg border border-slate-800/80 bg-slate-900/70 px-2.5 py-1.5 text-xs text-slate-300"
					>
						{statusMessage}
					</p>

					{errorMessage && (
						<p
							className="rounded-lg border border-rose-500/50 bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-200"
							role="alert"
						>
							{errorMessage}
						</p>
					)}
				</section>

				{/* Quantize, Preview & Commit Section */}
				<section
					aria-label="Quantize and preview captured notes"
					className="flex flex-col gap-2.5 rounded-xl border border-slate-800 bg-slate-950/60 p-3"
				>
					<div className="flex flex-wrap items-center justify-between gap-2">
						<h3 className="text-xs font-bold tracking-wider text-slate-300 uppercase">
							Quantize &amp; Preview ({quantized.flatNotes.length} notes)
						</h3>

						<div className="flex items-center gap-2">
							<label
								className="cursor-pointer text-xs font-semibold text-slate-200"
								htmlFor={snapScaleSwitchId}
							>
								Snap to {song.rootKey} {scaleLabel}
							</label>
							<input
								checked={snapToScale}
								className="settings-switch"
								id={snapScaleSwitchId}
								role="switch"
								type="checkbox"
								onChange={(event): void => {
									setSnapToScale(event.target.checked);
								}}
							/>
						</div>
					</div>

					<div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
						<div className="flex flex-col gap-1">
							<span className="text-[11px] font-semibold text-slate-400">
								Quantize Grid
							</span>
							<div
								aria-label="Quantize grid resolution"
								className="grid h-7 grid-cols-3 gap-1 rounded-lg border border-slate-800 bg-slate-900 p-0.5"
								role="group"
							>
								{QUANTIZE_OPTIONS.map((option) => (
									<button
										key={option.value}
										aria-pressed={quantizeSteps === option.value}
										type="button"
										className={`rounded font-mono text-[11px] font-bold transition ${
											quantizeSteps === option.value
												? "bg-cyan-500/25 text-cyan-200"
												: "text-slate-400 hover:text-white"
										}`}
										onClick={(): void => {
											setQuantizeSteps(option.value);
										}}
									>
										{option.label}
									</button>
								))}
							</div>
						</div>

						<div className="flex flex-col gap-1">
							<span className="text-[11px] font-semibold text-slate-400">
								Octave Shift
							</span>
							<div
								aria-label="Octave shift"
								className="grid h-7 grid-cols-5 gap-0.5 rounded-lg border border-slate-800 bg-slate-900 p-0.5"
								role="group"
							>
								{OCTAVE_OPTIONS.map((octave) => (
									<button
										key={octave}
										aria-pressed={octaveShift === octave}
										type="button"
										className={`rounded font-mono text-[10px] font-bold transition ${
											octaveShift === octave
												? "bg-violet-500/30 text-violet-100"
												: "text-slate-400 hover:text-white"
										}`}
										onClick={(): void => {
											setOctaveShift(octave);
										}}
									>
										{octave > 0 ? `+${octave}` : String(octave)}
									</button>
								))}
							</div>
						</div>

						<div className="flex flex-col gap-1">
							<span className="text-[11px] font-semibold text-slate-400">
								Insert Mode
							</span>
							<div
								aria-label="Insert mode"
								className="grid h-7 grid-cols-2 gap-1 rounded-lg border border-slate-800 bg-slate-900 p-0.5"
								role="group"
							>
								{(["replace", "merge"] as Array<RecordedNotesInsertMode>).map(
									(mode) => (
										<button
											key={mode}
											aria-pressed={insertMode === mode}
											type="button"
											className={`rounded text-[11px] font-bold capitalize transition ${
												insertMode === mode
													? "bg-emerald-500/25 text-emerald-200"
													: "text-slate-400 hover:text-white"
											}`}
											onClick={(): void => {
												setInsertMode(mode);
											}}
										>
											{mode}
										</button>
									)
								)}
							</div>
						</div>
					</div>

					{/* Mini Piano-Roll Note Preview */}
					<div className="relative h-24 overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
						{/* Bar dividers */}
						{Array.from({ length: barCount }, (_, index) => {
							if (index === 0) {
								return null;
							}
							return (
								<div
									key={index}
									aria-hidden="true"
									className="absolute inset-y-0 w-px bg-slate-700"
									style={{ left: `${(index / barCount) * 100}%` }}
								/>
							);
						})}

						{quantized.flatNotes.length === 0 ? (
							<div className="flex h-full items-center justify-center text-xs text-slate-500">
								Captured notes will appear here before inserting into your track.
							</div>
						) : (
							quantized.flatNotes.map((note, index) => {
								const pitchRange = Math.max(
									1,
									previewPitchBounds.maxPitch - previewPitchBounds.minPitch
								);
								const topPercent =
									((previewPitchBounds.maxPitch - note.pitch) / pitchRange) *
										78 +
									6;
								const leftPercent = (note.globalStep / totalPreviewSteps) * 100;
								const widthPercent = Math.max(
									2,
									(note.duration / totalPreviewSteps) * 100
								);
								const isActiveNote = activePreviewIndex === index;
								return (
									<div
										key={`${note.globalStep}-${note.pitch}-${index}`}
										className={`absolute flex h-4 items-center overflow-hidden rounded px-1 font-mono text-[9px] font-bold transition ${
											isActiveNote
												? "bg-amber-400 text-slate-950 ring-2 ring-amber-200"
												: "bg-cyan-400/80 text-slate-950"
										}`}
										style={{
											top: `${topPercent}%`,
											left: `${leftPercent}%`,
											width: `${widthPercent}%`,
										}}
									>
										<span className="truncate">
											{midiToNoteName(note.pitch)}
										</span>
									</div>
								);
							})
						)}
					</div>

					{/* Footer Actions */}
					<div className="flex flex-wrap items-center justify-between gap-2 pt-1">
						<div className="flex items-center gap-2">
							<button
								disabled={quantized.flatNotes.length === 0 || !targetChannel}
								type="button"
								className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition disabled:opacity-40 ${
									isPreviewing
										? "border-amber-400 bg-amber-500/20 text-amber-100"
										: "border-slate-700 bg-slate-900 text-slate-200 hover:border-cyan-400/60"
								}`}
								onClick={handlePreviewTake}
							>
								{isPreviewing ? (
									<>
										<StopIcon aria-hidden="true" className="size-3.5" />
										<span>Stop Preview</span>
									</>
								) : (
									<>
										<PlayIcon aria-hidden="true" className="size-3.5" />
										<span>Preview</span>
									</>
								)}
							</button>

							<button
								className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 text-xs font-semibold text-rose-200 hover:bg-rose-500/20 disabled:opacity-40"
								disabled={recordedFrames.length === 0 || isCapturing}
								type="button"
								onClick={handleClearTake}
							>
								<TrashIcon aria-hidden="true" className="size-3.5" />
								<span>Clear Take</span>
							</button>
						</div>

						<button
							className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-400/70 bg-emerald-500/25 px-4 text-xs font-bold text-emerald-100 transition hover:bg-emerald-500/35 disabled:opacity-40"
							disabled={quantized.flatNotes.length === 0 || !targetChannel}
							type="button"
							onClick={handleApplyToTrack}
						>
							<CheckIcon aria-hidden="true" className="size-4" />
							<span>Add to Track</span>
						</button>
					</div>
				</section>
			</div>
		</dialog>
	);
};

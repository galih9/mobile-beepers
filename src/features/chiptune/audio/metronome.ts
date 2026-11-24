import * as Tone from "tone";
import {
	ensureToneStarted,
	getLiveMasterInputNode,
	getOrCreateLiveAudioContext,
} from "./voiceSynthesizer";

export const MIN_BPM = 50;
export const MAX_BPM = 240;
export const TAP_TEMPO_RESET_MS = 2200;
export const TAP_TEMPO_MAX_HISTORY = 8;

export interface GenreBpmPreset {
	id: string;
	label: string;
	bpm: number;
	range: string;
	minBpm: number;
	maxBpm: number;
}

export const GENRE_BPM_PRESETS: Array<GenreBpmPreset> = [
	{
		id: "lofi",
		label: "Lo-Fi / Chill",
		bpm: 85,
		range: "75–95 BPM",
		minBpm: 75,
		maxBpm: 95,
	},
	{
		id: "hiphop",
		label: "Boom Bap / Trap",
		bpm: 95,
		range: "85–105 BPM",
		minBpm: 85,
		maxBpm: 105,
	},
	{
		id: "deep-house",
		label: "Deep House",
		bpm: 120,
		range: "118–123 BPM",
		minBpm: 118,
		maxBpm: 123,
	},
	{
		id: "classic-house",
		label: "Classic House",
		bpm: 124,
		range: "120–128 BPM",
		minBpm: 120,
		maxBpm: 128,
	},
	{
		id: "tech-house",
		label: "Tech House",
		bpm: 128,
		range: "125–130 BPM",
		minBpm: 125,
		maxBpm: 130,
	},
	{
		id: "uk-garage",
		label: "UK Garage",
		bpm: 132,
		range: "130–136 BPM",
		minBpm: 130,
		maxBpm: 136,
	},
	{
		id: "trance",
		label: "Trance / Euro",
		bpm: 138,
		range: "134–144 BPM",
		minBpm: 134,
		maxBpm: 144,
	},
	{
		id: "jungle",
		label: "Jungle",
		bpm: 165,
		range: "160–170 BPM",
		minBpm: 160,
		maxBpm: 170,
	},
	{
		id: "dnb",
		label: "Drum & Bass",
		bpm: 174,
		range: "170–178 BPM",
		minBpm: 170,
		maxBpm: 178,
	},
	{
		id: "breakcore",
		label: "Breakcore",
		bpm: 180,
		range: "170–200 BPM",
		minBpm: 170,
		maxBpm: 200,
	},
	{
		id: "gabber",
		label: "Gabber / Speedcore",
		bpm: 190,
		range: "180–210 BPM",
		minBpm: 180,
		maxBpm: 210,
	},
];

export const clampBpm = (
	bpm: number,
	minimumBpm = MIN_BPM,
	maximumBpm = MAX_BPM
): number => {
	if (!Number.isFinite(bpm)) {
		return 120;
	}
	return Math.max(minimumBpm, Math.min(maximumBpm, Math.round(bpm)));
};

/**
 * Records a new tap timestamp, resetting the rolling window after a long pause.
 */
export const recordTapTimestamp = (
	history: Array<number>,
	timestampMs: number
): Array<number> => {
	const lastTap = history[history.length - 1];
	const nextHistory =
		lastTap !== undefined && timestampMs - lastTap > TAP_TEMPO_RESET_MS
			? [timestampMs]
			: [...history, timestampMs];
	return nextHistory.slice(-TAP_TEMPO_MAX_HISTORY);
};

/**
 * Computes rounded BPM from a sequence of tap timestamps, or null if fewer than 2 taps exist.
 */
export const calculateTapBpm = (
	timestamps: Array<number>,
	minimumBpm = MIN_BPM,
	maximumBpm = MAX_BPM
): number | null => {
	if (timestamps.length < 2) {
		return null;
	}
	let totalIntervalMs = 0;
	let intervalCount = 0;
	for (let index = 1; index < timestamps.length; index += 1) {
		const previous = timestamps[index - 1];
		const current = timestamps[index];
		if (previous !== undefined && current !== undefined && current > previous) {
			totalIntervalMs += current - previous;
			intervalCount += 1;
		}
	}
	if (intervalCount === 0 || totalIntervalMs <= 0) {
		return null;
	}
	const averageIntervalMs = totalIntervalMs / intervalCount;
	return clampBpm(60_000 / averageIntervalMs, minimumBpm, maximumBpm);
};

const hasWebAudioSupport = (): boolean =>
	typeof window !== "undefined" &&
	("AudioContext" in window || "webkitAudioContext" in window);

/**
 * Schedules a crisp woodblock/clave metronome click at `time` on the given audio context.
 */
export const scheduleMetronomeClick = (
	audioContext: BaseAudioContext,
	destination: AudioNode,
	time: number,
	isAccent: boolean,
	volume: number
): void => {
	const clampedVolume = Math.max(0.05, Math.min(1, volume));
	const peakGain = clampedVolume * (isAccent ? 0.5 : 0.34);

	const bodyOscillator = audioContext.createOscillator();
	bodyOscillator.type = "sine";
	bodyOscillator.frequency.setValueAtTime(isAccent ? 1560 : 1040, time);
	bodyOscillator.frequency.exponentialRampToValueAtTime(
		isAccent ? 1120 : 780,
		time + 0.012
	);

	const bodyGain = audioContext.createGain();
	bodyGain.gain.setValueAtTime(0.0001, time);
	bodyGain.gain.linearRampToValueAtTime(peakGain, time + 0.002);
	bodyGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.038);

	bodyOscillator.connect(bodyGain);
	bodyGain.connect(destination);
	bodyOscillator.start(time);
	bodyOscillator.stop(time + 0.045);

	if (isAccent) {
		const chimeOscillator = audioContext.createOscillator();
		chimeOscillator.type = "triangle";
		chimeOscillator.frequency.setValueAtTime(3120, time);

		const chimeGain = audioContext.createGain();
		chimeGain.gain.setValueAtTime(0.0001, time);
		chimeGain.gain.linearRampToValueAtTime(peakGain * 0.3, time + 0.001);
		chimeGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.014);

		chimeOscillator.connect(chimeGain);
		chimeGain.connect(destination);
		chimeOscillator.start(time);
		chimeOscillator.stop(time + 0.02);
	}
};

/**
 * Plays an immediate single metronome tick (used for tap-tempo tactile feedback).
 */
export const playOneShotMetronomeClick = (
	isAccent = false,
	volume = 0.7
): void => {
	if (!hasWebAudioSupport()) {
		return;
	}
	void ensureToneStarted();
	const audioContext = getOrCreateLiveAudioContext();
	scheduleMetronomeClick(
		audioContext,
		getLiveMasterInputNode(),
		audioContext.currentTime + 0.004,
		isAccent,
		volume
	);
};

export interface StandaloneMetronomeSnapshot {
	isRunning: boolean;
	currentBeat: number | null;
}

export class StandaloneMetronomeEngine {
	private isRunning = false;
	private timerId: number | null = null;
	private nextBeatTime = 0;
	private currentBeatIndex = 0;
	private activeVisualBeat: number | null = null;
	private bpm = 120;
	private beatsPerBar = 4;
	private volume = 0.7;
	private accentFirstBeat = true;
	private snapshot: StandaloneMetronomeSnapshot = {
		isRunning: false,
		currentBeat: null,
	};
	private readonly listeners = new Set<() => void>();

	public subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener);
		return (): void => {
			this.listeners.delete(listener);
		};
	};

	public getSnapshot = (): StandaloneMetronomeSnapshot => this.snapshot;

	private emitChange(): void {
		if (
			this.snapshot.isRunning === this.isRunning &&
			this.snapshot.currentBeat === this.activeVisualBeat
		) {
			return;
		}
		this.snapshot = {
			isRunning: this.isRunning,
			currentBeat: this.activeVisualBeat,
		};
		this.listeners.forEach((listener) => {
			listener();
		});
	}

	public getIsRunning(): boolean {
		return this.isRunning;
	}

	public start(
		bpm: number,
		beatsPerBar: number,
		volume: number,
		accentFirstBeat: boolean
	): void {
		if (!hasWebAudioSupport()) {
			return;
		}
		this.stop();
		void ensureToneStarted();
		const audioContext = getOrCreateLiveAudioContext();

		this.bpm = clampBpm(bpm);
		this.beatsPerBar = Math.max(1, Math.min(16, Math.round(beatsPerBar)));
		this.volume = Math.max(0.05, Math.min(1, volume));
		this.accentFirstBeat = accentFirstBeat;
		this.currentBeatIndex = 0;
		this.activeVisualBeat = null;
		this.isRunning = true;
		this.emitChange();
		this.nextBeatTime = audioContext.currentTime + 0.03;

		this.schedulerTick();
		this.timerId = window.setInterval(() => {
			this.schedulerTick();
		}, 25);
	}

	public update(
		bpm: number,
		beatsPerBar: number,
		volume: number,
		accentFirstBeat: boolean
	): void {
		this.bpm = clampBpm(bpm);
		this.beatsPerBar = Math.max(1, Math.min(16, Math.round(beatsPerBar)));
		this.volume = Math.max(0.05, Math.min(1, volume));
		this.accentFirstBeat = accentFirstBeat;
		if (this.currentBeatIndex >= this.beatsPerBar) {
			this.currentBeatIndex = 0;
		}
	}

	public stop(): void {
		const wasActive = this.isRunning || this.activeVisualBeat !== null;
		this.isRunning = false;
		this.activeVisualBeat = null;
		if (this.timerId !== null) {
			window.clearInterval(this.timerId);
			this.timerId = null;
		}
		if (wasActive) {
			this.emitChange();
		}
	}

	private schedulerTick(): void {
		if (!this.isRunning || !hasWebAudioSupport()) {
			return;
		}
		const audioContext = getOrCreateLiveAudioContext();
		const lookaheadSeconds = 0.11;

		while (
			this.isRunning &&
			this.nextBeatTime < audioContext.currentTime + lookaheadSeconds
		) {
			const scheduledTime = this.nextBeatTime;
			const beatSnapshot = this.currentBeatIndex;
			const isAccent = this.accentFirstBeat && beatSnapshot === 0;

			scheduleMetronomeClick(
				audioContext,
				getLiveMasterInputNode(),
				scheduledTime,
				isAccent,
				this.volume
			);

			try {
				Tone.Draw.schedule(() => {
					if (this.isRunning) {
						this.activeVisualBeat = beatSnapshot;
						this.emitChange();
					}
				}, scheduledTime);
			} catch {
				const uiDelayMs = Math.max(
					0,
					(scheduledTime - audioContext.currentTime) * 1000
				);
				window.setTimeout(() => {
					if (this.isRunning) {
						this.activeVisualBeat = beatSnapshot;
						this.emitChange();
					}
				}, uiDelayMs);
			}

			const beatDurationSeconds = 60 / this.bpm;
			this.nextBeatTime += beatDurationSeconds;
			this.currentBeatIndex = (this.currentBeatIndex + 1) % this.beatsPerBar;
		}
	}
}

export const standaloneMetronome = new StandaloneMetronomeEngine();

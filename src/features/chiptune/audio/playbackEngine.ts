import type { LoopMode, SongProject } from "../types/music";
import {
	getOrCreateLiveAudioContext,
	scheduleChannelNote,
} from "./voiceSynthesizer";

type StepListener = (barIndex: number, stepIndex: number) => void;

class ChiptunePlaybackEngine {
	private isRunning = false;
	private timerId: number | null = null;
	private nextNoteTime = 0;
	private currentBarIndex = 0;
	private currentStepIndex = 0;
	private activeSong: SongProject | null = null;
	private activeLoopMode: LoopMode = "song";
	private focusedBarIndex = 0;
	private masterGainNode: GainNode | null = null;
	private onStepCallback: StepListener | null = null;

	public updateSong(
		song: SongProject,
		loopMode: LoopMode,
		focusedBarIndex: number
	): void {
		this.activeSong = song;
		this.activeLoopMode = loopMode;
		this.focusedBarIndex = focusedBarIndex;
		if (this.masterGainNode) {
			const audioContext = getOrCreateLiveAudioContext();
			this.masterGainNode.gain.setTargetAtTime(
				song.masterVolume,
				audioContext.currentTime,
				0.02
			);
		}
	}

	public setStepListener(listener: StepListener | null): void {
		this.onStepCallback = listener;
	}

	public start(
		song: SongProject,
		startBarIndex: number,
		loopMode: LoopMode
	): void {
		const audioContext = getOrCreateLiveAudioContext();
		if (this.isRunning) {
			this.stop();
		}

		this.activeSong = song;
		this.activeLoopMode = loopMode;
		this.focusedBarIndex = startBarIndex;
		const loopStart = Math.max(
			0,
			Math.min(song.totalBars - 1, song.loopStartBar ?? 0)
		);
		const loopEnd = Math.max(
			loopStart,
			Math.min(song.totalBars - 1, song.loopEndBar ?? song.totalBars - 1)
		);
		const clampedStartBar = Math.max(
			0,
			Math.min(song.totalBars - 1, startBarIndex)
		);
		this.currentBarIndex =
			loopMode === "song" &&
			(clampedStartBar < loopStart || clampedStartBar > loopEnd)
				? loopStart
				: clampedStartBar;
		this.currentStepIndex = 0;
		this.isRunning = true;

		this.masterGainNode = audioContext.createGain();
		this.masterGainNode.gain.value = song.masterVolume;
		this.masterGainNode.connect(audioContext.destination);

		this.nextNoteTime = audioContext.currentTime + 0.04;
		this.timerId = window.setInterval(() => {
			this.schedulerTick();
		}, 25);
	}

	public stop(): void {
		this.isRunning = false;
		if (this.timerId !== null) {
			window.clearInterval(this.timerId);
			this.timerId = null;
		}
		if (this.masterGainNode) {
			this.masterGainNode.disconnect();
			this.masterGainNode = null;
		}
	}

	private schedulerTick(): void {
		if (!this.isRunning || !this.activeSong || !this.masterGainNode) {
			return;
		}

		const audioContext = getOrCreateLiveAudioContext();
		const lookaheadSeconds = 0.11;

		while (this.nextNoteTime < audioContext.currentTime + lookaheadSeconds) {
			this.scheduleCurrentStep(audioContext, this.masterGainNode);
			this.advanceStep();
		}
	}

	private scheduleCurrentStep(
		audioContext: AudioContext,
		destination: GainNode
	): void {
		const song = this.activeSong;
		if (!song) {
			return;
		}

		const stepsPerBar = song.beatsPerBar * song.stepsPerBeat;
		const baseStepDuration = 60 / song.bpm / song.stepsPerBeat;
		const isOddStep = this.currentStepIndex % 2 === 1;
		const swingOffset = isOddStep ? song.swing * baseStepDuration * 0.45 : 0;
		const scheduledTime = this.nextNoteTime + swingOffset;

		const hasSoloChannel = song.channels.some((channel) => channel.solo);

		song.channels.forEach((channel) => {
			const isAudible = hasSoloChannel ? channel.solo : !channel.muted;
			if (!isAudible) {
				return;
			}

			const patternIndex = channel.barSequence[this.currentBarIndex] ?? 0;
			if (patternIndex <= 0) {
				return;
			}

			const pattern = channel.patterns[String(patternIndex)];
			if (!pattern) {
				return;
			}

			pattern.notes.forEach((note) => {
				if (note.step === this.currentStepIndex) {
					scheduleChannelNote(
						audioContext,
						destination,
						note,
						channel,
						scheduledTime,
						baseStepDuration
					);
				}
			});
		});

		const barSnapshot = this.currentBarIndex;
		const stepSnapshot = this.currentStepIndex;
		const uiDelayMs = Math.max(
			0,
			(scheduledTime - audioContext.currentTime) * 1000
		);

		window.setTimeout(() => {
			if (this.isRunning && this.onStepCallback) {
				this.onStepCallback(barSnapshot, stepSnapshot);
			}
		}, uiDelayMs);

		if (this.currentStepIndex >= stepsPerBar) {
			this.currentStepIndex = 0;
		}
	}

	private advanceStep(): void {
		const song = this.activeSong;
		if (!song) {
			return;
		}

		const stepsPerBar = song.beatsPerBar * song.stepsPerBeat;
		const stepDuration = 60 / song.bpm / song.stepsPerBeat;
		this.nextNoteTime += stepDuration;

		this.currentStepIndex += 1;
		if (this.currentStepIndex >= stepsPerBar) {
			this.currentStepIndex = 0;
			if (this.activeLoopMode === "bar") {
				this.currentBarIndex = Math.max(
					0,
					Math.min(song.totalBars - 1, this.focusedBarIndex)
				);
			} else {
				const loopStart = Math.max(
					0,
					Math.min(song.totalBars - 1, song.loopStartBar ?? 0)
				);
				const loopEnd = Math.max(
					loopStart,
					Math.min(song.totalBars - 1, song.loopEndBar ?? song.totalBars - 1)
				);
				this.currentBarIndex =
					this.currentBarIndex >= loopEnd || this.currentBarIndex < loopStart
						? loopStart
						: this.currentBarIndex + 1;
			}
		}
	}
}

export const chiptunePlaybackEngine = new ChiptunePlaybackEngine();

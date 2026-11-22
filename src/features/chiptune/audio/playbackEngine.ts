import * as Tone from "tone";
import type { LoopMode, SongProject } from "../types/music";
import { buildNotePlaybackContext } from "./articulation";
import {
	disposeModernRack,
	getModernRack,
	songUsesModernRack,
} from "./modern/modernRack";
import { preloadSongSamples } from "./modern/sampleLibrary";
import {
	ensureToneStarted,
	getLiveMasterInputNode,
	getOrCreateLiveAudioContext,
	readLiveWaveformData,
	scheduleChannelNote,
} from "./voiceSynthesizer";

type StepListener = (barIndex: number, stepIndex: number) => void;
type PlaybackEndedListener = () => void;

const hasWebAudioSupport = (): boolean => {
	return (
		typeof window !== "undefined" &&
		("AudioContext" in window || "webkitAudioContext" in window)
	);
};

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
	private onPlaybackEndedCallback: PlaybackEndedListener | null = null;
	private finishTimeoutId: number | null = null;

	public updateSong(
		song: SongProject,
		loopMode: LoopMode,
		focusedBarIndex: number
	): void {
		this.activeSong = song;
		this.activeLoopMode = loopMode;
		this.focusedBarIndex = focusedBarIndex;
		if (this.isRunning && hasWebAudioSupport()) {
			try {
				Tone.getTransport().bpm.value = song.bpm;
			} catch {
				// Ignore if transport is unavailable
			}
		}
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

	public setPlaybackEndedListener(
		listener: PlaybackEndedListener | null
	): void {
		this.onPlaybackEndedCallback = listener;
	}

	public getWaveformData(targetArray: Float32Array): void {
		readLiveWaveformData(targetArray);
	}

	public start(
		song: SongProject,
		startBarIndex: number,
		loopMode: LoopMode
	): void {
		if (!hasWebAudioSupport()) {
			return;
		}
		void ensureToneStarted();
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
			(loopMode === "song" || loopMode === "once") &&
			(clampedStartBar < loopStart || clampedStartBar > loopEnd)
				? loopStart
				: clampedStartBar;
		this.currentStepIndex = 0;
		this.isRunning = true;

		try {
			const transport = Tone.getTransport();
			transport.bpm.value = song.bpm;
			if (transport.state !== "started") {
				transport.start();
			}
		} catch {
			// Ignore transport errors in headless environments
		}

		if (songUsesModernRack(song)) {
			void preloadSongSamples(song);
		}

		this.masterGainNode = audioContext.createGain();
		this.masterGainNode.gain.value = song.masterVolume;
		this.masterGainNode.connect(getLiveMasterInputNode());

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
		if (this.finishTimeoutId !== null) {
			window.clearTimeout(this.finishTimeoutId);
			this.finishTimeoutId = null;
		}
		if (hasWebAudioSupport()) {
			try {
				Tone.Draw.cancel();
				const transport = Tone.getTransport();
				if (transport.state === "started") {
					transport.stop();
				}
			} catch {
				// Ignore cleanup errors when audio context is unavailable
			}
		}
		if (this.masterGainNode) {
			disposeModernRack(this.masterGainNode);
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

		while (
			this.isRunning &&
			this.timerId !== null &&
			this.nextNoteTime < audioContext.currentTime + lookaheadSeconds
		) {
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
		// Modern songs mix every channel through the modern FX rack
		const modernRack = songUsesModernRack(song)
			? getModernRack(audioContext, destination)
			: null;

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

			const isDrum =
				channel.type === "drum" || channel.instrument.waveform === "retroKit";
			pattern.notes.forEach((note) => {
				if (note.step !== this.currentStepIndex) {
					return;
				}
				const playbackContext = buildNotePlaybackContext(
					pattern.notes,
					note,
					song,
					isDrum
				);
				if (modernRack && channel.instrument.modern) {
					modernRack.scheduleNote(
						note,
						channel,
						song,
						scheduledTime,
						baseStepDuration,
						playbackContext
					);
					return;
				}
				scheduleChannelNote(
					audioContext,
					modernRack
						? modernRack.getChannelInput(channel, song.bpm)
						: destination,
					note,
					channel,
					scheduledTime,
					baseStepDuration,
					playbackContext
				);
			});
		});

		const barSnapshot = this.currentBarIndex;
		const stepSnapshot = this.currentStepIndex;

		try {
			Tone.Draw.schedule(() => {
				if (this.isRunning && this.onStepCallback) {
					this.onStepCallback(barSnapshot, stepSnapshot);
				}
			}, scheduledTime);
		} catch {
			const uiDelayMs = Math.max(
				0,
				(scheduledTime - audioContext.currentTime) * 1000
			);
			window.setTimeout(() => {
				if (this.isRunning && this.onStepCallback) {
					this.onStepCallback(barSnapshot, stepSnapshot);
				}
			}, uiDelayMs);
		}

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
				if (this.activeLoopMode === "once" && this.currentBarIndex >= loopEnd) {
					if (this.timerId !== null) {
						window.clearInterval(this.timerId);
						this.timerId = null;
					}
					const audioContext = getOrCreateLiveAudioContext();
					const delayMs = Math.max(
						80,
						Math.ceil(
							(this.nextNoteTime - audioContext.currentTime + 0.18) * 1000
						)
					);
					this.finishTimeoutId = window.setTimeout(() => {
						this.stop();
						this.onPlaybackEndedCallback?.();
					}, delayMs);
					return;
				}
				this.currentBarIndex =
					this.currentBarIndex >= loopEnd || this.currentBarIndex < loopStart
						? loopStart
						: this.currentBarIndex + 1;
			}
		}
	}
}

export const chiptunePlaybackEngine = new ChiptunePlaybackEngine();

import type { Channel, NoteEvent } from "../types/music";
import { getModernRack } from "./modern/modernRack";
import { preloadSongSamples } from "./modern/sampleLibrary";
import {
	ensureToneStarted,
	getLiveMasterInputNode,
	getOrCreateLiveAudioContext,
	playPreviewNote as playChipPreviewNote,
} from "./voiceSynthesizer";

let modernPreviewBus: GainNode | null = null;

const getModernPreviewBus = (audioContext: AudioContext): GainNode => {
	if (!modernPreviewBus || modernPreviewBus.context !== audioContext) {
		modernPreviewBus = audioContext.createGain();
		modernPreviewBus.gain.value = 0.85;
		modernPreviewBus.connect(getLiveMasterInputNode());
	}
	return modernPreviewBus;
};

const hasWebAudioSupport = (): boolean =>
	typeof window !== "undefined" &&
	("AudioContext" in window || "webkitAudioContext" in window);

/**
 * Audition a note on a channel (piano-roll clicks, keyboard rows, agent API).
 * Modern channels play through a persistent modern FX rack so the preview
 * sounds like playback; retro channels use the chip synth.
 */
export const playPreviewNote = (
	pitch: number,
	channel: Channel,
	noteOverrides?: Partial<NoteEvent>,
	stepDurationSeconds = 0.12
): void => {
	if (!channel.instrument.modern) {
		playChipPreviewNote(pitch, channel, noteOverrides, stepDurationSeconds);
		return;
	}
	if (!hasWebAudioSupport()) {
		return;
	}
	void ensureToneStarted();
	const audioContext = getOrCreateLiveAudioContext();
	// Kick off sample loading the first time an instrument is auditioned
	void preloadSongSamples({ channels: [channel] });
	const rack = getModernRack(audioContext, getModernPreviewBus(audioContext));
	const bpm = 60 / (Math.max(0.02, stepDurationSeconds) * 4);
	rack.scheduleNote(
		{
			id: "preview",
			step: 0,
			pitch,
			duration: noteOverrides?.duration ?? 2,
			velocity: noteOverrides?.velocity ?? 0.85,
			pitchBend: noteOverrides?.pitchBend ?? 0,
			...(noteOverrides?.bendStyle
				? { bendStyle: noteOverrides.bendStyle }
				: {}),
			...(noteOverrides?.articulation
				? { articulation: noteOverrides.articulation }
				: {}),
		},
		channel,
		{ bpm },
		audioContext.currentTime + 0.01,
		stepDurationSeconds
	);
};

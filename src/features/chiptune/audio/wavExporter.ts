import type { SongProject } from "../types/music";
import { buildNotePlaybackContext } from "./articulation";
import {
	getModernRack,
	getModernTailSeconds,
	songUsesModernRack,
} from "./modern/modernRack";
import { preloadSongSamples } from "./modern/sampleLibrary";
import { getSongTailSeconds, scheduleChannelNote } from "./voiceSynthesizer";

const writeAsciiString = (
	view: DataView,
	offset: number,
	text: string
): void => {
	for (let index = 0; index < text.length; index += 1) {
		view.setUint8(offset + index, text.charCodeAt(index));
	}
};

const encodeAudioBufferToWav = (audioBuffer: AudioBuffer): Blob => {
	const channelCount = audioBuffer.numberOfChannels;
	const sampleRate = audioBuffer.sampleRate;
	const frameCount = audioBuffer.length;
	const bytesPerSample = 2;
	const blockAlign = channelCount * bytesPerSample;
	const dataByteLength = frameCount * blockAlign;
	const headerLength = 44;
	const buffer = new ArrayBuffer(headerLength + dataByteLength);
	const view = new DataView(buffer);

	writeAsciiString(view, 0, "RIFF");
	view.setUint32(4, 36 + dataByteLength, true);
	writeAsciiString(view, 8, "WAVE");
	writeAsciiString(view, 12, "fmt ");
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true); // PCM
	view.setUint16(22, channelCount, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, sampleRate * blockAlign, true);
	view.setUint16(32, blockAlign, true);
	view.setUint16(34, 16, true); // 16-bit
	writeAsciiString(view, 36, "data");
	view.setUint32(40, dataByteLength, true);

	const channelDataList: Array<Float32Array> = [];
	for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
		channelDataList.push(audioBuffer.getChannelData(channelIndex));
	}

	let writeOffset = headerLength;
	for (let frame = 0; frame < frameCount; frame += 1) {
		for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
			const channelData = channelDataList[channelIndex];
			const rawSample = channelData ? (channelData[frame] ?? 0) : 0;
			const clamped = Math.max(-1, Math.min(1, rawSample));
			const intSample = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
			view.setInt16(writeOffset, intSample, true);
			writeOffset += bytesPerSample;
		}
	}

	return new Blob([buffer], { type: "audio/wav" });
};

export interface AudioLevelReport {
	durationSeconds: number;
	peak: number;
	peakDb: number;
	rmsDb: number;
	clippedSamples: number;
}

const toDecibels = (value: number): number =>
	value > 0 ? Math.round(20 * Math.log10(value) * 10) / 10 : -120;

/** Peak / RMS / clipping summary of a rendered buffer (all channels). */
export const measureAudioBufferLevels = (
	audioBuffer: AudioBuffer
): AudioLevelReport => {
	let peak = 0;
	let sumOfSquares = 0;
	let clippedSamples = 0;
	let sampleCount = 0;
	for (
		let channelIndex = 0;
		channelIndex < audioBuffer.numberOfChannels;
		channelIndex += 1
	) {
		const data = audioBuffer.getChannelData(channelIndex);
		for (const sample of data) {
			const magnitude = Math.abs(sample);
			if (magnitude > peak) {
				peak = magnitude;
			}
			if (magnitude >= 0.999) {
				clippedSamples += 1;
			}
			sumOfSquares += sample * sample;
			sampleCount += 1;
		}
	}
	const rms = sampleCount > 0 ? Math.sqrt(sumOfSquares / sampleCount) : 0;
	return {
		durationSeconds: Math.round(audioBuffer.duration * 100) / 100,
		peak: Math.round(peak * 1000) / 1000,
		peakDb: toDecibels(peak),
		rmsDb: toDecibels(rms),
		clippedSamples,
	};
};

export interface RenderOptions {
	/**
	 * Game-ready loop: the reverb / release tail that rings past the loop end is
	 * folded back onto the start and the file is trimmed to the exact loop
	 * length, so it repeats with no gap and no cut-off tails.
	 */
	seamlessLoop?: boolean;
}

/** Adds everything after `loopFrames` onto the start, then trims to `loopFrames`. */
const foldTailIntoLoop = (
	rendered: AudioBuffer,
	loopFrames: number
): AudioBuffer => {
	const frames = Math.min(loopFrames, rendered.length);
	const folded = new AudioBuffer({
		length: frames,
		numberOfChannels: rendered.numberOfChannels,
		sampleRate: rendered.sampleRate,
	});
	for (
		let channelIndex = 0;
		channelIndex < rendered.numberOfChannels;
		channelIndex += 1
	) {
		const source = rendered.getChannelData(channelIndex);
		const target = folded.getChannelData(channelIndex);
		target.set(source.subarray(0, frames));
		for (let frame = frames; frame < source.length; frame += 1) {
			const wrapped = (frame - frames) % frames;
			target[wrapped] = (target[wrapped] ?? 0) + (source[frame] ?? 0);
		}
	}
	return folded;
};

export const renderSongToAudioBuffer = async (
	song: SongProject,
	loopCount = 1,
	options: RenderOptions = {}
): Promise<AudioBuffer> => {
	const sampleRate = 44100;
	const stepsPerBar = song.beatsPerBar * song.stepsPerBeat;
	const stepDurationSeconds = 60 / song.bpm / song.stepsPerBeat;
	const loopStart = Math.max(
		0,
		Math.min(song.totalBars - 1, song.loopStartBar ?? 0)
	);
	const loopEnd = Math.max(
		loopStart,
		Math.min(song.totalBars - 1, song.loopEndBar ?? song.totalBars - 1)
	);
	const renderedBarCount = loopEnd - loopStart + 1;
	const singleLoopDuration =
		renderedBarCount * stepsPerBar * stepDurationSeconds;
	// Long releases and the hall reverb keep ringing after the last bar
	const usesModernRack = songUsesModernRack(song);
	if (usesModernRack) {
		// Piano / strings / user samples must be decoded before rendering
		await preloadSongSamples(song);
	}
	const tailSeconds = Math.max(
		renderedBarCount <= 2 ? 0.35 : 1.25,
		getSongTailSeconds(song) + 0.1,
		usesModernRack ? getModernTailSeconds(song) + 0.1 : 0
	);
	const totalDurationSeconds = singleLoopDuration * loopCount + tailSeconds;
	const totalFrames = Math.ceil(totalDurationSeconds * sampleRate);

	const offlineContext = new OfflineAudioContext(2, totalFrames, sampleRate);
	const masterGain = offlineContext.createGain();
	masterGain.gain.value = song.masterVolume;
	masterGain.connect(offlineContext.destination);

	const hasSoloChannel = song.channels.some((channel) => channel.solo);
	const modernRack = usesModernRack
		? getModernRack(offlineContext, masterGain)
		: null;

	for (let loop = 0; loop < loopCount; loop += 1) {
		const loopOffsetSeconds = loop * singleLoopDuration;

		for (let barIndex = loopStart; barIndex <= loopEnd; barIndex += 1) {
			const barOffsetSeconds =
				loopOffsetSeconds +
				(barIndex - loopStart) * stepsPerBar * stepDurationSeconds;

			song.channels.forEach((channel) => {
				const isAudible = hasSoloChannel ? channel.solo : !channel.muted;
				if (!isAudible) {
					return;
				}

				const patternIndex = channel.barSequence[barIndex] ?? 0;
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
					const isOddStep = note.step % 2 === 1;
					const swingOffset = isOddStep
						? song.swing * stepDurationSeconds * 0.45
						: 0;
					const noteStartSeconds =
						barOffsetSeconds +
						note.step * stepDurationSeconds +
						swingOffset +
						0.02;

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
							noteStartSeconds,
							stepDurationSeconds,
							playbackContext
						);
						return;
					}
					scheduleChannelNote(
						offlineContext,
						modernRack
							? modernRack.getChannelInput(channel, song.bpm)
							: masterGain,
						note,
						channel,
						noteStartSeconds,
						stepDurationSeconds,
						playbackContext
					);
				});
			});
		}
	}

	const rendered = await offlineContext.startRendering();
	if (!options.seamlessLoop) {
		return rendered;
	}
	// Notes start 20 ms into the render (see noteStartSeconds), so the loop
	// window is shifted by the same amount to keep the downbeat on frame 0.
	const leadInFrames = Math.round(0.02 * sampleRate);
	const loopFrames = Math.round(singleLoopDuration * loopCount * sampleRate);
	const shifted = new AudioBuffer({
		length: Math.max(1, rendered.length - leadInFrames),
		numberOfChannels: rendered.numberOfChannels,
		sampleRate,
	});
	for (
		let channelIndex = 0;
		channelIndex < rendered.numberOfChannels;
		channelIndex += 1
	) {
		shifted
			.getChannelData(channelIndex)
			.set(rendered.getChannelData(channelIndex).subarray(leadInFrames));
	}
	return foldTailIntoLoop(shifted, loopFrames);
};

export const renderSongToWavBlob = async (
	song: SongProject,
	loopCount = 1,
	options: RenderOptions = {}
): Promise<Blob> => {
	return encodeAudioBufferToWav(
		await renderSongToAudioBuffer(song, loopCount, options)
	);
};

export const downloadBlobAsFile = (blob: Blob, filename: string): void => {
	const objectUrl = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = objectUrl;
	anchor.download = filename;
	document.body.append(anchor);
	anchor.click();
	anchor.remove();
	window.setTimeout(() => {
		URL.revokeObjectURL(objectUrl);
	}, 2000);
};

import type { SongProject } from "../types/music";
import { scheduleChannelNote } from "./voiceSynthesizer";

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

export const renderSongToWavBlob = async (
	song: SongProject,
	loopCount = 1
): Promise<Blob> => {
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
	const tailSeconds = 1.25;
	const totalDurationSeconds = singleLoopDuration * loopCount + tailSeconds;
	const totalFrames = Math.ceil(totalDurationSeconds * sampleRate);

	const offlineContext = new OfflineAudioContext(2, totalFrames, sampleRate);
	const masterGain = offlineContext.createGain();
	masterGain.gain.value = song.masterVolume;
	masterGain.connect(offlineContext.destination);

	const hasSoloChannel = song.channels.some((channel) => channel.solo);

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

					scheduleChannelNote(
						offlineContext,
						masterGain,
						note,
						channel,
						noteStartSeconds,
						stepDurationSeconds
					);
				});
			});
		}
	}

	const renderedBuffer = await offlineContext.startRendering();
	return encodeAudioBufferToWav(renderedBuffer);
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

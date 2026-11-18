import type { Channel, SongProject, WaveformType } from "../types/music";

export interface MidiExportOptions {
	/** If true, only exports the loop region (loopStartBar to loopEndBar). Defaults to false (exports all bars). */
	loopOnly?: boolean;
	/** If true, exports muted channels as well. Defaults to false (respects mute/solo states). */
	includeMuted?: boolean;
	/** If true, applies swing timing offset to odd steps. Defaults to true. */
	includeSwing?: boolean;
}

export const TICKS_PER_BEAT = 480;

/** General MIDI percussion mapping for drum pads (0 to 7) */
export const DRUM_PAD_TO_GM_NOTE: Record<number, number> = {
	0: 36, // 8-Bit Kick -> Bass Drum 1
	1: 38, // Noise Snare -> Acoustic Snare
	2: 42, // Closed Hat -> Closed Hi-Hat
	3: 46, // Open Hat -> Open Hi-Hat
	4: 45, // Low Chip Tom -> Low Tom
	5: 50, // High Chip Tom -> High Tom
	6: 39, // Retro Clap -> Hand Clap
	7: 76, // Coin Blip -> Hi Wood Block
};

/** Maps chiptune synth waveforms to General MIDI instrument program numbers (0-127) */
export const getGeneralMidiProgramForWaveform = (
	waveform: WaveformType
): number => {
	switch (waveform) {
		case "sawtooth":
		case "supersaw":
			return 81; // Lead 2 (sawtooth)
		case "triangle":
			return 38; // Synth Bass 1
		case "fm":
			return 87; // Lead 8 (bass + lead)
		case "pulse12":
		case "pulse25":
		case "pulse50":
		case "retroKit":
		default:
			return 80; // Lead 1 (square)
	}
};

/**
 * Encodes an integer as a MIDI Variable-Length Quantity (VLQ).
 * Used for delta times and event lengths in Standard MIDI Files.
 */
export const encodeVariableLengthQuantity = (value: number): Array<number> => {
	const clamped = Math.max(0, Math.floor(value));
	const buffer: Array<number> = [clamped & 0x7f];
	let current = clamped >>> 7;
	while (current > 0) {
		buffer.unshift((current & 0x7f) | 0x80);
		current = current >>> 7;
	}
	return buffer;
};

const writeUint32BE = (target: Array<number>, value: number): void => {
	target.push((value >>> 24) & 0xff);
	target.push((value >>> 16) & 0xff);
	target.push((value >>> 8) & 0xff);
	target.push(value & 0xff);
};

const writeUint16BE = (target: Array<number>, value: number): void => {
	target.push((value >>> 8) & 0xff);
	target.push(value & 0xff);
};

interface RawMidiTrackEvent {
	tick: number;
	priority: number;
	bytes: Array<number>;
}

/**
 * Key signature sharp/flat count map for Standard MIDI Key Signature meta-event.
 * Positive = sharps, Negative = flats.
 */
const KEY_SIGNATURE_SHARPS_FLATS: Record<string, { sf: number; mi: number }> = {
	// Major keys (mi = 0)
	"C major": { sf: 0, mi: 0 },
	"G major": { sf: 1, mi: 0 },
	"D major": { sf: 2, mi: 0 },
	"A major": { sf: 3, mi: 0 },
	"E major": { sf: 4, mi: 0 },
	"B major": { sf: 5, mi: 0 },
	"F# major": { sf: 6, mi: 0 },
	"C# major": { sf: 7, mi: 0 },
	"F major": { sf: -1, mi: 0 },
	"Bb major": { sf: -2, mi: 0 },
	"Eb major": { sf: -3, mi: 0 },
	"Ab major": { sf: -4, mi: 0 },
	// Minor keys (mi = 1)
	"A minor": { sf: 0, mi: 1 },
	"E minor": { sf: 1, mi: 1 },
	"B minor": { sf: 2, mi: 1 },
	"F# minor": { sf: 3, mi: 1 },
	"C# minor": { sf: 4, mi: 1 },
	"G# minor": { sf: 5, mi: 1 },
	"D# minor": { sf: 6, mi: 1 },
	"D minor": { sf: -1, mi: 1 },
	"G minor": { sf: -2, mi: 1 },
	"C minor": { sf: -3, mi: 1 },
	"F minor": { sf: -4, mi: 1 },
	"Bb minor": { sf: -5, mi: 1 },
	"Eb minor": { sf: -6, mi: 1 },
};

const encodeTextMetaEvent = (metaType: number, text: string): Array<number> => {
	const encoder = new TextEncoder();
	const textBytes = Array.from(encoder.encode(text));
	return [
		0xff,
		metaType,
		...encodeVariableLengthQuantity(textBytes.length),
		...textBytes,
	];
};

/**
 * Serializes a list of timed track events into a complete MIDI MTrk chunk.
 */
const serializeTrackChunk = (
	events: Array<RawMidiTrackEvent>
): Array<number> => {
	// Sort primarily by tick, secondarily by event priority
	events.sort((a, b) => {
		if (a.tick !== b.tick) {
			return a.tick - b.tick;
		}
		return a.priority - b.priority;
	});

	const trackData: Array<number> = [];
	let lastTick = 0;

	for (const event of events) {
		const delta = Math.max(0, event.tick - lastTick);
		trackData.push(...encodeVariableLengthQuantity(delta));
		trackData.push(...event.bytes);
		lastTick = event.tick;
	}

	// End of Track meta event: 0xFF 0x2F 0x00 with delta time 0
	trackData.push(0x00, 0xff, 0x2f, 0x00);

	const chunk: Array<number> = [0x4d, 0x54, 0x72, 0x6b]; // "MTrk"
	writeUint32BE(chunk, trackData.length);
	chunk.push(...trackData);
	return chunk;
};

/**
 * Builds the conductor/tempo track (Track 0) containing song title, time signature,
 * tempo in microseconds per quarter note, and key signature.
 */
const buildConductorTrackChunk = (song: SongProject): Array<number> => {
	const events: Array<RawMidiTrackEvent> = [];

	// Sequence / Track Name (Priority 1)
	const title = song.title.trim() || "UltraBeep Track";
	events.push({
		tick: 0,
		priority: 1,
		bytes: encodeTextMetaEvent(0x03, title),
	});

	// Time Signature (Priority 2)
	// beatsPerBar / 4 (denominator 4 is 2^2, so dd = 2)
	const numerator = Math.max(1, Math.min(32, song.beatsPerBar || 4));
	const denominatorPower = 2; // quarter note
	const clocksPerMetronomeTick = 24;
	const notes32ndPerBeat = 8;
	events.push({
		tick: 0,
		priority: 2,
		bytes: [
			0xff,
			0x58,
			0x04,
			numerator,
			denominatorPower,
			clocksPerMetronomeTick,
			notes32ndPerBeat,
		],
	});

	// Set Tempo (Priority 3)
	const bpm = Math.max(20, Math.min(400, song.bpm || 120));
	const microsecondsPerBeat = Math.round(60_000_000 / bpm);
	events.push({
		tick: 0,
		priority: 3,
		bytes: [
			0xff,
			0x51,
			0x03,
			(microsecondsPerBeat >> 16) & 0xff,
			(microsecondsPerBeat >> 8) & 0xff,
			microsecondsPerBeat & 0xff,
		],
	});

	// Optional Key Signature (Priority 4)
	const keyLookup = `${song.rootKey} ${song.scale}`;
	const keyInfo = KEY_SIGNATURE_SHARPS_FLATS[keyLookup];
	if (keyInfo) {
		const sfByte = keyInfo.sf < 0 ? 256 + keyInfo.sf : keyInfo.sf;
		events.push({
			tick: 0,
			priority: 4,
			bytes: [0xff, 0x59, 0x02, sfByte, keyInfo.mi],
		});
	}

	return serializeTrackChunk(events);
};

/**
 * Builds a single channel's MIDI track chunk.
 */
const buildChannelTrackChunk = (
	channel: Channel,
	song: SongProject,
	midiChannel: number,
	options?: MidiExportOptions
): Array<number> => {
	const events: Array<RawMidiTrackEvent> = [];
	const stepsPerBar = song.beatsPerBar * song.stepsPerBeat;
	const ticksPerStep = Math.round(TICKS_PER_BEAT / song.stepsPerBeat);

	const loopStart = Math.max(
		0,
		Math.min(song.totalBars - 1, song.loopStartBar ?? 0)
	);
	const loopEnd = Math.max(
		loopStart,
		Math.min(song.totalBars - 1, song.loopEndBar ?? song.totalBars - 1)
	);

	const startBar = options?.loopOnly ? loopStart : 0;
	const endBar = options?.loopOnly ? loopEnd : song.totalBars - 1;

	// Track Name (Priority 1)
	events.push({
		tick: 0,
		priority: 1,
		bytes: encodeTextMetaEvent(0x03, channel.name || "Channel"),
	});

	const isDrum = channel.type === "drum";

	// Program change (Priority 8)
	if (!isDrum) {
		const program = getGeneralMidiProgramForWaveform(
			channel.instrument.waveform
		);
		events.push({
			tick: 0,
			priority: 8,
			bytes: [0xc0 | midiChannel, Math.max(0, Math.min(127, program))],
		});

		// Check if any note uses pitch bend; if so, set RPN 0 to sensitivity ±24 semitones
		const hasPitchBendNotes = Object.values(channel.patterns).some((pattern) =>
			pattern.notes.some((note) => note.pitchBend && note.pitchBend !== 0)
		);

		if (hasPitchBendNotes) {
			// RPN MSB = 0, RPN LSB = 0 (Pitch Bend Sensitivity)
			events.push({
				tick: 0,
				priority: 2,
				bytes: [0xb0 | midiChannel, 101, 0],
			});
			events.push({
				tick: 0,
				priority: 3,
				bytes: [0xb0 | midiChannel, 100, 0],
			});
			// Data Entry MSB = 24 semitones
			events.push({
				tick: 0,
				priority: 4,
				bytes: [0xb0 | midiChannel, 6, 24],
			});
			// Data Entry LSB = 0
			events.push({
				tick: 0,
				priority: 5,
				bytes: [0xb0 | midiChannel, 38, 0],
			});
			// RPN Null (Reset RPN)
			events.push({
				tick: 0,
				priority: 6,
				bytes: [0xb0 | midiChannel, 101, 127],
			});
			events.push({
				tick: 0,
				priority: 7,
				bytes: [0xb0 | midiChannel, 100, 127],
			});
		}
	}

	// Volume CC 7 (Priority 9)
	const volume = Math.min(
		127,
		Math.max(0, Math.round((channel.instrument.volume ?? 0.8) * 127))
	);
	events.push({
		tick: 0,
		priority: 9,
		bytes: [0xb0 | midiChannel, 0x07, volume],
	});

	// Pan CC 10 (Priority 10): pan -1 to +1 -> 0 to 127 (center = 64)
	const rawPan = channel.instrument.pan ?? 0;
	const pan = Math.min(127, Math.max(0, Math.round(((rawPan + 1) / 2) * 127)));
	events.push({
		tick: 0,
		priority: 10,
		bytes: [0xb0 | midiChannel, 0x0a, pan],
	});

	const includeSwing = options?.includeSwing ?? true;

	for (let barIndex = startBar; barIndex <= endBar; barIndex += 1) {
		const relativeBar = barIndex - startBar;
		const barStartTick = relativeBar * stepsPerBar * ticksPerStep;

		const patternIndex = channel.barSequence[barIndex] ?? 0;
		if (patternIndex <= 0) {
			continue;
		}

		const pattern = channel.patterns[String(patternIndex)];
		if (!pattern || !pattern.notes || pattern.notes.length === 0) {
			continue;
		}

		for (const note of pattern.notes) {
			const isOddStep = note.step % 2 === 1;
			const swingTicks =
				includeSwing && isOddStep && song.swing > 0
					? Math.round(song.swing * ticksPerStep * 0.45)
					: 0;

			const noteStartTick =
				barStartTick + note.step * ticksPerStep + swingTicks;
			const durationSteps = Math.max(1, note.duration || 1);
			const noteDurationTicks = Math.max(
				1,
				Math.round(durationSteps * ticksPerStep)
			);
			const noteEndTick = noteStartTick + noteDurationTicks;

			let midiPitch: number;
			if (isDrum) {
				midiPitch = DRUM_PAD_TO_GM_NOTE[note.pitch] ?? 36;
			} else {
				midiPitch = Math.min(127, Math.max(0, Math.round(note.pitch)));
			}

			const velocity = Math.min(
				127,
				Math.max(1, Math.round((note.velocity ?? 0.8) * 127))
			);

			// Note On (Priority 30)
			events.push({
				tick: noteStartTick,
				priority: 30,
				bytes: [0x90 | midiChannel, midiPitch, velocity],
			});

			// Optional Pitch Bend transition for melodic channels
			if (!isDrum && note.pitchBend && note.pitchBend !== 0) {
				const bendOffsetFraction =
					note.bendStyle === "early"
						? 0.25
						: note.bendStyle === "continuous"
							? 0.1
							: 0.6; // "late" is default in Ultrabeep
				const bendTick =
					noteStartTick + Math.round(noteDurationTicks * bendOffsetFraction);

				// Bend value with sensitivity ±24 semitones: center 8192
				const clampedBendSemitones = Math.max(
					-24,
					Math.min(24, note.pitchBend)
				);
				const bendValue = Math.max(
					0,
					Math.min(16383, 8192 + Math.round((clampedBendSemitones / 24) * 8191))
				);
				const lsb = bendValue & 0x7f;
				const msb = (bendValue >> 7) & 0x7f;

				events.push({
					tick: bendTick,
					priority: 25,
					bytes: [0xe0 | midiChannel, lsb, msb],
				});

				// Reset pitch bend back to center (8192) at note end
				events.push({
					tick: noteEndTick,
					priority: 21,
					bytes: [0xe0 | midiChannel, 0x00, 0x40],
				});
			}

			// Note Off (Priority 20: processed before any simultaneous Note On)
			events.push({
				tick: noteEndTick,
				priority: 20,
				bytes: [0x80 | midiChannel, midiPitch, 64],
			});
		}
	}

	return serializeTrackChunk(events);
};

/**
 * Renders a full SongProject to Standard MIDI File (SMF Format 1) binary data.
 */
export const renderSongToMidiBytes = (
	song: SongProject,
	options?: MidiExportOptions
): Uint8Array => {
	const hasSoloChannel = song.channels.some((channel) => channel.solo);
	const eligibleChannels = song.channels.filter((channel) => {
		if (options?.includeMuted) {
			return true;
		}
		return hasSoloChannel ? channel.solo : !channel.muted;
	});

	// Standard GM channel assignment:
	// Melodic channels: 0-8 and 10-15 (1-9 and 11-16 in 1-based notation)
	// Percussion channel: 9 (10 in 1-based notation)
	const melodicChannelPool = [
		0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15,
	];
	let melodicChannelIndex = 0;

	const trackChunks: Array<Array<number>> = [];

	// Track 0: Conductor Track (Tempo, Time Signature, Track Name, Key)
	trackChunks.push(buildConductorTrackChunk(song));

	// Tracks 1..N: Instrument channels
	for (const channel of eligibleChannels) {
		let midiChannel: number;
		if (channel.type === "drum") {
			midiChannel = 9; // GM Percussion channel
		} else {
			midiChannel =
				melodicChannelPool[melodicChannelIndex % melodicChannelPool.length] ??
				0;
			melodicChannelIndex += 1;
		}

		trackChunks.push(
			buildChannelTrackChunk(channel, song, midiChannel, options)
		);
	}

	const fileBytes: Array<number> = [];

	// SMF Header Chunk: "MThd"
	fileBytes.push(0x4d, 0x54, 0x68, 0x64);
	writeUint32BE(fileBytes, 6); // header chunk data length = 6
	writeUint16BE(fileBytes, 1); // Format 1 (multitrack synchronous)
	writeUint16BE(fileBytes, trackChunks.length);
	writeUint16BE(fileBytes, TICKS_PER_BEAT);

	// Append all track chunks
	for (const trackChunk of trackChunks) {
		fileBytes.push(...trackChunk);
	}

	return new Uint8Array(fileBytes);
};

/**
 * Renders a full SongProject to a downloadable MIDI Blob (MIME type audio/midi).
 */
export const renderSongToMidiBlob = (
	song: SongProject,
	options?: MidiExportOptions
): Blob => {
	const bytes = renderSongToMidiBytes(song, options);
	return new Blob([bytes.buffer as ArrayBuffer], { type: "audio/midi" });
};

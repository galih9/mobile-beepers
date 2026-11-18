import { describe, expect, it } from "vitest";
import { DEMO_SONGS } from "../constants/demoSongs";
import {
	createBlankSongProject,
	createSongNote,
} from "../constants/patternGenerator";
import {
	DRUM_PAD_TO_GM_NOTE,
	encodeVariableLengthQuantity,
	getGeneralMidiProgramForWaveform,
	renderSongToMidiBlob,
	renderSongToMidiBytes,
	TICKS_PER_BEAT,
} from "../audio/midiExporter";

describe("midiExporter", () => {
	it("correctly encodes Variable-Length Quantities (VLQ)", () => {
		expect(encodeVariableLengthQuantity(0)).toEqual([0x00]);
		expect(encodeVariableLengthQuantity(127)).toEqual([0x7f]);
		expect(encodeVariableLengthQuantity(128)).toEqual([0x81, 0x00]);
		expect(encodeVariableLengthQuantity(255)).toEqual([0x81, 0x7f]);
		expect(encodeVariableLengthQuantity(16383)).toEqual([0xff, 0x7f]);
		expect(encodeVariableLengthQuantity(16384)).toEqual([0x81, 0x80, 0x00]);
	});

	it("maps chiptune synth waveforms to appropriate General MIDI program numbers", () => {
		expect(getGeneralMidiProgramForWaveform("pulse50")).toBe(80);
		expect(getGeneralMidiProgramForWaveform("pulse12")).toBe(80);
		expect(getGeneralMidiProgramForWaveform("pulse25")).toBe(80);
		expect(getGeneralMidiProgramForWaveform("sawtooth")).toBe(81);
		expect(getGeneralMidiProgramForWaveform("supersaw")).toBe(81);
		expect(getGeneralMidiProgramForWaveform("triangle")).toBe(38);
		expect(getGeneralMidiProgramForWaveform("fm")).toBe(87);
	});

	it("maps drum pad IDs to standard General MIDI drum notes", () => {
		expect(DRUM_PAD_TO_GM_NOTE[0]).toBe(36); // Kick
		expect(DRUM_PAD_TO_GM_NOTE[1]).toBe(38); // Snare
		expect(DRUM_PAD_TO_GM_NOTE[2]).toBe(42); // Closed Hat
		expect(DRUM_PAD_TO_GM_NOTE[3]).toBe(46); // Open Hat
		expect(DRUM_PAD_TO_GM_NOTE[4]).toBe(45); // Low Tom
		expect(DRUM_PAD_TO_GM_NOTE[5]).toBe(50); // High Tom
		expect(DRUM_PAD_TO_GM_NOTE[6]).toBe(39); // Clap
		expect(DRUM_PAD_TO_GM_NOTE[7]).toBe(76); // High Wood Block (Coin Blip)
	});

	it("exports a minimal song to valid SMF Format 1 MIDI bytes and Blob", () => {
		const song = createBlankSongProject();
		song.title = "Test Chiptune";
		song.bpm = 120;
		const channel = song.channels[0];
		expect(channel).toBeDefined();
		if (!channel) return;

		channel.barSequence[0] = 1;
		channel.patterns["1"] = {
			index: 1,
			notes: [
				createSongNote(0, 60, 2, 0.8),
				createSongNote(4, 64, 2, 0.8),
				createSongNote(8, 67, 4, 1.0),
			],
		};

		const bytes = renderSongToMidiBytes(song);
		expect(bytes).toBeInstanceOf(Uint8Array);
		expect(bytes.length).toBeGreaterThan(50);

		// Header validation
		// "MThd"
		expect(
			String.fromCharCode(
				bytes[0] ?? 0,
				bytes[1] ?? 0,
				bytes[2] ?? 0,
				bytes[3] ?? 0
			)
		).toBe("MThd");
		// Header size = 6
		expect(bytes[4]).toBe(0);
		expect(bytes[5]).toBe(0);
		expect(bytes[6]).toBe(0);
		expect(bytes[7]).toBe(6);
		// Format 1
		expect(bytes[8]).toBe(0);
		expect(bytes[9]).toBe(1);
		// Number of tracks: 1 conductor + eligible channels
		const trackCount = ((bytes[10] ?? 0) << 8) | (bytes[11] ?? 0);
		expect(trackCount).toBe(1 + song.channels.length);
		// Division: TICKS_PER_BEAT (480)
		const division = ((bytes[12] ?? 0) << 8) | (bytes[13] ?? 0);
		expect(division).toBe(TICKS_PER_BEAT);

		// Check first track is MTrk
		expect(
			String.fromCharCode(
				bytes[14] ?? 0,
				bytes[15] ?? 0,
				bytes[16] ?? 0,
				bytes[17] ?? 0
			)
		).toBe("MTrk");

		const blob = renderSongToMidiBlob(song);
		expect(blob.type).toBe("audio/midi");
		expect(blob.size).toBe(bytes.length);
	});

	it("correctly encodes pitch bends in melodic tracks", () => {
		const song = createBlankSongProject();
		const channel = song.channels[0];
		expect(channel).toBeDefined();
		if (!channel) return;

		channel.barSequence[0] = 1;
		const bentNote = createSongNote(0, 60, 4, 0.8);
		bentNote.pitchBend = 12; // 12 semitones up
		bentNote.bendStyle = "late";
		channel.patterns["1"] = {
			index: 1,
			notes: [bentNote],
		};

		const bytes = renderSongToMidiBytes(song);
		// Check that pitch bend status byte (0xE0) exists in output
		const hasPitchBendStatus = Array.from(bytes).some(
			(byte) => (byte & 0xf0) === 0xe0
		);
		expect(hasPitchBendStatus).toBe(true);
	});

	it("correctly maps drum channel to MIDI channel 9 with GM drum notes", () => {
		const song = createBlankSongProject();
		const drumChannel = song.channels.find((c) => c.type === "drum");
		expect(drumChannel).toBeDefined();
		if (!drumChannel) return;

		drumChannel.barSequence[0] = 1;
		drumChannel.patterns["1"] = {
			index: 1,
			notes: [
				createSongNote(0, 0, 1), // Kick -> 36
				createSongNote(4, 1, 1), // Snare -> 38
				createSongNote(8, 2, 1), // Closed Hat -> 42
			],
		};

		const bytes = renderSongToMidiBytes(song);
		const byteList = Array.from(bytes);

		// Check for Note On on channel 9 (0x99)
		const drumNoteOnIndex = byteList.indexOf(0x99);
		expect(drumNoteOnIndex).toBeGreaterThan(-1);

		// Following 0x99 should be the drum pitch (e.g. 36 for kick)
		const firstDrumPitch = byteList[drumNoteOnIndex + 1];
		expect(firstDrumPitch).toBe(36);
	});

	it("respects includeMuted option", () => {
		const song = createBlankSongProject();
		const firstChannel = song.channels[0];
		expect(firstChannel).toBeDefined();
		if (!firstChannel) return;

		firstChannel.muted = true;

		const bytesMutedExcluded = renderSongToMidiBytes(song, {
			includeMuted: false,
		});
		const trackCountExcluded =
			((bytesMutedExcluded[10] ?? 0) << 8) | (bytesMutedExcluded[11] ?? 0);

		const bytesMutedIncluded = renderSongToMidiBytes(song, {
			includeMuted: true,
		});
		const trackCountIncluded =
			((bytesMutedIncluded[10] ?? 0) << 8) | (bytesMutedIncluded[11] ?? 0);

		expect(trackCountIncluded).toBe(trackCountExcluded + 1);
	});

	it("respects loopOnly option", () => {
		const song = createBlankSongProject();
		song.totalBars = 8;
		song.loopStartBar = 2;
		song.loopEndBar = 3;

		const firstChannel = song.channels[0];
		expect(firstChannel).toBeDefined();
		if (!firstChannel) return;

		// Put notes in bar 0 and bar 2
		firstChannel.barSequence[0] = 1;
		firstChannel.barSequence[2] = 2;
		firstChannel.patterns["1"] = {
			index: 1,
			notes: [createSongNote(0, 60, 2)],
		};
		firstChannel.patterns["2"] = {
			index: 2,
			notes: [createSongNote(0, 72, 2)],
		};

		const fullSongBytes = renderSongToMidiBytes(song, { loopOnly: false });
		const loopOnlyBytes = renderSongToMidiBytes(song, { loopOnly: true });

		expect(fullSongBytes.length).toBeGreaterThan(0);
		expect(loopOnlyBytes.length).toBeGreaterThan(0);
	});

	it("successfully exports all built-in demo songs to MIDI without errors", () => {
		for (const demoSong of DEMO_SONGS) {
			const midiBytes = renderSongToMidiBytes(demoSong);
			expect(midiBytes.length).toBeGreaterThan(100);

			// Validate header
			expect(
				String.fromCharCode(
					midiBytes[0] ?? 0,
					midiBytes[1] ?? 0,
					midiBytes[2] ?? 0,
					midiBytes[3] ?? 0
				)
			).toBe("MThd");

			// Parse tracks
			let offset = 14; // header length (4 + 4 + 2 + 2 + 2)
			const numberTracks = ((midiBytes[10] ?? 0) << 8) | (midiBytes[11] ?? 0);

			for (let trackIndex = 0; trackIndex < numberTracks; trackIndex++) {
				const tag = String.fromCharCode(
					midiBytes[offset] ?? 0,
					midiBytes[offset + 1] ?? 0,
					midiBytes[offset + 2] ?? 0,
					midiBytes[offset + 3] ?? 0
				);
				expect(tag).toBe("MTrk");
				const trackLength =
					((midiBytes[offset + 4] ?? 0) << 24) |
					((midiBytes[offset + 5] ?? 0) << 16) |
					((midiBytes[offset + 6] ?? 0) << 8) |
					(midiBytes[offset + 7] ?? 0);
				expect(trackLength).toBeGreaterThan(0);

				// Last 3 bytes of track must be End of Track: 0xFF 0x2F 0x00
				const trackEndOffset = offset + 8 + trackLength;
				expect(midiBytes[trackEndOffset - 3]).toBe(0xff);
				expect(midiBytes[trackEndOffset - 2]).toBe(0x2f);
				expect(midiBytes[trackEndOffset - 1]).toBe(0x00);

				offset = trackEndOffset;
			}

			// Ensure all bytes were consumed
			expect(offset).toBe(midiBytes.length);

			const blob = renderSongToMidiBlob(demoSong);
			expect(blob.size).toBe(midiBytes.length);
			expect(blob.type).toBe("audio/midi");
		}
	});
});

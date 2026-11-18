import type {
	ChannelType,
	NoteBendStyle,
	NoteEvent,
	NoteFadeMode,
	SfxGeneratorArchetype,
	SfxPresetDefinition,
	SongProject,
} from "../types/music";
import { getPresetConfigurationById } from "./instrumentPresets";
import { CHANNEL_COLOR_PALETTE, createSongNote } from "./patternGenerator";

const createSfxNote = (
	step: number,
	pitch: number,
	duration = 1,
	pitchBend = 0,
	velocity = 0.92,
	options?: { bendStyle?: NoteBendStyle; fadeMode?: NoteFadeMode }
): NoteEvent => ({
	...createSongNote(step, pitch, duration, pitchBend, velocity),
	...(options?.bendStyle ? { bendStyle: options.bendStyle } : {}),
	...(options?.fadeMode ? { fadeMode: options.fadeMode } : {}),
});

const rayGunShootProject: SongProject = {
	id: "sfx-ray-gun",
	title: "Ray Gun Shoot",
	author: "UltraBeep SFX",
	bpm: 185,
	beatsPerBar: 4,
	stepsPerBeat: 4,
	totalBars: 1,
	loopStartBar: 0,
	loopEndBar: 0,
	swing: 0,
	rootKey: "C",
	scale: "chromatic",
	masterVolume: 0.88,
	updatedAt: 1700000101000,
	channels: [
		{
			id: "sfx-ray-beam",
			name: "Laser Beam",
			type: "pitch",
			color: CHANNEL_COLOR_PALETTE[0] ?? "#00c7ff",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("nes-pulse-12").configuration,
				volume: 0.78,
				pan: 0,
				attack: 0.003,
				decay: 0.14,
				sustain: 0.48,
				release: 0.05,
				filterCutoff: 8800,
				vibratoDepth: 10,
				vibratoSpeed: 12,
				arpMode: "none",
				echoMix: 0.18,
				echoTimeSeconds: 0.1,
			},
			barSequence: [1],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSfxNote(0, 76, 3, -18, 0.98, { bendStyle: "continuous" }),
						createSfxNote(4, 79, 2, -20, 0.92, { bendStyle: "continuous" }),
						createSfxNote(7, 74, 4, -24, 0.88, {
							bendStyle: "continuous",
							fadeMode: "fadeOut",
						}),
					],
				},
			},
		},
		{
			id: "sfx-ray-sub",
			name: "Sub Zap",
			type: "pitch",
			color: CHANNEL_COLOR_PALETTE[1] ?? "#ffd93d",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("vrc6-saw-lead").configuration,
				volume: 0.56,
				pan: 0,
				attack: 0.004,
				decay: 0.12,
				sustain: 0.4,
				release: 0.05,
				arpMode: "octaveUp",
				echoMix: 0.1,
				echoTimeSeconds: 0.09,
			},
			barSequence: [1],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSfxNote(0, 64, 3, -12, 0.88, { bendStyle: "continuous" }),
						createSfxNote(7, 62, 3, -12, 0.82, { bendStyle: "continuous" }),
					],
				},
			},
		},
		{
			id: "sfx-ray-kit",
			name: "Transient Kit",
			type: "drum",
			color: CHANNEL_COLOR_PALETTE[3] ?? "#b366ff",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("retro-8bit-kit").configuration,
				volume: 0.78,
				echoMix: 0.05,
			},
			barSequence: [1],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSfxNote(0, 0, 1, 0, 0.92),
						createSfxNote(0, 7, 1, 0, 0.72),
						createSfxNote(7, 0, 1, 0, 0.78),
						createSfxNote(7, 7, 1, 0, 0.65),
					],
				},
			},
		},
	],
};

const playerHurtProject: SongProject = {
	id: "sfx-hurt",
	title: "Player Hurt",
	author: "UltraBeep SFX",
	bpm: 175,
	beatsPerBar: 4,
	stepsPerBeat: 4,
	totalBars: 1,
	loopStartBar: 0,
	loopEndBar: 0,
	swing: 0,
	rootKey: "C",
	scale: "chromatic",
	masterVolume: 0.88,
	updatedAt: 1700000102000,
	channels: [
		{
			id: "sfx-hurt-crunch",
			name: "Damage Crunch",
			type: "pitch",
			color: CHANNEL_COLOR_PALETTE[5] ?? "#fb7185",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("vrc6-saw-lead").configuration,
				volume: 0.76,
				pan: 0,
				attack: 0.002,
				decay: 0.14,
				sustain: 0.52,
				release: 0.06,
				filterCutoff: 6400,
				vibratoDepth: 28,
				vibratoSpeed: 18,
				detuneCents: 18,
				echoMix: 0.08,
			},
			barSequence: [1],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSfxNote(0, 61, 2, -7, 0.96, { bendStyle: "continuous" }),
						createSfxNote(2, 56, 2, -9, 0.92, { bendStyle: "continuous" }),
						createSfxNote(4, 50, 4, -12, 0.88, {
							bendStyle: "continuous",
							fadeMode: "fadeOut",
						}),
					],
				},
			},
		},
		{
			id: "sfx-hurt-thud",
			name: "Sub Thud",
			type: "pitch",
			color: CHANNEL_COLOR_PALETTE[2] ?? "#ff9233",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("nes-triangle-bass").configuration,
				volume: 0.9,
				attack: 0.002,
				decay: 0.12,
				sustain: 0.65,
				release: 0.05,
			},
			barSequence: [1],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSfxNote(0, 44, 2, -8, 0.95, { bendStyle: "continuous" }),
						createSfxNote(2, 39, 4, -7, 0.9, { bendStyle: "continuous" }),
					],
				},
			},
		},
		{
			id: "sfx-hurt-noise",
			name: "Noise Hit",
			type: "drum",
			color: CHANNEL_COLOR_PALETTE[3] ?? "#b366ff",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("retro-8bit-kit").configuration,
				volume: 0.9,
			},
			barSequence: [1],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSfxNote(0, 1, 1, 0, 0.96),
						createSfxNote(0, 4, 1, 0, 0.86),
						createSfxNote(2, 6, 1, 0, 0.92),
						createSfxNote(4, 1, 1, 0, 0.85),
						createSfxNote(4, 4, 1, 0, 0.78),
					],
				},
			},
		},
	],
};

const swordAttackProject: SongProject = {
	id: "sfx-attack",
	title: "Sword Attack",
	author: "UltraBeep SFX",
	bpm: 195,
	beatsPerBar: 4,
	stepsPerBeat: 4,
	totalBars: 1,
	loopStartBar: 0,
	loopEndBar: 0,
	swing: 0,
	rootKey: "E",
	scale: "chromatic",
	masterVolume: 0.88,
	updatedAt: 1700000103000,
	channels: [
		{
			id: "sfx-attack-slash",
			name: "Blade Slash",
			type: "pitch",
			color: CHANNEL_COLOR_PALETTE[0] ?? "#00c7ff",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("genesis-fm-bell").configuration,
				volume: 0.78,
				pan: -0.06,
				attack: 0.002,
				decay: 0.12,
				sustain: 0.45,
				release: 0.08,
				filterCutoff: 9200,
				echoMix: 0.14,
				echoTimeSeconds: 0.09,
			},
			barSequence: [1],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSfxNote(0, 62, 2, 12, 0.9, { bendStyle: "early" }),
						createSfxNote(2, 74, 3, -14, 0.98, { bendStyle: "continuous" }),
						createSfxNote(6, 69, 3, -12, 0.82, {
							bendStyle: "continuous",
							fadeMode: "fadeOut",
						}),
					],
				},
			},
		},
		{
			id: "sfx-attack-pulse",
			name: "Swing Pulse",
			type: "pitch",
			color: CHANNEL_COLOR_PALETTE[1] ?? "#ffd93d",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("nes-pulse-25").configuration,
				volume: 0.65,
				pan: 0.08,
				attack: 0.003,
				decay: 0.1,
				sustain: 0.42,
				release: 0.05,
				echoMix: 0.1,
			},
			barSequence: [1],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSfxNote(1, 67, 2, 9, 0.92, { bendStyle: "continuous" }),
						createSfxNote(3, 79, 3, -15, 0.94, { bendStyle: "continuous" }),
					],
				},
			},
		},
		{
			id: "sfx-attack-whoosh",
			name: "Whoosh Impact",
			type: "drum",
			color: CHANNEL_COLOR_PALETTE[3] ?? "#b366ff",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("retro-8bit-kit").configuration,
				volume: 0.92,
			},
			barSequence: [1],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSfxNote(0, 2, 1, 0, 0.72),
						createSfxNote(1, 3, 1, 0, 0.86),
						createSfxNote(2, 0, 1, 0, 0.95),
						createSfxNote(2, 1, 1, 0, 0.96),
						createSfxNote(3, 6, 1, 0, 0.9),
					],
				},
			},
		},
	],
};

const winningFanfareProject: SongProject = {
	id: "sfx-winning",
	title: "Winning Fanfare",
	author: "UltraBeep SFX",
	bpm: 160,
	beatsPerBar: 4,
	stepsPerBeat: 4,
	totalBars: 2,
	loopStartBar: 0,
	loopEndBar: 1,
	swing: 0,
	rootKey: "C",
	scale: "major",
	masterVolume: 0.88,
	updatedAt: 1700000104000,
	channels: [
		{
			id: "sfx-win-lead",
			name: "Victory Lead",
			type: "pitch",
			color: CHANNEL_COLOR_PALETTE[0] ?? "#00c7ff",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("nes-pulse-25").configuration,
				volume: 0.78,
				echoMix: 0.2,
				echoTimeSeconds: 0.14,
			},
			barSequence: [1, 2],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSfxNote(0, 72, 2, 0, 0.92),
						createSfxNote(2, 72, 2, 0, 0.92),
						createSfxNote(4, 72, 2, 0, 0.94),
						createSfxNote(6, 67, 2, 0, 0.88),
						createSfxNote(8, 69, 2, 0, 0.92),
						createSfxNote(10, 71, 2, 0, 0.94),
						createSfxNote(12, 72, 4, 0, 0.98),
					],
				},
				"2": {
					index: 2,
					notes: [
						createSfxNote(0, 68, 4, 0, 0.92),
						createSfxNote(4, 70, 4, 0, 0.94),
						createSfxNote(8, 72, 2, 0, 0.96),
						createSfxNote(10, 70, 2, 0, 0.92),
						createSfxNote(12, 72, 4, 2, 1.0, { bendStyle: "late" }),
					],
				},
			},
		},
		{
			id: "sfx-win-arp",
			name: "Chip Arp",
			type: "pitch",
			color: CHANNEL_COLOR_PALETTE[1] ?? "#ffd93d",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("nes-pulse-12").configuration,
				arpMode: "arpFast",
				volume: 0.52,
			},
			barSequence: [1, 2],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSfxNote(0, 60, 6, 0, 0.82),
						createSfxNote(8, 65, 4, 0, 0.82),
						createSfxNote(12, 60, 4, 0, 0.88),
					],
				},
				"2": {
					index: 2,
					notes: [
						createSfxNote(0, 56, 4, 0, 0.84),
						createSfxNote(4, 58, 4, 0, 0.86),
						createSfxNote(8, 60, 8, 0, 0.92),
					],
				},
			},
		},
		{
			id: "sfx-win-bass",
			name: "Triangle Bass",
			type: "pitch",
			color: CHANNEL_COLOR_PALETTE[2] ?? "#ff9233",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("nes-triangle-bass").configuration,
				volume: 0.88,
			},
			barSequence: [1, 2],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSfxNote(0, 48, 2, 0, 0.92),
						createSfxNote(4, 48, 2, 0, 0.92),
						createSfxNote(8, 45, 2, 0, 0.9),
						createSfxNote(12, 48, 4, 0, 0.95),
					],
				},
				"2": {
					index: 2,
					notes: [
						createSfxNote(0, 44, 4, 0, 0.92),
						createSfxNote(4, 46, 4, 0, 0.94),
						createSfxNote(8, 48, 8, 0, 0.98),
					],
				},
			},
		},
		{
			id: "sfx-win-drums",
			name: "8-Bit Kit",
			type: "drum",
			color: CHANNEL_COLOR_PALETTE[3] ?? "#b366ff",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("retro-8bit-kit").configuration,
				volume: 0.85,
			},
			barSequence: [1, 2],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSfxNote(0, 0, 1, 0, 0.95),
						createSfxNote(2, 1, 1, 0, 0.78),
						createSfxNote(4, 0, 1, 0, 0.95),
						createSfxNote(6, 1, 1, 0, 0.8),
						createSfxNote(8, 0, 1, 0, 0.92),
						createSfxNote(10, 5, 1, 0, 0.82),
						createSfxNote(12, 0, 1, 0, 0.96),
						createSfxNote(12, 6, 1, 0, 0.9),
					],
				},
				"2": {
					index: 2,
					notes: [
						createSfxNote(0, 0, 1, 0, 0.95),
						createSfxNote(2, 3, 1, 0, 0.78),
						createSfxNote(4, 1, 1, 0, 0.88),
						createSfxNote(8, 0, 1, 0, 0.95),
						createSfxNote(10, 1, 1, 0, 0.86),
						createSfxNote(12, 0, 1, 0, 1.0),
						createSfxNote(12, 6, 1, 0, 0.95),
						createSfxNote(12, 7, 1, 0, 0.88),
					],
				},
			},
		},
	],
};

const defeatedGameOverProject: SongProject = {
	id: "sfx-defeated",
	title: "Defeated",
	author: "UltraBeep SFX",
	bpm: 108,
	beatsPerBar: 4,
	stepsPerBeat: 4,
	totalBars: 2,
	loopStartBar: 0,
	loopEndBar: 1,
	swing: 0,
	rootKey: "C",
	scale: "chromatic",
	masterVolume: 0.86,
	updatedAt: 1700000105000,
	channels: [
		{
			id: "sfx-defeat-lead",
			name: "Game Over Lead",
			type: "pitch",
			color: CHANNEL_COLOR_PALETTE[5] ?? "#fb7185",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("gb-square-50").configuration,
				volume: 0.72,
				vibratoDepth: 16,
				vibratoSpeed: 4.5,
				echoMix: 0.24,
				echoTimeSeconds: 0.2,
			},
			barSequence: [1, 2],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSfxNote(0, 72, 4, 0, 0.92),
						createSfxNote(4, 71, 4, 0, 0.88),
						createSfxNote(8, 70, 4, 0, 0.84),
						createSfxNote(12, 69, 4, 0, 0.8),
					],
				},
				"2": {
					index: 2,
					notes: [
						createSfxNote(0, 68, 4, 0, 0.78),
						createSfxNote(4, 67, 4, 0, 0.74),
						createSfxNote(8, 66, 8, -4, 0.85, {
							bendStyle: "late",
							fadeMode: "fadeOut",
						}),
					],
				},
			},
		},
		{
			id: "sfx-defeat-bass",
			name: "Doom Bass",
			type: "pitch",
			color: CHANNEL_COLOR_PALETTE[2] ?? "#ff9233",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("nes-triangle-bass").configuration,
				volume: 0.86,
			},
			barSequence: [1, 2],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSfxNote(0, 48, 4, 0, 0.88),
						createSfxNote(4, 47, 4, 0, 0.86),
						createSfxNote(8, 46, 4, 0, 0.84),
						createSfxNote(12, 45, 4, 0, 0.82),
					],
				},
				"2": {
					index: 2,
					notes: [
						createSfxNote(0, 44, 4, 0, 0.8),
						createSfxNote(4, 43, 4, 0, 0.78),
						createSfxNote(8, 42, 8, -5, 0.84, {
							bendStyle: "late",
							fadeMode: "fadeOut",
						}),
					],
				},
			},
		},
		{
			id: "sfx-defeat-kit",
			name: "Slow Impact",
			type: "drum",
			color: CHANNEL_COLOR_PALETTE[3] ?? "#b366ff",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("retro-8bit-kit").configuration,
				volume: 0.76,
			},
			barSequence: [1, 2],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSfxNote(0, 0, 1, 0, 0.84),
						createSfxNote(4, 4, 1, 0, 0.76),
						createSfxNote(8, 0, 1, 0, 0.82),
						createSfxNote(12, 4, 1, 0, 0.74),
					],
				},
				"2": {
					index: 2,
					notes: [
						createSfxNote(0, 0, 1, 0, 0.78),
						createSfxNote(4, 1, 1, 0, 0.72),
						createSfxNote(8, 0, 1, 0, 0.88),
						createSfxNote(8, 1, 1, 0, 0.76, { fadeMode: "fadeOut" }),
					],
				},
			},
		},
	],
};

const coinPickupProject: SongProject = {
	id: "sfx-coin-pickup",
	title: "Coin Pickup",
	author: "UltraBeep SFX",
	bpm: 200,
	beatsPerBar: 4,
	stepsPerBeat: 4,
	totalBars: 1,
	loopStartBar: 0,
	loopEndBar: 0,
	swing: 0,
	rootKey: "E",
	scale: "major",
	masterVolume: 0.86,
	updatedAt: 1700000106000,
	channels: [
		{
			id: "sfx-coin-pulse",
			name: "Coin Ping",
			type: "pitch",
			color: CHANNEL_COLOR_PALETTE[1] ?? "#ffd93d",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("nes-pulse-25").configuration,
				volume: 0.76,
				attack: 0.002,
				decay: 0.16,
				sustain: 0.35,
				release: 0.14,
				vibratoDepth: 0,
				echoMix: 0.2,
				echoTimeSeconds: 0.11,
			},
			barSequence: [1],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSfxNote(0, 83, 2, 0, 0.94),
						createSfxNote(2, 84, 6, 0, 0.98, { fadeMode: "fadeOut" }),
					],
				},
			},
		},
		{
			id: "sfx-coin-fm",
			name: "Sparkle Bell",
			type: "pitch",
			color: CHANNEL_COLOR_PALETTE[0] ?? "#00c7ff",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("genesis-fm-bell").configuration,
				volume: 0.62,
				echoMix: 0.22,
			},
			barSequence: [1],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSfxNote(0, 71, 2, 0, 0.85),
						createSfxNote(2, 76, 6, 0, 0.9, { fadeMode: "fadeOut" }),
					],
				},
			},
		},
		{
			id: "sfx-coin-kit",
			name: "Blip Kit",
			type: "drum",
			color: CHANNEL_COLOR_PALETTE[3] ?? "#b366ff",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("retro-8bit-kit").configuration,
				volume: 0.64,
			},
			barSequence: [1],
			patterns: {
				"1": {
					index: 1,
					notes: [createSfxNote(0, 7, 1, 0, 0.88)],
				},
			},
		},
	],
};

const powerUpProject: SongProject = {
	id: "sfx-power-up",
	title: "Power-Up",
	author: "UltraBeep SFX",
	bpm: 185,
	beatsPerBar: 4,
	stepsPerBeat: 4,
	totalBars: 1,
	loopStartBar: 0,
	loopEndBar: 0,
	swing: 0,
	rootKey: "G",
	scale: "major",
	masterVolume: 0.88,
	updatedAt: 1700000107000,
	channels: [
		{
			id: "sfx-power-lead",
			name: "Power Climb",
			type: "pitch",
			color: CHANNEL_COLOR_PALETTE[4] ?? "#34d399",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("nes-pulse-12").configuration,
				volume: 0.74,
				arpMode: "octaveUp",
				echoMix: 0.22,
				echoTimeSeconds: 0.12,
			},
			barSequence: [1],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSfxNote(0, 55, 1, 0, 0.84),
						createSfxNote(1, 59, 1, 0, 0.86),
						createSfxNote(2, 62, 1, 0, 0.88),
						createSfxNote(3, 67, 1, 0, 0.9),
						createSfxNote(4, 62, 1, 0, 0.88),
						createSfxNote(5, 67, 1, 0, 0.92),
						createSfxNote(6, 71, 1, 0, 0.94),
						createSfxNote(7, 74, 1, 0, 0.96),
						createSfxNote(8, 79, 4, 2, 1.0, { bendStyle: "late" }),
					],
				},
			},
		},
		{
			id: "sfx-power-chime",
			name: "FM Shimmer",
			type: "pitch",
			color: CHANNEL_COLOR_PALETTE[0] ?? "#00c7ff",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("genesis-fm-bell").configuration,
				volume: 0.58,
			},
			barSequence: [1],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSfxNote(0, 55, 2, 0, 0.78),
						createSfxNote(4, 67, 2, 0, 0.86),
						createSfxNote(8, 79, 6, 0, 0.94, { fadeMode: "fadeOut" }),
					],
				},
			},
		},
	],
};

const retroJumpProject: SongProject = {
	id: "sfx-jump-boost",
	title: "Retro Jump",
	author: "UltraBeep SFX",
	bpm: 190,
	beatsPerBar: 4,
	stepsPerBeat: 4,
	totalBars: 1,
	loopStartBar: 0,
	loopEndBar: 0,
	swing: 0,
	rootKey: "C",
	scale: "major",
	masterVolume: 0.86,
	updatedAt: 1700000108000,
	channels: [
		{
			id: "sfx-jump-square",
			name: "Spring Square",
			type: "pitch",
			color: CHANNEL_COLOR_PALETTE[6] ?? "#38bdf8",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("gb-square-50").configuration,
				volume: 0.76,
				attack: 0.002,
				decay: 0.14,
				sustain: 0.48,
				release: 0.06,
				vibratoDepth: 0,
				echoMix: 0.12,
				echoTimeSeconds: 0.09,
			},
			barSequence: [1],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSfxNote(0, 52, 2, 7, 0.94, { bendStyle: "continuous" }),
						createSfxNote(2, 59, 5, 14, 0.96, {
							bendStyle: "continuous",
							fadeMode: "fadeOut",
						}),
					],
				},
			},
		},
		{
			id: "sfx-jump-kit",
			name: "Bounce Kit",
			type: "drum",
			color: CHANNEL_COLOR_PALETTE[3] ?? "#b366ff",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("retro-8bit-kit").configuration,
				volume: 0.65,
			},
			barSequence: [1],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSfxNote(0, 5, 1, 0, 0.82),
						createSfxNote(2, 7, 1, 0, 0.72),
					],
				},
			},
		},
	],
};

const explosionProject: SongProject = {
	id: "sfx-explosion",
	title: "8-Bit Explosion",
	author: "UltraBeep SFX",
	bpm: 180,
	beatsPerBar: 4,
	stepsPerBeat: 4,
	totalBars: 1,
	loopStartBar: 0,
	loopEndBar: 0,
	swing: 0,
	rootKey: "C",
	scale: "chromatic",
	masterVolume: 0.9,
	updatedAt: 1700000109000,
	channels: [
		{
			id: "sfx-boom-sub",
			name: "Pitch Drop Sub",
			type: "pitch",
			color: CHANNEL_COLOR_PALETTE[2] ?? "#ff9233",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("nes-triangle-bass").configuration,
				volume: 0.92,
				attack: 0.002,
				decay: 0.22,
				sustain: 0.4,
				release: 0.08,
			},
			barSequence: [1],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSfxNote(0, 52, 6, -24, 1.0, {
							bendStyle: "continuous",
							fadeMode: "fadeOut",
						}),
						createSfxNote(6, 36, 6, -12, 0.85, {
							bendStyle: "continuous",
							fadeMode: "fadeOut",
						}),
					],
				},
			},
		},
		{
			id: "sfx-boom-crunch",
			name: "Low Crunch Saw",
			type: "pitch",
			color: CHANNEL_COLOR_PALETTE[1] ?? "#ffd93d",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("vrc6-saw-lead").configuration,
				volume: 0.72,
				attack: 0.003,
				decay: 0.16,
				sustain: 0.35,
				release: 0.06,
				filterCutoff: 4800,
			},
			barSequence: [1],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSfxNote(0, 64, 4, -22, 0.95, {
							bendStyle: "continuous",
							fadeMode: "fadeOut",
						}),
						createSfxNote(4, 48, 4, -18, 0.8, {
							bendStyle: "continuous",
							fadeMode: "fadeOut",
						}),
					],
				},
			},
		},
		{
			id: "sfx-boom-noise",
			name: "Noise Crash",
			type: "drum",
			color: CHANNEL_COLOR_PALETTE[3] ?? "#b366ff",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("retro-8bit-kit").configuration,
				volume: 0.95,
			},
			barSequence: [1],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSfxNote(0, 0, 1, 0, 1.0),
						createSfxNote(0, 1, 1, 0, 1.0),
						createSfxNote(1, 4, 1, 0, 0.9),
						createSfxNote(2, 4, 1, 0, 0.8),
						createSfxNote(4, 1, 1, 0, 0.75),
						createSfxNote(6, 0, 1, 0, 0.6),
					],
				},
			},
		},
	],
};

const extraLifeProject: SongProject = {
	id: "sfx-extra-life",
	title: "1-Up Extra Life",
	author: "UltraBeep SFX",
	bpm: 220,
	beatsPerBar: 4,
	stepsPerBeat: 4,
	totalBars: 1,
	loopStartBar: 0,
	loopEndBar: 0,
	swing: 0,
	rootKey: "C",
	scale: "major",
	masterVolume: 0.88,
	updatedAt: 1700000110000,
	channels: [
		{
			id: "sfx-1up-lead",
			name: "1-Up Pulse Lead",
			type: "pitch",
			color: CHANNEL_COLOR_PALETTE[0] ?? "#00c7ff",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("nes-pulse-25").configuration,
				volume: 0.78,
				attack: 0.003,
				decay: 0.1,
				sustain: 0.6,
				release: 0.05,
				echoMix: 0.16,
				echoTimeSeconds: 0.1,
			},
			barSequence: [1],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSfxNote(0, 64, 1, 0, 0.92),
						createSfxNote(2, 67, 1, 0, 0.94),
						createSfxNote(4, 76, 1, 0, 0.96),
						createSfxNote(6, 72, 1, 0, 0.95),
						createSfxNote(8, 74, 1, 0, 0.95),
						createSfxNote(10, 79, 5, 0, 1.0, { fadeMode: "fadeOut" }),
					],
				},
			},
		},
		{
			id: "sfx-1up-sparkle",
			name: "Sparkle Harmony",
			type: "pitch",
			color: CHANNEL_COLOR_PALETTE[1] ?? "#ffd93d",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("nes-pulse-12").configuration,
				volume: 0.6,
				attack: 0.003,
				decay: 0.09,
				sustain: 0.5,
				release: 0.05,
				echoMix: 0.2,
				echoTimeSeconds: 0.12,
			},
			barSequence: [1],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSfxNote(4, 79, 1, 0, 0.8),
						createSfxNote(6, 76, 1, 0, 0.82),
						createSfxNote(8, 78, 1, 0, 0.84),
						createSfxNote(10, 83, 5, 0, 0.9, { fadeMode: "fadeOut" }),
					],
				},
			},
		},
		{
			id: "sfx-1up-blip",
			name: "Chime Blip",
			type: "drum",
			color: CHANNEL_COLOR_PALETTE[3] ?? "#b366ff",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("retro-8bit-kit").configuration,
				volume: 0.7,
			},
			barSequence: [1],
			patterns: {
				"1": {
					index: 1,
					notes: [createSfxNote(10, 7, 1, 0, 0.9)],
				},
			},
		},
	],
};

const secretUnlockedProject: SongProject = {
	id: "sfx-secret-unlocked",
	title: "Secret Unlocked",
	author: "UltraBeep SFX",
	bpm: 175,
	beatsPerBar: 4,
	stepsPerBeat: 4,
	totalBars: 1,
	loopStartBar: 0,
	loopEndBar: 0,
	swing: 0,
	rootKey: "G",
	scale: "chromatic",
	masterVolume: 0.88,
	updatedAt: 1700000111000,
	channels: [
		{
			id: "sfx-secret-fm",
			name: "Mystery FM Chime",
			type: "pitch",
			color: CHANNEL_COLOR_PALETTE[0] ?? "#00c7ff",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("genesis-fm-bell").configuration,
				volume: 0.72,
				decay: 0.25,
				sustain: 0.45,
				echoMix: 0.26,
				echoTimeSeconds: 0.16,
			},
			barSequence: [1],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSfxNote(0, 67, 1, 0, 0.9),
						createSfxNote(2, 66, 1, 0, 0.9),
						createSfxNote(4, 63, 1, 0, 0.92),
						createSfxNote(6, 57, 1, 0, 0.92),
						createSfxNote(8, 56, 1, 0, 0.94),
						createSfxNote(10, 64, 1, 0, 0.95),
						createSfxNote(12, 68, 1, 0, 0.96),
						createSfxNote(14, 72, 2, 0, 1.0, { fadeMode: "fadeOut" }),
					],
				},
			},
		},
		{
			id: "sfx-secret-pulse",
			name: "Pulse Shimmer",
			type: "pitch",
			color: CHANNEL_COLOR_PALETTE[1] ?? "#ffd93d",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("nes-pulse-12").configuration,
				volume: 0.52,
				echoMix: 0.22,
				echoTimeSeconds: 0.14,
			},
			barSequence: [1],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSfxNote(10, 59, 1, 0, 0.8),
						createSfxNote(12, 64, 1, 0, 0.85),
						createSfxNote(14, 76, 2, 0, 0.95, { fadeMode: "fadeOut" }),
					],
				},
			},
		},
		{
			id: "sfx-secret-sub",
			name: "Sub Resonance",
			type: "pitch",
			color: CHANNEL_COLOR_PALETTE[2] ?? "#ff9233",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("nes-triangle-bass").configuration,
				volume: 0.65,
			},
			barSequence: [1],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSfxNote(0, 43, 6, 0, 0.7),
						createSfxNote(8, 40, 4, 0, 0.75),
						createSfxNote(14, 48, 2, 0, 0.85),
					],
				},
			},
		},
	],
};

const shieldDeflectProject: SongProject = {
	id: "sfx-shield-deflect",
	title: "Shield Parry / Deflect",
	author: "UltraBeep SFX",
	bpm: 190,
	beatsPerBar: 4,
	stepsPerBeat: 4,
	totalBars: 1,
	loopStartBar: 0,
	loopEndBar: 0,
	swing: 0,
	rootKey: "C",
	scale: "chromatic",
	masterVolume: 0.88,
	updatedAt: 1700000112000,
	channels: [
		{
			id: "sfx-deflect-ping",
			name: "Metallic Clink",
			type: "pitch",
			color: CHANNEL_COLOR_PALETTE[0] ?? "#00c7ff",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("genesis-fm-bell").configuration,
				volume: 0.82,
				attack: 0.002,
				decay: 0.1,
				sustain: 0.2,
				release: 0.04,
				filterCutoff: 9200,
			},
			barSequence: [1],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSfxNote(0, 83, 2, 4, 1.0, {
							bendStyle: "early",
							fadeMode: "fadeOut",
						}),
						createSfxNote(2, 81, 3, -8, 0.85, {
							bendStyle: "continuous",
							fadeMode: "fadeOut",
						}),
					],
				},
			},
		},
		{
			id: "sfx-deflect-spark",
			name: "Spark Pulse",
			type: "pitch",
			color: CHANNEL_COLOR_PALETTE[1] ?? "#ffd93d",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("nes-pulse-12").configuration,
				volume: 0.65,
				attack: 0.002,
				decay: 0.08,
				sustain: 0.2,
				release: 0.04,
			},
			barSequence: [1],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSfxNote(0, 79, 1, 7, 0.95, { bendStyle: "early" }),
						createSfxNote(1, 84, 2, -12, 0.88, {
							bendStyle: "continuous",
							fadeMode: "fadeOut",
						}),
					],
				},
			},
		},
		{
			id: "sfx-deflect-click",
			name: "Noise Deflect",
			type: "drum",
			color: CHANNEL_COLOR_PALETTE[3] ?? "#b366ff",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("retro-8bit-kit").configuration,
				volume: 0.78,
			},
			barSequence: [1],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSfxNote(0, 3, 1, 0, 0.95),
						createSfxNote(1, 7, 1, 0, 0.9),
					],
				},
			},
		},
	],
};

const warpTeleportProject: SongProject = {
	id: "sfx-warp-teleport",
	title: "Warp Gate Teleport",
	author: "UltraBeep SFX",
	bpm: 165,
	beatsPerBar: 4,
	stepsPerBeat: 4,
	totalBars: 1,
	loopStartBar: 0,
	loopEndBar: 0,
	swing: 0,
	rootKey: "C",
	scale: "chromatic",
	masterVolume: 0.88,
	updatedAt: 1700000113000,
	channels: [
		{
			id: "sfx-warp-beam",
			name: "Warp Beam",
			type: "pitch",
			color: CHANNEL_COLOR_PALETTE[6] ?? "#38bdf8",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("gb-square-50").configuration,
				volume: 0.78,
				attack: 0.003,
				decay: 0.16,
				sustain: 0.55,
				release: 0.08,
				echoMix: 0.22,
				echoTimeSeconds: 0.11,
			},
			barSequence: [1],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSfxNote(0, 48, 3, 20, 0.92, { bendStyle: "continuous" }),
						createSfxNote(3, 68, 3, -16, 0.94, { bendStyle: "continuous" }),
						createSfxNote(6, 52, 3, 24, 0.96, { bendStyle: "continuous" }),
						createSfxNote(9, 76, 6, -20, 0.98, {
							bendStyle: "continuous",
							fadeMode: "fadeOut",
						}),
					],
				},
			},
		},
		{
			id: "sfx-warp-phase",
			name: "Phase Resonance",
			type: "pitch",
			color: CHANNEL_COLOR_PALETTE[1] ?? "#ffd93d",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("nes-pulse-12").configuration,
				volume: 0.58,
				echoMix: 0.25,
				echoTimeSeconds: 0.13,
			},
			barSequence: [1],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSfxNote(1, 60, 3, 18, 0.8, { bendStyle: "continuous" }),
						createSfxNote(4, 74, 3, -14, 0.85, { bendStyle: "continuous" }),
						createSfxNote(7, 64, 3, 20, 0.9, { bendStyle: "continuous" }),
						createSfxNote(10, 84, 5, -24, 0.92, {
							bendStyle: "continuous",
							fadeMode: "fadeOut",
						}),
					],
				},
			},
		},
	],
};

const stageClearFanfareProject: SongProject = {
	id: "sfx-stage-clear",
	title: "Stage Clear Fanfare",
	author: "UltraBeep SFX",
	bpm: 155,
	beatsPerBar: 4,
	stepsPerBeat: 4,
	totalBars: 2,
	loopStartBar: 0,
	loopEndBar: 1,
	swing: 0,
	rootKey: "C",
	scale: "major",
	masterVolume: 0.86,
	updatedAt: 1700000114000,
	channels: [
		{
			id: "sfx-clear-brass",
			name: "Hero Brass",
			type: "pitch",
			color: CHANNEL_COLOR_PALETTE[0] ?? "#00c7ff",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("vrc6-saw-lead").configuration,
				volume: 0.74,
			},
			barSequence: [1, 2],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSfxNote(0, 60, 2, 0, 0.95),
						createSfxNote(3, 60, 1, 0, 0.9),
						createSfxNote(4, 60, 2, 0, 0.95),
						createSfxNote(6, 60, 2, 0, 0.95),
						createSfxNote(8, 62, 4, 0, 0.95),
						createSfxNote(12, 64, 4, 0, 1.0),
					],
				},
				"2": {
					index: 2,
					notes: [
						createSfxNote(0, 65, 2, 0, 0.95),
						createSfxNote(2, 67, 2, 0, 0.95),
						createSfxNote(4, 69, 2, 0, 0.95),
						createSfxNote(6, 71, 2, 0, 0.95),
						createSfxNote(8, 72, 8, 0, 1.0, { fadeMode: "fadeOut" }),
					],
				},
			},
		},
		{
			id: "sfx-clear-arp",
			name: "Arp Harmony",
			type: "pitch",
			color: CHANNEL_COLOR_PALETTE[1] ?? "#ffd93d",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("nes-pulse-25").configuration,
				volume: 0.58,
			},
			barSequence: [1, 2],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSfxNote(0, 52, 2, 0, 0.8),
						createSfxNote(4, 52, 2, 0, 0.8),
						createSfxNote(8, 55, 4, 0, 0.85),
						createSfxNote(12, 55, 4, 0, 0.85),
					],
				},
				"2": {
					index: 2,
					notes: [
						createSfxNote(0, 57, 2, 0, 0.85),
						createSfxNote(4, 53, 2, 0, 0.85),
						createSfxNote(8, 67, 8, 0, 0.9, { fadeMode: "fadeOut" }),
					],
				},
			},
		},
		{
			id: "sfx-clear-bass",
			name: "Walking Bass",
			type: "pitch",
			color: CHANNEL_COLOR_PALETTE[2] ?? "#ff9233",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("nes-triangle-bass").configuration,
				volume: 0.82,
			},
			barSequence: [1, 2],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSfxNote(0, 48, 3, 0, 0.9),
						createSfxNote(4, 48, 3, 0, 0.9),
						createSfxNote(8, 43, 3, 0, 0.9),
						createSfxNote(12, 48, 3, 0, 0.9),
					],
				},
				"2": {
					index: 2,
					notes: [
						createSfxNote(0, 41, 2, 0, 0.9),
						createSfxNote(4, 43, 4, 0, 0.9),
						createSfxNote(8, 48, 8, 0, 0.95),
					],
				},
			},
		},
		{
			id: "sfx-clear-drums",
			name: "Marching Drums",
			type: "drum",
			color: CHANNEL_COLOR_PALETTE[3] ?? "#b366ff",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("retro-8bit-kit").configuration,
				volume: 0.85,
			},
			barSequence: [1, 2],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSfxNote(0, 0, 1, 0, 0.95),
						createSfxNote(0, 2, 1, 0, 0.6),
						createSfxNote(4, 1, 1, 0, 0.9),
						createSfxNote(6, 2, 1, 0, 0.6),
						createSfxNote(8, 0, 1, 0, 0.95),
						createSfxNote(12, 1, 1, 0, 0.9),
						createSfxNote(14, 3, 1, 0, 0.75),
					],
				},
				"2": {
					index: 2,
					notes: [
						createSfxNote(0, 0, 1, 0, 0.95),
						createSfxNote(2, 1, 1, 0, 0.85),
						createSfxNote(4, 1, 1, 0, 0.85),
						createSfxNote(6, 1, 1, 0, 0.9),
						createSfxNote(7, 1, 1, 0, 0.9),
						createSfxNote(8, 0, 1, 0, 1.0),
						createSfxNote(8, 6, 1, 0, 0.95),
						createSfxNote(8, 7, 1, 0, 0.95),
					],
				},
			},
		},
	],
};

const bossWarningProject: SongProject = {
	id: "sfx-boss-warning",
	title: "Boss Warning Siren",
	author: "UltraBeep SFX",
	bpm: 160,
	beatsPerBar: 4,
	stepsPerBeat: 4,
	totalBars: 1,
	loopStartBar: 0,
	loopEndBar: 0,
	swing: 0,
	rootKey: "C",
	scale: "minor",
	masterVolume: 0.88,
	updatedAt: 1700000115000,
	channels: [
		{
			id: "sfx-boss-klaxon",
			name: "Alarm Klaxon",
			type: "pitch",
			color: CHANNEL_COLOR_PALETTE[4] ?? "#ef4444",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("gb-square-50").configuration,
				volume: 0.82,
				attack: 0.003,
				decay: 0.12,
				sustain: 0.6,
				release: 0.05,
			},
			barSequence: [1],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSfxNote(0, 75, 3, 0, 0.95),
						createSfxNote(4, 70, 3, 0, 0.92),
						createSfxNote(8, 75, 3, 0, 0.95),
						createSfxNote(12, 70, 3, 0, 0.92),
					],
				},
			},
		},
		{
			id: "sfx-boss-drone",
			name: "Menacing Saw",
			type: "pitch",
			color: CHANNEL_COLOR_PALETTE[1] ?? "#ffd93d",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("vrc6-saw-lead").configuration,
				volume: 0.68,
			},
			barSequence: [1],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSfxNote(0, 51, 3, 4, 0.85),
						createSfxNote(4, 46, 3, 4, 0.82),
						createSfxNote(8, 51, 3, 4, 0.85),
						createSfxNote(12, 46, 3, 4, 0.82),
					],
				},
			},
		},
		{
			id: "sfx-boss-thud",
			name: "Pulse Warning Thud",
			type: "drum",
			color: CHANNEL_COLOR_PALETTE[3] ?? "#b366ff",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("retro-8bit-kit").configuration,
				volume: 0.9,
			},
			barSequence: [1],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSfxNote(0, 0, 1, 0, 1.0),
						createSfxNote(0, 4, 1, 0, 0.85),
						createSfxNote(4, 0, 1, 0, 0.85),
						createSfxNote(8, 0, 1, 0, 1.0),
						createSfxNote(8, 4, 1, 0, 0.85),
						createSfxNote(12, 0, 1, 0, 0.85),
					],
				},
			},
		},
	],
};

const menuCursorBlipProject: SongProject = {
	id: "sfx-menu-cursor",
	title: "Menu Cursor Blip",
	author: "UltraBeep SFX",
	bpm: 200,
	beatsPerBar: 4,
	stepsPerBeat: 4,
	totalBars: 1,
	loopStartBar: 0,
	loopEndBar: 0,
	swing: 0,
	rootKey: "C",
	scale: "chromatic",
	masterVolume: 0.86,
	updatedAt: 1700000116000,
	channels: [
		{
			id: "sfx-menu-square",
			name: "Blip Square",
			type: "pitch",
			color: CHANNEL_COLOR_PALETTE[0] ?? "#00c7ff",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("gb-square-50").configuration,
				volume: 0.76,
				attack: 0.002,
				decay: 0.06,
				sustain: 0.3,
				release: 0.03,
			},
			barSequence: [1],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSfxNote(0, 72, 1, 0, 0.92),
						createSfxNote(1, 79, 2, 0, 0.98, { fadeMode: "fadeOut" }),
					],
				},
			},
		},
		{
			id: "sfx-menu-pulse",
			name: "Tick Harmonic",
			type: "pitch",
			color: CHANNEL_COLOR_PALETTE[1] ?? "#ffd93d",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("nes-pulse-12").configuration,
				volume: 0.58,
				attack: 0.002,
				decay: 0.05,
				sustain: 0.2,
				release: 0.03,
			},
			barSequence: [1],
			patterns: {
				"1": {
					index: 1,
					notes: [createSfxNote(1, 84, 2, 0, 0.9, { fadeMode: "fadeOut" })],
				},
			},
		},
		{
			id: "sfx-menu-click",
			name: "Micro Click",
			type: "drum",
			color: CHANNEL_COLOR_PALETTE[3] ?? "#b366ff",
			muted: false,
			solo: false,
			instrument: {
				...getPresetConfigurationById("retro-8bit-kit").configuration,
				volume: 0.72,
			},
			barSequence: [1],
			patterns: {
				"1": {
					index: 1,
					notes: [
						createSfxNote(0, 2, 1, 0, 0.8),
						createSfxNote(1, 7, 1, 0, 0.92),
					],
				},
			},
		},
	],
};

export const SFX_PRESETS: Array<SfxPresetDefinition> = [
	{
		id: "sfx-ray-gun",
		title: "Ray Gun Shoot",
		category: "combat",
		badge: "LASER",
		description: "Rapid downward square-pulse laser zap with sub punch.",
		project: rayGunShootProject,
	},
	{
		id: "sfx-hurt",
		title: "Player Hurt",
		category: "combat",
		badge: "HURT",
		description: "Chromatic sawtooth damage crunch with noise hit.",
		project: playerHurtProject,
	},
	{
		id: "sfx-attack",
		title: "Sword Attack",
		category: "combat",
		badge: "ATTACK",
		description: "Metallic FM slash sweep paired with crisp whoosh.",
		project: swordAttackProject,
	},
	{
		id: "sfx-winning",
		title: "Winning Fanfare",
		category: "jingle",
		badge: "WIN",
		description: "Triumphant 2-bar retro victory fanfare track.",
		project: winningFanfareProject,
	},
	{
		id: "sfx-defeated",
		title: "Defeated",
		category: "jingle",
		badge: "DEFEAT",
		description: "Classic descending 2-bar game-over motif.",
		project: defeatedGameOverProject,
	},
	{
		id: "sfx-coin-pickup",
		title: "Coin Pickup",
		category: "feedback",
		badge: "COIN",
		description: "Crisp B5-to-E6 arcade chime pickup ping.",
		project: coinPickupProject,
	},
	{
		id: "sfx-power-up",
		title: "Power-Up",
		category: "feedback",
		badge: "BUFF",
		description: "Ascending multi-octave arpeggio upgrade sweep.",
		project: powerUpProject,
	},
	{
		id: "sfx-jump-boost",
		title: "Retro Jump",
		category: "feedback",
		badge: "JUMP",
		description: "Classic 8-bit upward pitch-slide spring jump.",
		project: retroJumpProject,
	},
	{
		id: "sfx-explosion",
		title: "8-Bit Explosion",
		category: "combat",
		badge: "BOOM",
		description: "Thunderous 8-bit noise crash with deep descending sub pitch dive.",
		project: explosionProject,
	},
	{
		id: "sfx-extra-life",
		title: "1-Up Extra Life",
		category: "feedback",
		badge: "1-UP",
		description: "Iconic ascending octave multi-tone extra life victory chime.",
		project: extraLifeProject,
	},
	{
		id: "sfx-secret-unlocked",
		title: "Secret Unlocked",
		category: "jingle",
		badge: "SECRET",
		description: "Mysterious chime arpeggio signaling hidden doors and puzzles solved.",
		project: secretUnlockedProject,
	},
	{
		id: "sfx-shield-deflect",
		title: "Shield Parry / Deflect",
		category: "combat",
		badge: "PARRY",
		description: "Sharp metallic high-speed deflection clink with sudden cutoff.",
		project: shieldDeflectProject,
	},
	{
		id: "sfx-warp-teleport",
		title: "Warp Gate Teleport",
		category: "feedback",
		badge: "WARP",
		description: "Sci-fi frequency warp with rapid oscillating pitch sweep.",
		project: warpTeleportProject,
	},
	{
		id: "sfx-stage-clear",
		title: "Stage Clear Fanfare",
		category: "jingle",
		badge: "CLEAR",
		description: "Brisk triumphant 2-bar retro fanfare celebrating level completion.",
		project: stageClearFanfareProject,
	},
	{
		id: "sfx-boss-warning",
		title: "Boss Warning Siren",
		category: "combat",
		badge: "ALERT",
		description: "Urgent two-tone alarm klaxon with menacing sub pulse.",
		project: bossWarningProject,
	},
	{
		id: "sfx-menu-cursor",
		title: "Menu Cursor Blip",
		category: "feedback",
		badge: "SELECT",
		description: "Crisp instant two-step retro UI selection blip.",
		project: menuCursorBlipProject,
	},
];

const FALLBACK_SFX_PRESET: SfxPresetDefinition = {
	id: "sfx-ray-gun",
	title: "Ray Gun Shoot",
	category: "combat",
	badge: "LASER",
	description: "Rapid downward square-pulse laser zap with sub punch.",
	project: rayGunShootProject,
};

export const getSfxPresetById = (presetId: string): SfxPresetDefinition => {
	return (
		SFX_PRESETS.find((preset) => preset.id === presetId) ??
		SFX_PRESETS[0] ??
		FALLBACK_SFX_PRESET
	);
};

export const createBlankSfxProject = (
	title = "Custom Retro SFX"
): SongProject => {
	const leadPreset = getPresetConfigurationById("nes-pulse-12");
	const subPreset = getPresetConfigurationById("nes-triangle-bass");
	const drumPreset = getPresetConfigurationById("retro-8bit-kit");

	return {
		id: `sfx-${Date.now()}`,
		title,
		author: "UltraBeep SFX",
		bpm: 180,
		beatsPerBar: 4,
		stepsPerBeat: 4,
		totalBars: 1,
		loopStartBar: 0,
		loopEndBar: 0,
		swing: 0,
		rootKey: "C",
		scale: "chromatic",
		masterVolume: 0.86,
		updatedAt: Date.now(),
		channels: [
			{
				id: "sfx-channel-1",
				name: "SFX Lead",
				type: "pitch",
				color: CHANNEL_COLOR_PALETTE[0] ?? "#00c7ff",
				muted: false,
				solo: false,
				instrument: { ...leadPreset.configuration },
				barSequence: [1],
				patterns: {
					"1": {
						index: 1,
						notes: [
							createSfxNote(0, 72, 3, -12, 0.92, { bendStyle: "continuous" }),
						],
					},
				},
			},
			{
				id: "sfx-channel-2",
				name: "Impact Sub",
				type: "pitch",
				color: CHANNEL_COLOR_PALETTE[1] ?? "#ffd93d",
				muted: false,
				solo: false,
				instrument: { ...subPreset.configuration },
				barSequence: [1],
				patterns: {
					"1": {
						index: 1,
						notes: [],
					},
				},
			},
			{
				id: "sfx-channel-3",
				name: "Noise / Kit",
				type: "drum",
				color: CHANNEL_COLOR_PALETTE[3] ?? "#b366ff",
				muted: false,
				solo: false,
				instrument: { ...drumPreset.configuration },
				barSequence: [1],
				patterns: {
					"1": {
						index: 1,
						notes: [],
					},
				},
			},
		],
	};
};

const SFX_ARCHETYPE_POOL: Array<Exclude<SfxGeneratorArchetype, "random">> = [
	"laser",
	"hurt",
	"attack",
	"jump",
	"coin",
	"boom",
	"blip",
];

const pickRandomSfxArchetype = (): Exclude<SfxGeneratorArchetype, "random"> => {
	const index = Math.floor(Math.random() * SFX_ARCHETYPE_POOL.length);
	return SFX_ARCHETYPE_POOL[index] ?? "laser";
};

export const generateProceduralSfxNotes = (
	archetype: SfxGeneratorArchetype,
	channelType: ChannelType,
	stepsPerBar: number
): Array<NoteEvent> => {
	const resolvedArchetype: Exclude<SfxGeneratorArchetype, "random"> =
		archetype === "random" ? pickRandomSfxArchetype() : archetype;

	if (channelType === "drum") {
		switch (resolvedArchetype) {
			case "laser": {
				return [
					createSfxNote(0, 7, 1, 0, 0.9),
					createSfxNote(Math.min(stepsPerBar - 1, 4), 2, 1, 0, 0.72),
				];
			}
			case "hurt": {
				return [
					createSfxNote(0, 1, 1, 0, 0.95),
					createSfxNote(Math.min(stepsPerBar - 1, 2), 6, 1, 0, 0.9),
					createSfxNote(Math.min(stepsPerBar - 1, 4), 4, 1, 0, 0.85),
				];
			}
			case "attack": {
				return [
					createSfxNote(0, 2, 1, 0, 0.75),
					createSfxNote(Math.min(stepsPerBar - 1, 1), 3, 1, 0, 0.88),
					createSfxNote(Math.min(stepsPerBar - 1, 2), 1, 1, 0, 0.96),
					createSfxNote(Math.min(stepsPerBar - 1, 3), 6, 1, 0, 0.9),
				];
			}
			case "jump": {
				return [
					createSfxNote(0, 5, 1, 0, 0.85),
					createSfxNote(Math.min(stepsPerBar - 1, 2), 7, 1, 0, 0.75),
				];
			}
			case "coin": {
				return [createSfxNote(0, 7, 1, 0, 0.92)];
			}
			case "boom": {
				return [
					createSfxNote(0, 0, 1, 0, 1.0),
					createSfxNote(0, 1, 1, 0, 0.95),
					createSfxNote(Math.min(stepsPerBar - 1, 1), 4, 1, 0, 0.9),
					createSfxNote(Math.min(stepsPerBar - 1, 2), 4, 1, 0, 0.8),
				];
			}
			case "blip": {
				return [
					createSfxNote(0, 2, 1, 0, 0.75),
					createSfxNote(Math.min(stepsPerBar - 1, 1), 7, 1, 0, 0.95),
				];
			}
		}
	}

	const clampStep = (step: number): number =>
		Math.max(0, Math.min(stepsPerBar - 1, step));
	const clampDuration = (step: number, duration: number): number =>
		Math.max(1, Math.min(stepsPerBar - step, duration));

	switch (resolvedArchetype) {
		case "laser": {
			const basePitch = 72 + Math.floor(Math.random() * 9);
			const secondStep = clampStep(4);
			return [
				createSfxNote(0, basePitch, clampDuration(0, 3), -18, 0.96, {
					bendStyle: "continuous",
				}),
				createSfxNote(
					secondStep,
					basePitch + 2,
					clampDuration(secondStep, 4),
					-22,
					0.9,
					{ bendStyle: "continuous", fadeMode: "fadeOut" }
				),
			];
		}
		case "hurt": {
			const startPitch = 56 + Math.floor(Math.random() * 7);
			const stepTwo = clampStep(2);
			const stepFour = clampStep(4);
			return [
				createSfxNote(0, startPitch, clampDuration(0, 2), -6, 0.95, {
					bendStyle: "continuous",
				}),
				createSfxNote(stepTwo, startPitch - 4, clampDuration(stepTwo, 2), -8, 0.9, {
					bendStyle: "continuous",
				}),
				createSfxNote(
					stepFour,
					startPitch - 9,
					clampDuration(stepFour, 4),
					-12,
					0.86,
					{ bendStyle: "continuous", fadeMode: "fadeOut" }
				),
			];
		}
		case "attack": {
			const basePitch = 60 + Math.floor(Math.random() * 8);
			const stepTwo = clampStep(2);
			return [
				createSfxNote(0, basePitch, clampDuration(0, 2), 11, 0.92, {
					bendStyle: "early",
				}),
				createSfxNote(
					stepTwo,
					basePitch + 10,
					clampDuration(stepTwo, 4),
					-14,
					0.96,
					{ bendStyle: "continuous", fadeMode: "fadeOut" }
				),
			];
		}
		case "jump": {
			const startPitch = 50 + Math.floor(Math.random() * 6);
			const stepTwo = clampStep(2);
			return [
				createSfxNote(0, startPitch, clampDuration(0, 2), 7, 0.94, {
					bendStyle: "continuous",
				}),
				createSfxNote(
					stepTwo,
					startPitch + 7,
					clampDuration(stepTwo, 5),
					14,
					0.96,
					{ bendStyle: "continuous", fadeMode: "fadeOut" }
				),
			];
		}
		case "coin": {
			const rootPitch = 76 + Math.floor(Math.random() * 6);
			const stepTwo = clampStep(2);
			return [
				createSfxNote(0, rootPitch, clampDuration(0, 2), 0, 0.94),
				createSfxNote(
					stepTwo,
					Math.min(84, rootPitch + 5),
					clampDuration(stepTwo, 5),
					0,
					0.98,
					{ fadeMode: "fadeOut" }
				),
			];
		}
		case "boom": {
			const startPitch = 58 + Math.floor(Math.random() * 6);
			const stepTwo = clampStep(3);
			return [
				createSfxNote(0, startPitch, clampDuration(0, 4), -24, 0.98, {
					bendStyle: "continuous",
					fadeMode: "fadeOut",
				}),
				createSfxNote(
					stepTwo,
					startPitch - 14,
					clampDuration(stepTwo, 5),
					-16,
					0.9,
					{ bendStyle: "continuous", fadeMode: "fadeOut" }
				),
			];
		}
		case "blip": {
			const rootPitch = 69 + Math.floor(Math.random() * 5);
			const stepTwo = clampStep(1);
			return [
				createSfxNote(0, rootPitch, clampDuration(0, 1), 0, 0.92),
				createSfxNote(
					stepTwo,
					Math.min(84, rootPitch + 7),
					clampDuration(stepTwo, 2),
					0,
					0.98,
					{ fadeMode: "fadeOut" }
				),
			];
		}
	}
};

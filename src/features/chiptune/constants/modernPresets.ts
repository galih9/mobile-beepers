import type {
	ChannelType,
	DelayDivision,
	InstrumentConfiguration,
	InstrumentPresetDefinition,
	ModernEngine,
	ModernInstrumentSettings,
	WaveformType,
} from "../types/music";

/**
 * Instrument presets for the modern music maker. Every preset carries a
 * `modern` block (engine + studio FX); the classic fields still hold volume,
 * pan and the ADSR envelope, and `waveform` is the closest retro voice (used
 * for MIDI export program numbers).
 */

export type ModernPresetGroup =
	| "keys"
	| "stringsPads"
	| "synths"
	| "bass"
	| "drums"
	| "samples";

export const MODERN_PRESET_GROUPS: Array<{
	id: ModernPresetGroup;
	label: string;
}> = [
	{ id: "keys", label: "Keys" },
	{ id: "stringsPads", label: "Strings & Pads" },
	{ id: "synths", label: "Synths" },
	{ id: "bass", label: "Bass" },
	{ id: "drums", label: "Drums" },
	{ id: "samples", label: "Your Samples" },
];

export interface ModernPresetDefinition extends InstrumentPresetDefinition {
	group: ModernPresetGroup;
}

export const MODERN_ENGINE_LABELS: Record<ModernEngine, string> = {
	grandPiano: "Grand Piano (sampled)",
	strings: "String Section (sampled)",
	harp: "Concert Harp (sampled)",
	superSaw: "Supersaw",
	pad: "Analog Pad",
	pluck: "Pluck",
	softLead: "Soft Lead",
	ePiano: "FM Electric Piano",
	bell: "FM Bell",
	reeseBass: "Reese Bass",
	subBass: "Sub / 808 Bass",
	drumKit: "Punchy Drum Kit",
	breakKit: "Jungle Break Kit",
	sampler: "Sampler (your sample)",
	slicer: "Break Slicer (your break)",
};

/** Engines whose sound comes from a recording rather than oscillators */
export const SAMPLED_ENGINES: ReadonlySet<ModernEngine> = new Set<ModernEngine>(
	["grandPiano", "strings", "harp", "sampler", "slicer"]
);

/** Engines that use the filter envelope / unison spread controls */
export const SYNTH_ENGINES: ReadonlySet<ModernEngine> = new Set<ModernEngine>([
	"superSaw",
	"pad",
	"pluck",
	"softLead",
	"reeseBass",
	"subBass",
]);

export const DELAY_DIVISION_OPTIONS: Array<{
	value: DelayDivision;
	label: string;
}> = [
	{ value: "32n", label: "1/32" },
	{ value: "16n", label: "1/16" },
	{ value: "8n", label: "1/8" },
	{ value: "8n.", label: "1/8 dotted" },
	{ value: "4n", label: "1/4" },
];

export const DEFAULT_MODERN_SETTINGS: Omit<ModernInstrumentSettings, "engine"> =
	{
		cutoff: 16_000,
		resonance: 0.7,
		filterEnv: 0,
		spread: 0,
		tune: 0,
		drive: 0,
		chorus: 0,
		delayMix: 0,
		delayDivision: "8n.",
		delayFeedback: 0.32,
		reverbSend: 0.15,
		sidechain: 0,
		lowCut: 20,
	};

const BASE_ENVELOPE: Omit<InstrumentConfiguration, "presetId" | "waveform"> = {
	volume: 0.75,
	pan: 0,
	attack: 0.004,
	decay: 0.3,
	sustain: 0.8,
	release: 0.3,
	filterCutoff: 12_000,
	vibratoDepth: 0,
	vibratoSpeed: 5,
	arpMode: "none",
	echoMix: 0,
	echoTimeSeconds: 0.2,
	detuneCents: 0,
};

const preset = (definition: {
	id: string;
	name: string;
	group: ModernPresetGroup;
	category?: ChannelType;
	description: string;
	waveform: WaveformType;
	envelope?: Partial<Omit<InstrumentConfiguration, "presetId" | "modern">>;
	modern: Partial<ModernInstrumentSettings> & { engine: ModernEngine };
}): ModernPresetDefinition => ({
	id: definition.id,
	name: definition.name,
	group: definition.group,
	category: definition.category ?? "pitch",
	description: definition.description,
	configuration: {
		...BASE_ENVELOPE,
		...definition.envelope,
		presetId: definition.id,
		waveform: definition.waveform,
		modern: { ...DEFAULT_MODERN_SETTINGS, ...definition.modern },
	},
});

export const MODERN_INSTRUMENT_PRESETS: Array<ModernPresetDefinition> = [
	// ── Keys ────────────────────────────────────────────────────────────────
	preset({
		id: "modern-grand-piano",
		name: "Grand Piano",
		group: "keys",
		description:
			"Real Salamander grand piano samples — velocity changes the tone like a real hammer. Bold chords and hooks.",
		waveform: "piano",
		envelope: {
			volume: 0.8,
			attack: 0.002,
			decay: 1.2,
			sustain: 1,
			release: 0.45,
		},
		modern: {
			engine: "grandPiano",
			cutoff: 17_000,
			reverbSend: 0.22,
			lowCut: 35,
		},
	}),
	preset({
		id: "modern-dream-piano",
		name: "Dream Piano",
		group: "keys",
		description:
			"The grand piano washed in chorus, dotted echoes and a big plate, gently pumping with the kick — the sewerslvt / hkmori piano.",
		waveform: "piano",
		envelope: {
			volume: 0.74,
			attack: 0.002,
			decay: 1.2,
			sustain: 1,
			release: 0.7,
		},
		modern: {
			engine: "grandPiano",
			cutoff: 11_000,
			chorus: 0.3,
			delayMix: 0.22,
			delayDivision: "8n.",
			delayFeedback: 0.38,
			reverbSend: 0.5,
			sidechain: 0.3,
			lowCut: 110,
		},
	}),
	preset({
		id: "modern-electric-piano",
		name: "Electric Piano",
		group: "keys",
		description:
			"Warm FM e-piano with a bell-like tine and chorus. Soft chords and lo-fi interludes.",
		waveform: "fm",
		envelope: {
			volume: 0.72,
			attack: 0.003,
			decay: 1.1,
			sustain: 0.35,
			release: 0.5,
		},
		modern: {
			engine: "ePiano",
			cutoff: 7000,
			chorus: 0.45,
			reverbSend: 0.22,
			lowCut: 60,
		},
	}),
	preset({
		id: "modern-glass-bells",
		name: "Glass Bells",
		group: "keys",
		description:
			"Glassy FM bells with long echoes — twinkling arps and toplines over breaks.",
		waveform: "fm",
		envelope: {
			volume: 0.55,
			attack: 0.002,
			decay: 1.4,
			sustain: 0.2,
			release: 1.2,
		},
		modern: {
			engine: "bell",
			cutoff: 12_000,
			delayMix: 0.3,
			delayDivision: "8n.",
			delayFeedback: 0.42,
			reverbSend: 0.45,
			lowCut: 250,
		},
	}),
	preset({
		id: "modern-harp",
		name: "Concert Harp",
		group: "keys",
		description:
			"Sampled concert harp — sparkling arpeggios and glissando-like runs.",
		waveform: "triangle",
		envelope: {
			volume: 0.78,
			attack: 0.002,
			decay: 1.5,
			sustain: 1,
			release: 0.8,
		},
		modern: { engine: "harp", reverbSend: 0.35, lowCut: 60 },
	}),

	// ── Strings & Pads ──────────────────────────────────────────────────────
	preset({
		id: "modern-string-section",
		name: "String Section",
		group: "stringsPads",
		description:
			"Sampled violins over cellos with a soft bow attack. Long, soothing melodies and swells.",
		waveform: "strings",
		envelope: {
			volume: 0.72,
			attack: 0.14,
			decay: 0.5,
			sustain: 1,
			release: 0.6,
		},
		modern: {
			engine: "strings",
			cutoff: 12_000,
			chorus: 0.12,
			reverbSend: 0.42,
			lowCut: 50,
		},
	}),
	preset({
		id: "modern-staccato-strings",
		name: "Staccato Strings",
		group: "stringsPads",
		description:
			"Short, punchy bowed strings — driving ostinatos for battle themes.",
		waveform: "strings",
		envelope: {
			volume: 0.7,
			attack: 0.006,
			decay: 0.18,
			sustain: 0.25,
			release: 0.16,
		},
		modern: {
			engine: "strings",
			cutoff: 14_000,
			reverbSend: 0.28,
			lowCut: 80,
		},
	}),
	preset({
		id: "modern-dream-pad",
		name: "Dream Pad",
		group: "stringsPads",
		description:
			"Wide detuned analog pad with a slow swell, chorus and a huge reverb that breathes with the kick.",
		waveform: "supersaw",
		envelope: {
			volume: 0.5,
			attack: 0.55,
			decay: 1,
			sustain: 0.85,
			release: 1.6,
		},
		modern: {
			engine: "pad",
			cutoff: 2600,
			resonance: 1,
			filterEnv: 0.8,
			spread: 22,
			chorus: 0.5,
			reverbSend: 0.6,
			sidechain: 0.55,
			lowCut: 180,
		},
	}),
	preset({
		id: "modern-glass-pad",
		name: "Glass Pad",
		group: "stringsPads",
		description:
			"Brighter, airier pad for intros and breakdowns — shimmer without mud.",
		waveform: "supersaw",
		envelope: {
			volume: 0.42,
			attack: 0.35,
			decay: 1,
			sustain: 0.9,
			release: 1.4,
		},
		modern: {
			engine: "pad",
			cutoff: 6500,
			filterEnv: 0.4,
			spread: 14,
			chorus: 0.6,
			delayMix: 0.15,
			reverbSend: 0.65,
			sidechain: 0.4,
			lowCut: 300,
		},
	}),

	// ── Synths ──────────────────────────────────────────────────────────────
	preset({
		id: "modern-supersaw-lead",
		name: "Supersaw Lead",
		group: "synths",
		description:
			"Seven detuned saws spread across the stereo field — the big trance / rave lead.",
		waveform: "supersaw",
		envelope: {
			volume: 0.58,
			attack: 0.005,
			decay: 0.35,
			sustain: 0.75,
			release: 0.28,
		},
		modern: {
			engine: "superSaw",
			cutoff: 7500,
			filterEnv: 1,
			spread: 28,
			delayMix: 0.2,
			delayDivision: "8n.",
			reverbSend: 0.25,
			sidechain: 0.25,
			lowCut: 120,
		},
	}),
	preset({
		id: "modern-rave-stab",
		name: "Rave Stab",
		group: "synths",
		description:
			"Short, punchy supersaw chord stab with a snappy filter — offbeat rave chords.",
		waveform: "supersaw",
		envelope: {
			volume: 0.55,
			attack: 0.003,
			decay: 0.18,
			sustain: 0.15,
			release: 0.14,
		},
		modern: {
			engine: "superSaw",
			cutoff: 2800,
			filterEnv: 2.2,
			spread: 24,
			drive: 0.2,
			reverbSend: 0.2,
			sidechain: 0.3,
			lowCut: 150,
		},
	}),
	preset({
		id: "modern-future-pluck",
		name: "Future Pluck",
		group: "synths",
		description:
			"Bright filter-envelope pluck with 1/16 echoes — melodic arps and chord rolls.",
		waveform: "sawtooth",
		envelope: {
			volume: 0.6,
			attack: 0.002,
			decay: 0.28,
			sustain: 0,
			release: 0.22,
		},
		modern: {
			engine: "pluck",
			cutoff: 800,
			resonance: 2,
			filterEnv: 3.6,
			spread: 12,
			delayMix: 0.28,
			delayDivision: "16n",
			delayFeedback: 0.3,
			reverbSend: 0.3,
			lowCut: 160,
		},
	}),
	preset({
		id: "modern-soft-lead",
		name: "Soft Lead",
		group: "synths",
		description:
			"Clean, round sine-triangle lead with a gentle delayed vibrato. Easy on the ears over long sessions.",
		waveform: "triangle",
		envelope: {
			volume: 0.62,
			attack: 0.012,
			decay: 0.4,
			sustain: 0.85,
			release: 0.22,
		},
		modern: {
			engine: "softLead",
			cutoff: 5200,
			delayMix: 0.18,
			delayDivision: "8n.",
			reverbSend: 0.28,
			lowCut: 150,
		},
	}),

	// ── Bass ────────────────────────────────────────────────────────────────
	preset({
		id: "modern-reese-bass",
		name: "Reese Bass",
		group: "bass",
		description:
			"Detuned, moving saw bass with a sub underneath and warm drive — the drum & bass / breakcore growl.",
		waveform: "sawtooth",
		envelope: {
			volume: 0.62,
			attack: 0.006,
			decay: 0.5,
			sustain: 0.9,
			release: 0.12,
		},
		modern: {
			engine: "reeseBass",
			cutoff: 950,
			resonance: 1.8,
			filterEnv: 0.6,
			spread: 18,
			drive: 0.45,
			sidechain: 0.35,
			lowCut: 25,
			reverbSend: 0,
		},
	}),
	preset({
		id: "modern-sub-bass",
		name: "Sub Bass",
		group: "bass",
		description:
			"Pure, deep sine sub that sits under everything and ducks out of the kick's way.",
		waveform: "triangle",
		envelope: {
			volume: 0.72,
			attack: 0.004,
			decay: 0.4,
			sustain: 0.95,
			release: 0.08,
		},
		modern: {
			engine: "subBass",
			cutoff: 900,
			sidechain: 0.4,
			lowCut: 20,
			reverbSend: 0,
		},
	}),
	preset({
		id: "modern-808",
		name: "Distorted 808",
		group: "bass",
		description:
			"Long, saturated 808 — play it on the chord roots under the kicks; legato notes glide.",
		waveform: "sub808",
		envelope: {
			volume: 0.66,
			attack: 0.003,
			decay: 1.2,
			sustain: 0.55,
			release: 0.25,
		},
		modern: {
			engine: "subBass",
			cutoff: 2400,
			drive: 0.6,
			lowCut: 20,
			reverbSend: 0,
		},
	}),

	// ── Drums ───────────────────────────────────────────────────────────────
	preset({
		id: "modern-break-kit",
		name: "Jungle Break Kit",
		group: "drums",
		category: "drum",
		description:
			"Acoustic-style break kit (round kick, ringing funk snare, ride) for programming amen-style breaks.",
		waveform: "retroKit",
		envelope: { volume: 0.82 },
		modern: {
			engine: "breakKit",
			drive: 0.25,
			reverbSend: 0.1,
			lowCut: 25,
		},
	}),
	preset({
		id: "modern-crushed-breaks",
		name: "Crushed Breaks",
		group: "drums",
		category: "drum",
		description:
			"The break kit pitched up and driven hard — the loud, smashed breakcore drum sound.",
		waveform: "retroKit",
		envelope: { volume: 0.78 },
		modern: {
			engine: "breakKit",
			tune: 2,
			drive: 0.7,
			reverbSend: 0.06,
			lowCut: 30,
		},
	}),
	preset({
		id: "modern-punch-kit",
		name: "Punchy Kit",
		group: "drums",
		category: "drum",
		description:
			"Clean modern electronic kit: deep kick, crisp snare and clap, tight hats, crash.",
		waveform: "retroKit",
		envelope: { volume: 0.8 },
		modern: {
			engine: "drumKit",
			drive: 0.15,
			reverbSend: 0.08,
			lowCut: 20,
		},
	}),

	// ── Your samples ────────────────────────────────────────────────────────
	preset({
		id: "modern-break-slicer",
		name: "Break Slicer",
		group: "samples",
		description:
			"Load your own drum break: it's chopped into equal slices, one per key (C3 = slice 1), and stretched to the song tempo. Re-arrange slices to make chopped breaks.",
		waveform: "retroKit",
		envelope: {
			volume: 0.85,
			attack: 0.001,
			decay: 0.1,
			sustain: 1,
			release: 0.03,
		},
		modern: {
			engine: "slicer",
			sliceCount: 16,
			sliceBars: 1,
			fitToTempo: true,
			drive: 0.15,
			reverbSend: 0.05,
			lowCut: 25,
		},
	}),
	preset({
		id: "modern-sampler",
		name: "Sampler",
		group: "samples",
		description:
			"Load any sound (vocal chop, one-shot, texture) and play it chromatically — C4 is the original pitch.",
		waveform: "triangle",
		envelope: {
			volume: 0.8,
			attack: 0.003,
			decay: 0.3,
			sustain: 1,
			release: 0.15,
		},
		modern: {
			engine: "sampler",
			sampleRootMidi: 60,
			reverbSend: 0.2,
			lowCut: 40,
		},
	}),
];

export const MODERN_DEFAULT_PRESET_IDS: Record<ChannelType, string> = {
	pitch: "modern-grand-piano",
	drum: "modern-break-kit",
};

export const getModernPresetById = (
	presetId: string
): ModernPresetDefinition | undefined =>
	MODERN_INSTRUMENT_PRESETS.find((candidate) => candidate.id === presetId);

export const isModernPresetId = (presetId: string): boolean =>
	MODERN_INSTRUMENT_PRESETS.some((candidate) => candidate.id === presetId);

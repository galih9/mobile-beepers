import { createStore, del, get, set } from "idb-keyval";
import type { ModernEngine, SongProject } from "../../types/music";

/**
 * Sample library for the modern engine.
 *
 * Built-in instruments are real recordings shipped as npm packages and copied
 * to public/samples/ by vite.config.ts:
 *   - piano:  Salamander Grand Piano V3 (Alexander Holm, CC-BY 3.0) — 30 zones
 *   - violin / cello: tonejs-instruments (Nicholaus Brosowsky, CC-BY 3.0)
 *   - harp:   tonejs-instruments (CC-BY 3.0)
 *
 * User samples (one-shots, vocal chops, drum breaks) are stored in IndexedDB
 * so they survive reloads without bloating the localStorage project save.
 * Decoded buffers are shared by the live player, previews and WAV export.
 */

export type BuiltInInstrument = "piano" | "strings" | "harp";

export interface SampleZone {
	buffer: AudioBuffer;
	/** MIDI note the recording was played at */
	rootMidi: number;
}

export type SampleStatus = "idle" | "loading" | "ready" | "missing" | "error";

interface ZoneSource {
	folder: string;
	file: string;
	rootMidi: number;
}

const NOTE_PITCH_CLASS: Record<string, number> = {
	C: 0,
	D: 2,
	E: 4,
	F: 5,
	G: 7,
	A: 9,
	B: 11,
};

/** "Ds3" → 51, "A0" → 21 ("s" = sharp, matching the copied file names) */
export const sampleNoteNameToMidi = (name: string): number => {
	const match = /^([A-G])(s?)(-?\d)$/.exec(name);
	if (!match) {
		return 60;
	}
	const [, letter = "C", sharp, octave = "4"] = match;
	return (
		(Number.parseInt(octave, 10) + 1) * 12 +
		(NOTE_PITCH_CLASS[letter] ?? 0) +
		(sharp ? 1 : 0)
	);
};

const zonesFrom = (folder: string, names: Array<string>): Array<ZoneSource> =>
	names.map((name) => ({
		folder,
		file: `${name}.mp3`,
		rootMidi: sampleNoteNameToMidi(name),
	}));

const PIANO_NAMES = [
	"A0",
	...[1, 2, 3, 4, 5, 6, 7].flatMap((octave) => [
		`C${octave}`,
		`Ds${octave}`,
		`Fs${octave}`,
		`A${octave}`,
	]),
	"C8",
];

/** Cello below G3, violin from G3 up — a small string section */
const CELLO_NAMES = ["C2", "Ds2", "F2", "Gs2", "B2", "D3", "F3"];
const VIOLIN_NAMES = [
	"G3",
	"A3",
	"C4",
	"E4",
	"G4",
	"A4",
	"C5",
	"E5",
	"G5",
	"A5",
	"C6",
	"E6",
	"G6",
	"A6",
	"C7",
];
const HARP_NAMES = [
	"E1",
	"G1",
	"B1",
	"D2",
	"F2",
	"A2",
	"C3",
	"E3",
	"G3",
	"B3",
	"D4",
	"F4",
	"A4",
	"C5",
	"E5",
	"G5",
	"B5",
	"D6",
	"F6",
	"A6",
	"B6",
	"D7",
	"F7",
];

export const BUILT_IN_SAMPLE_ZONES: Record<
	BuiltInInstrument,
	Array<ZoneSource>
> = {
	piano: zonesFrom("piano", PIANO_NAMES),
	strings: [
		...zonesFrom("cello", CELLO_NAMES),
		...zonesFrom("violin", VIOLIN_NAMES),
	],
	harp: zonesFrom("harp", HARP_NAMES),
};

export const ENGINE_SAMPLE_INSTRUMENT: Partial<
	Record<ModernEngine, BuiltInInstrument>
> = {
	grandPiano: "piano",
	strings: "strings",
	harp: "harp",
};

// ─── Fetch + decode (overridable for Node render scripts / tests) ────────────

type ArrayBufferFetcher = (url: string) => Promise<ArrayBuffer>;

let fetchArrayBuffer: ArrayBufferFetcher = async (url) => {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Sample request failed (${response.status}): ${url}`);
	}
	return response.arrayBuffer();
};

const readBaseUrl = (): string => {
	try {
		return import.meta.env.BASE_URL ?? "/";
	} catch {
		return "/";
	}
};

let sampleBaseUrl = `${readBaseUrl()}samples/`;

let decodeContext: BaseAudioContext | null = null;

const getDecodeContext = (): BaseAudioContext | null => {
	if (decodeContext) {
		return decodeContext;
	}
	if (typeof OfflineAudioContext === "undefined") {
		return null;
	}
	decodeContext = new OfflineAudioContext(2, 1, 44100);
	return decodeContext;
};

/** For Node scripts: read sample files from disk and decode with node-web-audio-api */
export const configureSampleLoading = (options: {
	fetcher?: ArrayBufferFetcher;
	decoder?: BaseAudioContext;
	baseUrl?: string;
}): void => {
	if (options.fetcher) {
		fetchArrayBuffer = options.fetcher;
	}
	if (options.decoder) {
		decodeContext = options.decoder;
	}
	if (options.baseUrl !== undefined) {
		sampleBaseUrl = options.baseUrl;
	}
};

const decode = async (data: ArrayBuffer): Promise<AudioBuffer> => {
	const context = getDecodeContext();
	if (!context) {
		throw new Error("Web Audio is not available to decode samples");
	}
	// decodeAudioData detaches the buffer, so hand it a copy
	return context.decodeAudioData(data.slice(0));
};

// ─── Status listeners (UI shows "loading…" / "missing") ──────────────────────

const statusByKey = new Map<string, SampleStatus>();
const listeners = new Set<() => void>();
let statusVersion = 0;

const setStatus = (key: string, status: SampleStatus): void => {
	if (statusByKey.get(key) === status) {
		return;
	}
	statusByKey.set(key, status);
	statusVersion += 1;
	listeners.forEach((listener) => {
		listener();
	});
};

export const subscribeSampleStatus = (listener: () => void): (() => void) => {
	listeners.add(listener);
	return (): void => {
		listeners.delete(listener);
	};
};

/** Changes whenever any sample finishes loading (for useSyncExternalStore) */
export const getSampleStatusVersion = (): number => statusVersion;

// ─── Built-in instruments ────────────────────────────────────────────────────

const loadedZones = new Map<BuiltInInstrument, Array<SampleZone>>();
const instrumentLoads = new Map<BuiltInInstrument, Promise<void>>();

const instrumentKey = (instrument: BuiltInInstrument): string =>
	`builtin:${instrument}`;

export const getBuiltInInstrumentStatus = (
	instrument: BuiltInInstrument
): SampleStatus => statusByKey.get(instrumentKey(instrument)) ?? "idle";

export const loadBuiltInInstrument = (
	instrument: BuiltInInstrument
): Promise<void> => {
	const existing = instrumentLoads.get(instrument);
	if (existing) {
		return existing;
	}
	const key = instrumentKey(instrument);
	setStatus(key, "loading");
	const load = (async (): Promise<void> => {
		const sources = BUILT_IN_SAMPLE_ZONES[instrument];
		const zones: Array<SampleZone> = [];
		const results = await Promise.allSettled(
			sources.map(async (source) => {
				const data = await fetchArrayBuffer(
					`${sampleBaseUrl}${source.folder}/${source.file}`
				);
				return { buffer: await decode(data), rootMidi: source.rootMidi };
			})
		);
		for (const result of results) {
			if (result.status === "fulfilled") {
				zones.push(result.value);
			}
		}
		zones.sort((a, b) => a.rootMidi - b.rootMidi);
		loadedZones.set(instrument, zones);
		setStatus(key, zones.length > 0 ? "ready" : "error");
		if (zones.length === 0) {
			// Allow a retry later (e.g. dev server was still copying samples)
			instrumentLoads.delete(instrument);
		}
	})();
	instrumentLoads.set(instrument, load);
	return load;
};

/** Nearest recorded zone to a MIDI note, or null while still loading. */
export const getBuiltInZone = (
	instrument: BuiltInInstrument,
	midi: number
): SampleZone | null => {
	const zones = loadedZones.get(instrument);
	if (!zones || zones.length === 0) {
		return null;
	}
	let best = zones[0] ?? null;
	let bestDistance = Number.POSITIVE_INFINITY;
	for (const zone of zones) {
		// Prefer pitching samples down slightly (sounds more natural than up)
		const distance =
			Math.abs(zone.rootMidi - midi) + (zone.rootMidi < midi ? 0.1 : 0);
		if (distance < bestDistance) {
			best = zone;
			bestDistance = distance;
		}
	}
	return best;
};

// ─── User samples (IndexedDB) ────────────────────────────────────────────────

interface StoredUserSample {
	name: string;
	type: string;
	data: ArrayBuffer;
	createdAt: number;
}

export interface UserSampleInfo {
	id: string;
	name: string;
	durationSeconds: number;
}

let userSampleStore: ReturnType<typeof createStore> | null = null;

const getUserSampleStore = (): ReturnType<typeof createStore> | null => {
	if (typeof indexedDB === "undefined") {
		return null;
	}
	userSampleStore ??= createStore("ultrabeep-modern-samples", "samples");
	return userSampleStore;
};

const userBuffers = new Map<string, AudioBuffer>();
const userLoads = new Map<string, Promise<AudioBuffer | null>>();

const userKey = (sampleId: string): string => `user:${sampleId}`;

export const getUserSampleStatus = (sampleId: string): SampleStatus =>
	statusByKey.get(userKey(sampleId)) ?? "idle";

export const getUserSampleBuffer = (sampleId: string): AudioBuffer | null =>
	userBuffers.get(sampleId) ?? null;

/** Max size of an imported sample (keeps IndexedDB and memory sane) */
export const MAX_USER_SAMPLE_BYTES = 40 * 1024 * 1024;

/**
 * Decode an audio file the user picked (wav / mp3 / ogg / flac / m4a), keep
 * it in IndexedDB and return its id. Throws a readable error when the file
 * can't be decoded.
 */
export const importUserSampleFile = async (
	file: File
): Promise<UserSampleInfo> => {
	if (file.size > MAX_USER_SAMPLE_BYTES) {
		throw new Error("That file is over 40 MB — trim it to the part you need.");
	}
	const data = await file.arrayBuffer();
	let buffer: AudioBuffer;
	try {
		buffer = await decode(data);
	} catch {
		throw new Error(
			"Couldn't read that file as audio. Try a WAV, MP3, OGG or FLAC."
		);
	}
	const id = `smp-${Date.now().toString(36)}-${Math.random()
		.toString(36)
		.slice(2, 8)}`;
	const name = file.name.replace(/\.[^.]+$/, "") || "Sample";
	const store = getUserSampleStore();
	if (store) {
		const record: StoredUserSample = {
			name,
			type: file.type,
			data,
			createdAt: Date.now(),
		};
		await set(id, record, store);
	}
	userBuffers.set(id, buffer);
	userLoads.set(id, Promise.resolve(buffer));
	setStatus(userKey(id), "ready");
	return { id, name, durationSeconds: buffer.duration };
};

export const loadUserSample = (
	sampleId: string
): Promise<AudioBuffer | null> => {
	const existing = userLoads.get(sampleId);
	if (existing) {
		return existing;
	}
	const key = userKey(sampleId);
	setStatus(key, "loading");
	const load = (async (): Promise<AudioBuffer | null> => {
		try {
			const store = getUserSampleStore();
			const record = store
				? await get<StoredUserSample>(sampleId, store)
				: undefined;
			if (!record) {
				setStatus(key, "missing");
				return null;
			}
			const buffer = await decode(record.data);
			userBuffers.set(sampleId, buffer);
			setStatus(key, "ready");
			return buffer;
		} catch {
			setStatus(key, "error");
			return null;
		}
	})();
	userLoads.set(sampleId, load);
	return load;
};

export const deleteUserSample = async (sampleId: string): Promise<void> => {
	userBuffers.delete(sampleId);
	userLoads.delete(sampleId);
	const store = getUserSampleStore();
	if (store) {
		await del(sampleId, store);
	}
	setStatus(userKey(sampleId), "missing");
};

/** Register an already-decoded buffer as a user sample (Node render scripts, tests) */
export const registerUserSampleBuffer = (
	sampleId: string,
	buffer: AudioBuffer
): void => {
	userBuffers.set(sampleId, buffer);
	userLoads.set(sampleId, Promise.resolve(buffer));
	setStatus(userKey(sampleId), "ready");
};

// ─── Song-level preload ──────────────────────────────────────────────────────

/** Load every sample a song needs (built-in instruments + user samples). */
export const preloadSongSamples = async (
	song: Pick<SongProject, "channels">
): Promise<void> => {
	const tasks: Array<Promise<unknown>> = [];
	const seenInstruments = new Set<BuiltInInstrument>();
	for (const channel of song.channels) {
		const modern = channel.instrument.modern;
		if (!modern) {
			continue;
		}
		const instrument = ENGINE_SAMPLE_INSTRUMENT[modern.engine];
		if (instrument && !seenInstruments.has(instrument)) {
			seenInstruments.add(instrument);
			tasks.push(loadBuiltInInstrument(instrument));
		}
		if (
			(modern.engine === "sampler" || modern.engine === "slicer") &&
			modern.sampleId
		) {
			tasks.push(loadUserSample(modern.sampleId));
		}
	}
	await Promise.allSettled(tasks);
};

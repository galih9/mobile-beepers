import type {
	Channel,
	DelayDivision,
	InstrumentConfiguration,
	ModernInstrumentSettings,
	NoteEvent,
	SongProject,
} from "../../types/music";
import {
	buildOrnamentPitchEvents,
	DEFAULT_PLAYBACK_CONTEXT,
	resolveArticulationShape,
	resolveGateSteps,
	type NotePlaybackContext,
} from "../articulation";
import { resolveRatchetCount } from "../noteRatchet";
import {
	getSaturationCurve,
	isModernDrumEngine,
	scheduleModernVoice,
	type PitchPoint,
} from "./modernVoices";
import { preloadSongSamples } from "./sampleLibrary";

/**
 * The modern mixer: one FX strip per channel and a shared master bus.
 *
 *   voice → low cut → drive → chorus → pan → sidechain duck → fader ─┬→ master bus
 *                                                                   ├→ ping-pong delay → master bus
 *                                                                   └→ plate reverb → master bus
 *   master bus → glue compressor → limiter → destination
 *
 * A rack is created per destination node (the live player makes a new one on
 * every Play, WAV export makes one inside its OfflineAudioContext, previews
 * keep a persistent one), so live and exported mixes match.
 */

const clamp = (value: number, min: number, max: number): number =>
	Math.max(min, Math.min(max, value));

/** FX defaults — also used for retro chip channels inside a modern song */
export const NEUTRAL_MODERN_FX: Omit<ModernInstrumentSettings, "engine"> = {
	cutoff: 18_000,
	resonance: 0.7,
	filterEnv: 0,
	spread: 0,
	tune: 0,
	drive: 0,
	chorus: 0,
	delayMix: 0,
	delayDivision: "8n.",
	delayFeedback: 0.3,
	reverbSend: 0,
	sidechain: 0,
	lowCut: 20,
};

export const DELAY_DIVISION_BEATS: Record<DelayDivision, number> = {
	"32n": 0.125,
	"16n": 0.25,
	"8n": 0.5,
	"8n.": 0.75,
	"4n": 1,
};

const REVERB_SECONDS = 2.8;
const reverbImpulseCache = new WeakMap<BaseAudioContext, AudioBuffer>();

/** Smooth stereo plate: decorrelated noise, exponential decay, darkening tail */
const getReverbImpulse = (context: BaseAudioContext): AudioBuffer => {
	const cached = reverbImpulseCache.get(context);
	if (cached) {
		return cached;
	}
	const length = Math.floor(context.sampleRate * REVERB_SECONDS);
	const impulse = context.createBuffer(2, length, context.sampleRate);
	for (let channel = 0; channel < 2; channel += 1) {
		const data = impulse.getChannelData(channel);
		let seed = channel === 0 ? 0x1234_5678 : 0x0bad_f00d;
		let lowpassed = 0;
		for (let index = 0; index < length; index += 1) {
			seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
			const noise = (seed / 0xff_ff_ff_ff) * 2 - 1;
			const progress = index / length;
			// Damping: the tail gets darker as it decays, like a real room
			const damping = 0.15 + progress * 0.8;
			lowpassed += (noise - lowpassed) * (1 - damping);
			const envelope = Math.pow(1 - progress, 2.2) * Math.exp(-progress * 3);
			const fadeIn = Math.min(1, index / (context.sampleRate * 0.004));
			data[index] = lowpassed * envelope * fadeIn * 0.9;
		}
	}
	reverbImpulseCache.set(context, impulse);
	return impulse;
};

let safetyClipCurve: Float32Array<ArrayBuffer> | null = null;

/** Curve input u ∈ [-1, 1] stands for x = 2u (the clipper is fed at half level) */
const getSafetyClipCurve = (): Float32Array<ArrayBuffer> => {
	if (safetyClipCurve) {
		return safetyClipCurve;
	}
	const size = 4096;
	const knee = 0.8;
	const headroom = 0.18;
	safetyClipCurve = new Float32Array(new ArrayBuffer(size * 4));
	for (let index = 0; index < size; index += 1) {
		const x = ((index / (size - 1)) * 2 - 1) * 2;
		const magnitude = Math.abs(x);
		const shaped =
			magnitude <= knee
				? magnitude
				: knee + headroom * Math.tanh((magnitude - knee) / headroom);
		safetyClipCurve[index] = Math.sign(x) * shaped;
	}
	return safetyClipCurve;
};

/** Identity curve — used instead of `null` so every Web Audio engine accepts it */
const LINEAR_CURVE = new Float32Array(new ArrayBuffer(2 * 4));
LINEAR_CURVE[0] = -1;
LINEAR_CURVE[1] = 1;

const resolveStripSettings = (
	instrument: InstrumentConfiguration
): { fx: Omit<ModernInstrumentSettings, "engine">; isChip: boolean } => {
	if (instrument.modern) {
		return { fx: instrument.modern, isChip: false };
	}
	return { fx: NEUTRAL_MODERN_FX, isChip: true };
};

class ChannelStrip {
	public readonly input: GainNode;
	private readonly lowCut: BiquadFilterNode;
	private readonly shaper: WaveShaperNode;
	private readonly makeup: GainNode;
	private readonly chorusDry: GainNode;
	private readonly chorusWet: GainNode;
	private readonly panner: StereoPannerNode;
	private readonly duckGain: GainNode;
	private readonly fader: GainNode;
	private readonly delaySend: GainNode;
	private readonly delayLeft: DelayNode;
	private readonly delayRight: DelayNode;
	private readonly delayFeedback: GainNode;
	private readonly reverbSend: GainNode;
	private readonly lfo: OscillatorNode;
	private readonly nodes: Array<AudioNode> = [];
	private signature = "";
	public sidechainAmount = 0;

	public constructor(
		private readonly context: BaseAudioContext,
		mixBus: AudioNode,
		reverbInput: AudioNode
	) {
		const track = <T extends AudioNode>(node: T): T => {
			this.nodes.push(node);
			return node;
		};
		this.input = track(context.createGain());
		this.lowCut = track(context.createBiquadFilter());
		this.lowCut.type = "highpass";
		this.lowCut.Q.value = 0.7;
		this.shaper = track(context.createWaveShaper());
		this.shaper.oversample = "2x";
		this.makeup = track(context.createGain());

		// Chorus: two short modulated delays, one per side
		const chorusOut = track(context.createGain());
		this.chorusDry = track(context.createGain());
		this.chorusWet = track(context.createGain());
		const chorusLeft = track(context.createDelay(0.05));
		const chorusRight = track(context.createDelay(0.05));
		chorusLeft.delayTime.value = 0.012;
		chorusRight.delayTime.value = 0.017;
		const merger = track(context.createChannelMerger(2));
		this.lfo = track(context.createOscillator());
		this.lfo.frequency.value = 0.72;
		const lfoLeft = track(context.createGain());
		const lfoRight = track(context.createGain());
		lfoLeft.gain.value = 0.0024;
		lfoRight.gain.value = -0.0024;
		this.lfo.connect(lfoLeft);
		this.lfo.connect(lfoRight);
		lfoLeft.connect(chorusLeft.delayTime);
		lfoRight.connect(chorusRight.delayTime);

		this.panner = track(context.createStereoPanner());
		this.duckGain = track(context.createGain());
		this.fader = track(context.createGain());

		this.input.connect(this.lowCut);
		this.lowCut.connect(this.shaper);
		this.shaper.connect(this.makeup);
		this.makeup.connect(this.chorusDry);
		this.makeup.connect(chorusLeft);
		this.makeup.connect(chorusRight);
		chorusLeft.connect(merger, 0, 0);
		chorusRight.connect(merger, 0, 1);
		merger.connect(this.chorusWet);
		this.chorusDry.connect(chorusOut);
		this.chorusWet.connect(chorusOut);
		chorusOut.connect(this.panner);
		this.panner.connect(this.duckGain);
		this.duckGain.connect(this.fader);
		this.fader.connect(mixBus);

		// Ping-pong delay (left → right → left …), darkened on each repeat
		this.delaySend = track(context.createGain());
		this.delayLeft = track(context.createDelay(3));
		this.delayRight = track(context.createDelay(3));
		this.delayFeedback = track(context.createGain());
		const delayMerger = track(context.createChannelMerger(2));
		const delayTone = track(context.createBiquadFilter());
		delayTone.type = "lowpass";
		delayTone.frequency.value = 5200;
		const delayHighpass = track(context.createBiquadFilter());
		delayHighpass.type = "highpass";
		delayHighpass.frequency.value = 280;
		this.fader.connect(this.delaySend);
		this.delaySend.connect(this.delayLeft);
		this.delayLeft.connect(this.delayRight);
		this.delayRight.connect(this.delayFeedback);
		this.delayFeedback.connect(this.delayLeft);
		this.delayLeft.connect(delayMerger, 0, 0);
		this.delayRight.connect(delayMerger, 0, 1);
		delayMerger.connect(delayTone);
		delayTone.connect(delayHighpass);
		delayHighpass.connect(mixBus);

		this.reverbSend = track(context.createGain());
		this.fader.connect(this.reverbSend);
		this.reverbSend.connect(reverbInput);

		this.lfo.start();
	}

	/** Push the channel's current settings into the nodes (cheap when unchanged) */
	public apply(instrument: InstrumentConfiguration, bpm: number): void {
		const { fx, isChip } = resolveStripSettings(instrument);
		const nextSignature = JSON.stringify([
			fx,
			instrument.volume,
			instrument.pan,
			bpm,
			isChip,
		]);
		if (nextSignature === this.signature) {
			return;
		}
		const isFirstApply = this.signature === "";
		this.signature = nextSignature;
		const now = this.context.currentTime;
		const setParameter = (parameter: AudioParam, value: number): void => {
			if (isFirstApply) {
				parameter.value = value;
			} else {
				// Short glide so slider moves don't click (portable automation only)
				const current = parameter.value;
				parameter.cancelScheduledValues(now);
				parameter.setValueAtTime(current, now);
				parameter.linearRampToValueAtTime(value, now + 0.03);
			}
		};

		setParameter(this.lowCut.frequency, clamp(fx.lowCut, 10, 2000));
		const drive = clamp(fx.drive, 0, 1);
		this.shaper.curve =
			drive < 0.02 ? LINEAR_CURVE : getSaturationCurve(drive * 6);
		setParameter(this.makeup.gain, 1 / (1 + drive * 0.55));
		const chorus = clamp(fx.chorus, 0, 1);
		setParameter(this.chorusDry.gain, 1 - chorus * 0.35);
		setParameter(this.chorusWet.gain, chorus * 0.75);
		// Retro voices pan and set their own level inside the chip synth
		setParameter(this.panner.pan, isChip ? 0 : clamp(instrument.pan, -1, 1));
		setParameter(
			this.fader.gain,
			isChip ? 1 : clamp(instrument.volume, 0, 1.2)
		);
		const beatSeconds = 60 / Math.max(30, bpm);
		const delaySeconds = clamp(
			beatSeconds * (DELAY_DIVISION_BEATS[fx.delayDivision] ?? 0.75),
			0.02,
			1.5
		);
		setParameter(this.delayLeft.delayTime, delaySeconds);
		setParameter(this.delayRight.delayTime, delaySeconds);
		setParameter(this.delayFeedback.gain, clamp(fx.delayFeedback, 0, 0.85));
		setParameter(this.delaySend.gain, clamp(fx.delayMix, 0, 1) * 0.7);
		setParameter(this.reverbSend.gain, clamp(fx.reverbSend, 0, 1));
		this.sidechainAmount = clamp(fx.sidechain, 0, 1);
	}

	/** Last duck shape, so a kick that lands mid-recovery continues smoothly */
	private lastDuck: {
		start: number;
		startValue: number;
		bottom: number;
		floor: number;
		end: number;
	} | null = null;

	/**
	 * Sidechain pump: dip the strip's level for a kick, then ramp back up.
	 * Uses only setValueAtTime / linearRamp (portable across every Web Audio
	 * engine); overlapping kicks pick up from wherever the last ramp is.
	 */
	public duck(time: number, velocity: number, bpm: number): void {
		if (this.sidechainAmount <= 0.001) {
			return;
		}
		const depth = this.sidechainAmount * clamp(velocity, 0.3, 1) * 0.85;
		const floor = 1 - depth;
		const attackSeconds = 0.004;
		const releaseSeconds = 0.08 + (60 / Math.max(30, bpm)) * 0.42;
		const parameter = this.duckGain.gain;

		let currentValue = 1;
		const last = this.lastDuck;
		if (last && time < last.end) {
			if (time <= last.bottom) {
				const progress =
					(time - last.start) / Math.max(1e-6, last.bottom - last.start);
				currentValue =
					last.startValue +
					(last.floor - last.startValue) * clamp(progress, 0, 1);
			} else {
				const progress =
					(time - last.bottom) / Math.max(1e-6, last.end - last.bottom);
				currentValue = last.floor + (1 - last.floor) * clamp(progress, 0, 1);
			}
			parameter.cancelScheduledValues(time);
			parameter.linearRampToValueAtTime(currentValue, time);
		} else {
			parameter.setValueAtTime(1, time);
		}
		const bottom = time + attackSeconds;
		const end = bottom + releaseSeconds;
		const nextFloor = Math.min(floor, currentValue);
		parameter.linearRampToValueAtTime(nextFloor, bottom);
		parameter.linearRampToValueAtTime(1, end);
		this.lastDuck = {
			start: time,
			startValue: currentValue,
			bottom,
			floor: nextFloor,
			end,
		};
	}

	public dispose(): void {
		try {
			this.lfo.stop();
		} catch {
			// Already stopped
		}
		this.nodes.forEach((node) => {
			node.disconnect();
		});
	}
}

export class ModernRack {
	private readonly strips = new Map<string, ChannelStrip>();
	private readonly mixBus: GainNode;
	private readonly reverbInput: GainNode;
	private readonly nodes: Array<AudioNode> = [];
	private bpm = 120;
	private hasRequestedPreload = false;

	public constructor(
		private readonly context: BaseAudioContext,
		destination: AudioNode
	) {
		const track = <T extends AudioNode>(node: T): T => {
			this.nodes.push(node);
			return node;
		};
		this.mixBus = track(context.createGain());

		// Note: Web Audio compressors add automatic make-up gain (~0.6 × the
		// gain reduction at 0 dBFS), so thresholds here are kept gentle.
		const glue = track(context.createDynamicsCompressor());
		glue.threshold.value = -12;
		glue.knee.value = 6;
		glue.ratio.value = 2;
		glue.attack.value = 0.015;
		glue.release.value = 0.22;
		const limiter = track(context.createDynamicsCompressor());
		limiter.threshold.value = -2;
		limiter.knee.value = 0;
		limiter.ratio.value = 20;
		limiter.attack.value = 0.001;
		limiter.release.value = 0.06;
		const output = track(context.createGain());
		output.gain.value = 0.7;
		// Safety clipper: transparent below -2 dBFS, soft ceiling just under 0 dBFS
		const clipperInput = track(context.createGain());
		clipperInput.gain.value = 0.5;
		const clipper = track(context.createWaveShaper());
		clipper.curve = getSafetyClipCurve();
		this.mixBus.connect(glue);
		glue.connect(limiter);
		limiter.connect(output);
		output.connect(clipperInput);
		clipperInput.connect(clipper);
		clipper.connect(destination);

		this.reverbInput = track(context.createGain());
		const preDelay = track(context.createDelay(0.2));
		preDelay.delayTime.value = 0.022;
		const convolver = track(context.createConvolver());
		convolver.normalize = true;
		convolver.buffer = getReverbImpulse(context);
		const reverbHighpass = track(context.createBiquadFilter());
		reverbHighpass.type = "highpass";
		reverbHighpass.frequency.value = 220;
		const reverbReturn = track(context.createGain());
		reverbReturn.gain.value = 0.85;
		this.reverbInput.connect(preDelay);
		preDelay.connect(convolver);
		convolver.connect(reverbHighpass);
		reverbHighpass.connect(reverbReturn);
		reverbReturn.connect(this.mixBus);
	}

	/** Strip input for a channel — retro chip voices are scheduled straight into it */
	public getChannelInput(channel: Channel, bpm: number): AudioNode {
		return this.getStrip(channel, bpm).input;
	}

	private getStrip(channel: Channel, bpm: number): ChannelStrip {
		this.bpm = bpm;
		let strip = this.strips.get(channel.id);
		if (!strip) {
			strip = new ChannelStrip(this.context, this.mixBus, this.reverbInput);
			this.strips.set(channel.id, strip);
		}
		strip.apply(channel.instrument, bpm);
		return strip;
	}

	private duckAll(time: number, velocity: number): void {
		this.strips.forEach((strip) => {
			strip.duck(time, velocity, this.bpm);
		});
	}

	public scheduleNote(
		note: NoteEvent,
		channel: Channel,
		song: Pick<SongProject, "bpm"> & Partial<SongProject>,
		startTime: number,
		stepDurationSeconds: number,
		playbackContext: NotePlaybackContext = DEFAULT_PLAYBACK_CONTEXT
	): void {
		const settings = channel.instrument.modern;
		if (!settings) {
			return;
		}
		const isDrum = isModernDrumEngine(settings.engine);

		// Micro-timing nudge (never before "now")
		const timingOffsetSteps = note.timingOffset ?? 0;
		if (timingOffsetSteps !== 0 && Number.isFinite(timingOffsetSteps)) {
			this.scheduleNote(
				{ ...note, timingOffset: 0 },
				channel,
				song,
				Math.max(
					this.context.currentTime,
					startTime + timingOffsetSteps * stepDurationSeconds
				),
				stepDurationSeconds,
				playbackContext
			);
			return;
		}

		// Ratchet / stutter: retrigger across the note length
		const ratchetCount = resolveRatchetCount(note.ratchet);
		if (ratchetCount > 1) {
			const totalSeconds = Math.max(0.04, note.duration * stepDurationSeconds);
			const subSeconds = totalSeconds / ratchetCount;
			for (let hit = 0; hit < ratchetCount; hit += 1) {
				const progress = hit / (ratchetCount - 1);
				this.scheduleNote(
					{
						...note,
						ratchet: 1,
						duration: 1,
						pitch: isDrum
							? note.pitch
							: note.pitch + Math.round(note.pitchBend * progress),
						pitchBend: 0,
						ornament: undefined,
						velocity: Math.max(
							0.1,
							note.velocity * (hit === 0 ? 1 : 0.88 + 0.12 * progress)
						),
					},
					channel,
					song,
					startTime + hit * subSeconds,
					subSeconds
				);
			}
			return;
		}

		const strip = this.getStrip(channel, song.bpm);
		const shape = resolveArticulationShape(note.articulation);
		let gateSteps = resolveGateSteps(note);
		if (playbackContext.cutAfterSteps !== undefined) {
			gateSteps = Math.min(gateSteps, playbackContext.cutAfterSteps);
		}
		const endTime = startTime + Math.max(0.03, gateSteps * stepDurationSeconds);

		const pitchPoints: Array<PitchPoint> = [];
		if (!isDrum) {
			const slideFrom =
				note.articulation === "legato"
					? playbackContext.slideFromPitch
					: undefined;
			if (slideFrom !== undefined && slideFrom !== note.pitch) {
				pitchPoints.push(
					{ time: startTime, cents: (slideFrom - note.pitch) * 100 },
					{
						time: startTime + Math.min(0.07, stepDurationSeconds * 0.6),
						cents: 0,
						ramp: true,
					}
				);
			} else {
				pitchPoints.push({ time: startTime, cents: 0 });
			}
			if (note.ornament) {
				buildOrnamentPitchEvents(
					note.ornament,
					endTime - startTime,
					stepDurationSeconds,
					playbackContext
				).forEach((event) => {
					pitchPoints.push({
						time: startTime + event.time,
						cents: event.offset * 100,
					});
				});
			}
			if (note.pitchBend !== 0) {
				const length = endTime - startTime;
				const style = note.bendStyle ?? "late";
				const bendStart =
					style === "late" ? startTime + length * 0.55 : startTime + 0.005;
				const bendEnd = style === "early" ? startTime + length * 0.35 : endTime;
				pitchPoints.push(
					{ time: bendStart, cents: 0 },
					{ time: bendEnd, cents: note.pitchBend * 100, ramp: true }
				);
			}
			pitchPoints.sort((a, b) => a.time - b.time);
		}

		const played = scheduleModernVoice({
			context: this.context,
			output: strip.input,
			settings,
			instrument: channel.instrument,
			pitch: note.pitch,
			velocity: note.velocity * shape.gainMultiplier,
			startTime,
			endTime,
			pitchPoints,
			releaseScale: shape.releaseScale,
			minSustain: shape.minSustain,
			filterBoost: shape.filterBoost,
			...(shape.maxAttackSeconds !== undefined
				? { maxAttackSeconds: shape.maxAttackSeconds }
				: {}),
			...(note.filterCutoff !== undefined
				? { cutoffOverride: note.filterCutoff }
				: {}),
			...(note.filterSweepTo !== undefined
				? { cutoffSweepTo: note.filterSweepTo }
				: {}),
			bpm: song.bpm,
			onKick: (time, velocity) => {
				this.duckAll(time, velocity);
			},
		});

		// Samples not loaded yet: start loading so the next pass plays them
		if (!played && !this.hasRequestedPreload) {
			this.hasRequestedPreload = true;
			void preloadSongSamples({ channels: song.channels ?? [channel] });
		}
	}

	public dispose(): void {
		this.strips.forEach((strip) => {
			strip.dispose();
		});
		this.strips.clear();
		this.nodes.forEach((node) => {
			node.disconnect();
		});
	}
}

const racks = new WeakMap<AudioNode, ModernRack>();

export const getModernRack = (
	context: BaseAudioContext,
	destination: AudioNode
): ModernRack => {
	let rack = racks.get(destination);
	if (!rack) {
		rack = new ModernRack(context, destination);
		racks.set(destination, rack);
	}
	return rack;
};

export const disposeModernRack = (destination: AudioNode): void => {
	const rack = racks.get(destination);
	if (rack) {
		rack.dispose();
		racks.delete(destination);
	}
};

/** Does this song need the modern mixer? */
export const songUsesModernRack = (song: SongProject): boolean =>
	song.engine === "modern" ||
	song.channels.some((channel) => channel.instrument.modern !== undefined);

/** Seconds of reverb / delay / release that ring after the last note */
export const getModernTailSeconds = (song: SongProject): number => {
	let tail = 0.5;
	const beatSeconds = 60 / Math.max(30, song.bpm);
	for (const channel of song.channels) {
		const modern = channel.instrument.modern;
		if (!modern) {
			continue;
		}
		tail = Math.max(tail, channel.instrument.release * 1.5 + 0.2);
		if (modern.reverbSend > 0.01) {
			tail = Math.max(tail, REVERB_SECONDS);
		}
		if (modern.delayMix > 0.01) {
			const repeatSeconds =
				beatSeconds * (DELAY_DIVISION_BEATS[modern.delayDivision] ?? 0.75) * 2;
			const repeats =
				Math.log(0.01) / Math.log(Math.max(0.05, modern.delayFeedback));
			tail = Math.max(tail, Math.min(8, repeatSeconds * repeats));
		}
	}
	return tail;
};

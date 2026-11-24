import {
	createHumPitchDetector,
	DEFAULT_MIN_CLARITY,
	DEFAULT_MIN_RMS,
	HUM_DETECTOR_BUFFER_SIZE,
	type HumPitchDetectorHandle,
	type LivePitchReading,
} from "./humToNotes";

export type PitchReadingListener = (
	reading: LivePitchReading,
	timestampMs: number
) => void;

export interface MicrophoneTrackerOptions {
	minimumClarity?: number;
	minimumRms?: number;
}

const mapMicrophoneErrorMessage = (error: unknown): string => {
	if (error instanceof DOMException) {
		if (
			error.name === "NotAllowedError" ||
			error.name === "PermissionDeniedError"
		) {
			return "Microphone permission was denied. Allow mic access in your browser settings and try again.";
		}
		if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
			return "No microphone was found on this device.";
		}
		if (error.name === "NotReadableError" || error.name === "TrackStartError") {
			return "Your microphone is busy in another app. Close other audio apps and try again.";
		}
	}
	if (error instanceof Error && error.message.trim().length > 0) {
		return error.message;
	}
	return "Could not access microphone input.";
};

/**
 * Captures live microphone audio into an AnalyserNode (never routed to speakers)
 * and streams McLeod Pitch Method readings on each animation frame.
 */
export class MicrophonePitchTracker {
	private isActive = false;
	private mediaStream: MediaStream | null = null;
	private audioContext: AudioContext | null = null;
	private sourceNode: MediaStreamAudioSourceNode | null = null;
	private analyserNode: AnalyserNode | null = null;
	private animationFrameId: number | null = null;
	private readonly sampleBuffer: Float32Array<ArrayBuffer> = new Float32Array(
		new ArrayBuffer(HUM_DETECTOR_BUFFER_SIZE * 4)
	);
	private readonly detector: HumPitchDetectorHandle = createHumPitchDetector(
		HUM_DETECTOR_BUFFER_SIZE
	);
	private minimumClarity = DEFAULT_MIN_CLARITY;
	private minimumRms = DEFAULT_MIN_RMS;
	private onReadingCallback: PitchReadingListener | null = null;

	public getIsActive(): boolean {
		return this.isActive;
	}

	public updateThresholds(minimumClarity: number, minimumRms: number): void {
		this.minimumClarity = minimumClarity;
		this.minimumRms = minimumRms;
	}

	public async start(
		onReading: PitchReadingListener,
		options: MicrophoneTrackerOptions = {}
	): Promise<void> {
		this.stop();

		if (
			typeof navigator === "undefined" ||
			!navigator.mediaDevices ||
			typeof navigator.mediaDevices.getUserMedia !== "function"
		) {
			throw new Error(
				"Microphone capture requires HTTPS or localhost in a supported browser."
			);
		}
		if (typeof AudioContext === "undefined") {
			throw new Error("Web Audio API is unavailable in this browser.");
		}

		this.minimumClarity = options.minimumClarity ?? DEFAULT_MIN_CLARITY;
		this.minimumRms = options.minimumRms ?? DEFAULT_MIN_RMS;
		this.onReadingCallback = onReading;

		let stream: MediaStream;
		try {
			stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true,
				},
			});
		} catch (error: unknown) {
			throw new Error(mapMicrophoneErrorMessage(error));
		}

		try {
			const context = new AudioContext();
			if (context.state === "suspended") {
				await context.resume();
			}
			const source = context.createMediaStreamSource(stream);
			const analyser = context.createAnalyser();
			analyser.fftSize = HUM_DETECTOR_BUFFER_SIZE;
			analyser.smoothingTimeConstant = 0;

			// Route mic strictly into analyser (never to destination) so there is zero audio feedback
			source.connect(analyser);

			this.mediaStream = stream;
			this.audioContext = context;
			this.sourceNode = source;
			this.analyserNode = analyser;
			this.isActive = true;

			const poll = (): void => {
				if (!this.isActive || !this.analyserNode || !this.audioContext) {
					return;
				}
				this.analyserNode.getFloatTimeDomainData(this.sampleBuffer);
				const reading = this.detector.detect(
					this.sampleBuffer,
					this.audioContext.sampleRate,
					this.minimumClarity,
					this.minimumRms
				);
				this.onReadingCallback?.(reading, performance.now());
				this.animationFrameId = window.requestAnimationFrame(poll);
			};

			this.animationFrameId = window.requestAnimationFrame(poll);
		} catch (error: unknown) {
			stream.getTracks().forEach((track) => {
				track.stop();
			});
			throw new Error(mapMicrophoneErrorMessage(error));
		}
	}

	public stop(): void {
		this.isActive = false;
		this.onReadingCallback = null;
		if (this.animationFrameId !== null) {
			window.cancelAnimationFrame(this.animationFrameId);
			this.animationFrameId = null;
		}
		if (this.sourceNode) {
			try {
				this.sourceNode.disconnect();
			} catch {
				// Ignore already disconnected node
			}
			this.sourceNode = null;
		}
		if (this.analyserNode) {
			try {
				this.analyserNode.disconnect();
			} catch {
				// Ignore already disconnected node
			}
			this.analyserNode = null;
		}
		if (this.mediaStream) {
			this.mediaStream.getTracks().forEach((track) => {
				track.stop();
			});
			this.mediaStream = null;
		}
		if (this.audioContext) {
			void this.audioContext.close().catch(() => {
				// Ignore close errors on already closed context
			});
			this.audioContext = null;
		}
	}
}

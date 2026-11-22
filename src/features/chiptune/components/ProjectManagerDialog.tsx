import {
	ArrowDownTrayIcon,
	ArrowUpTrayIcon,
	BoltIcon,
	BookmarkSquareIcon,
	DocumentPlusIcon,
	FolderOpenIcon,
	MusicalNoteIcon,
	QueueListIcon,
	SpeakerWaveIcon,
	TrashIcon,
	XMarkIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import type { FunctionComponent } from "../../../common/types";
import { renderSongToMidiBlob } from "../audio/midiExporter";
import { downloadBlobAsFile, renderSongToWavBlob } from "../audio/wavExporter";
import { DEMO_SONGS } from "../constants/demoSongs";
import { MUSICAL_KEYS, SCALE_DEFINITIONS } from "../constants/scalesAndNotes";
import { SFX_PRESETS } from "../constants/sfxPresets";
import { useChiptuneStore } from "../store/useChiptuneStore";
import type { MusicalKey, ScaleType, SongProject } from "../types/music";
import type { DemoBrowserTab } from "./DemoSongBrowserDialog";
import { SliderControl } from "./SliderControl";

interface ProjectManagerDialogProps {
	isOpen: boolean;
	onClose: () => void;
	onOpenDemoBrowser: (initialTab?: DemoBrowserTab) => void;
	onRequestReset: () => void;
}

export const ProjectManagerDialog = ({
	isOpen,
	onClose,
	onOpenDemoBrowser,
	onRequestReset,
}: ProjectManagerDialogProps): FunctionComponent => {
	const titleId = useId();
	const dialogRef = useRef<HTMLDialogElement | null>(null);
	const fileInputRef = useRef<HTMLInputElement | null>(null);

	const [isExportingWav, setIsExportingWav] = useState(false);
	const [statusMessage, setStatusMessage] = useState<string | null>(null);

	const song = useChiptuneStore((state) => state.song);
	const savedSongs = useChiptuneStore((state) => state.savedSongs);
	const updateSongMetadata = useChiptuneStore(
		(state) => state.updateSongMetadata
	);
	const createNewProject = useChiptuneStore((state) => state.createNewProject);
	const importSongProject = useChiptuneStore(
		(state) => state.importSongProject
	);
	const saveCurrentSongToLibrary = useChiptuneStore(
		(state) => state.saveCurrentSongToLibrary
	);
	const loadSavedSong = useChiptuneStore((state) => state.loadSavedSong);
	const deleteSavedSong = useChiptuneStore((state) => state.deleteSavedSong);

	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) {
			return;
		}
		if (isOpen && !dialog.open) {
			dialog.showModal();
		} else if (!isOpen && dialog.open) {
			dialog.close();
		}
	}, [isOpen]);

	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) {
			return;
		}

		const handleNativeClose = (): void => {
			dialog.returnValue = "";
			onClose();
		};

		dialog.addEventListener("close", handleNativeClose);

		// Fallback light-dismiss when native closedby="any" is unsupported (e.g. Safari)
		if (!("closedBy" in HTMLDialogElement.prototype)) {
			let pressedOutside = false;
			const isPointerOutside = (event: PointerEvent): boolean => {
				const rectangle = dialog.getBoundingClientRect();
				return (
					event.clientX < rectangle.left ||
					event.clientX > rectangle.right ||
					event.clientY < rectangle.top ||
					event.clientY > rectangle.bottom
				);
			};

			const handlePointerDown = (event: PointerEvent): void => {
				pressedOutside = isPointerOutside(event);
			};
			const handlePointerUp = (event: PointerEvent): void => {
				if (pressedOutside && isPointerOutside(event)) {
					dialog.close();
				}
			};

			dialog.addEventListener("pointerdown", handlePointerDown);
			dialog.addEventListener("pointerup", handlePointerUp);
			return (): void => {
				dialog.removeEventListener("close", handleNativeClose);
				dialog.removeEventListener("pointerdown", handlePointerDown);
				dialog.removeEventListener("pointerup", handlePointerUp);
			};
		}

		return (): void => {
			dialog.removeEventListener("close", handleNativeClose);
		};
	}, [onClose]);

	const sanitizeFilename = (title: string): string => {
		const slug = title
			.toLowerCase()
			.split(/[^a-z0-9]+/)
			.filter(Boolean)
			.join("-");
		return slug || "ultrabeep-track";
	};

	const handleExportWav = async (): Promise<void> => {
		try {
			setIsExportingWav(true);
			setStatusMessage("Rendering offline stereo WAV...");
			const wavBlob = await renderSongToWavBlob(song, 1);
			downloadBlobAsFile(wavBlob, `${sanitizeFilename(song.title)}.wav`);
			setStatusMessage("WAV file exported offline!");
		} catch {
			setStatusMessage("Failed to render WAV audio.");
		} finally {
			setIsExportingWav(false);
		}
	};

	const handleExportMidi = (): void => {
		try {
			const midiBlob = renderSongToMidiBlob(song);
			downloadBlobAsFile(midiBlob, `${sanitizeFilename(song.title)}.mid`);
			setStatusMessage("Exported multi-track MIDI (.mid) file.");
		} catch {
			setStatusMessage("Failed to export MIDI file.");
		}
	};

	const handleExportJson = (): void => {
		const jsonText = JSON.stringify(song, null, 2);
		const blob = new Blob([jsonText], { type: "application/json" });
		downloadBlobAsFile(blob, `${sanitizeFilename(song.title)}.chiptune.json`);
		setStatusMessage("Saved .chiptune.json project file.");
	};

	const handleImportFile = async (
		event: ChangeEvent<HTMLInputElement>
	): Promise<void> => {
		const inputElement = event.currentTarget;
		const file = inputElement.files?.[0];
		if (!file) {
			return;
		}
		try {
			const text = await file.text();
			const parsed = JSON.parse(text) as SongProject;
			if (!parsed.channels || !Array.isArray(parsed.channels)) {
				setStatusMessage("Invalid chiptune JSON file.");
				return;
			}
			importSongProject(parsed);
			setStatusMessage(`Loaded "${parsed.title}"`);
			dialogRef.current?.close();
		} catch {
			setStatusMessage("Could not parse project JSON.");
		} finally {
			inputElement.value = "";
		}
	};

	return (
		<dialog
			ref={dialogRef}
			aria-labelledby={titleId}
			className="m-auto w-[min(94vw,36rem)] max-h-[88dvh] overflow-y-auto rounded-2xl border border-slate-700/80 bg-slate-900 p-4 text-slate-100 shadow-2xl"
			{...({ closedby: "any" } as Record<string, string>)}
		>
			<div className="mb-4 flex items-center justify-between gap-2 border-b border-slate-800 pb-3">
				<div>
					<h2 className="text-base font-bold text-white" id={titleId}>
						Song Settings, Demos & Offline Export
					</h2>
					<p className="text-xs text-slate-400">
						All audio synthesis, MIDI generation, and WAV rendering run 100%
						locally in your browser.
					</p>
				</div>
				<form method="dialog">
					<button
						autoFocus
						aria-label="Close song manager"
						className="flex size-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:text-white"
						type="submit"
						value="close"
					>
						<XMarkIcon aria-hidden="true" className="size-4" />
					</button>
				</form>
			</div>

			{statusMessage && (
				<div className="mb-3 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-200">
					{statusMessage}
				</div>
			)}

			{/* Song Metadata & Scale Controls */}
			<div className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
				<div className="flex flex-col gap-1">
					<label
						className="text-xs font-semibold text-slate-300"
						htmlFor="project-title-input"
					>
						Song Title
					</label>
					<input
						className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-white focus:border-cyan-400 focus:outline-none"
						id="project-title-input"
						type="text"
						value={song.title}
						onChange={(event): void => {
							updateSongMetadata({ title: event.target.value });
						}}
					/>
				</div>

				<div className="grid grid-cols-2 gap-2">
					<div className="flex flex-col gap-1">
						<label
							className="text-xs font-semibold text-slate-300"
							htmlFor="dialog-root-key"
						>
							Root Key
						</label>
						<select
							className="rounded-xl border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs font-semibold text-white"
							id="dialog-root-key"
							value={song.rootKey}
							onChange={(event): void => {
								updateSongMetadata({
									rootKey: event.target.value as MusicalKey,
								});
							}}
						>
							{MUSICAL_KEYS.map((keyName) => (
								<option key={keyName} value={keyName}>
									{keyName}
								</option>
							))}
						</select>
					</div>

					<div className="flex flex-col gap-1">
						<label
							className="text-xs font-semibold text-slate-300"
							htmlFor="dialog-scale"
						>
							Scale
						</label>
						<select
							className="rounded-xl border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs font-semibold text-white"
							id="dialog-scale"
							value={song.scale}
							onChange={(event): void => {
								updateSongMetadata({
									scale: event.target.value as ScaleType,
								});
							}}
						>
							{Object.entries(SCALE_DEFINITIONS).map(
								([scaleKey, definition]) => (
									<option key={scaleKey} value={scaleKey}>
										{definition.label}
									</option>
								)
							)}
						</select>
					</div>
				</div>

				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
					<SliderControl
						formatValue={(value): string => `${Math.round(value * 100)}%`}
						label="Groove Swing"
						max={0.6}
						min={0}
						step={0.02}
						value={song.swing}
						onChange={(nextValue): void => {
							updateSongMetadata({ swing: nextValue });
						}}
					/>
					<SliderControl
						formatValue={(value): string => `${Math.round(value * 100)}%`}
						label="Master Volume"
						max={1}
						min={0.1}
						step={0.02}
						value={song.masterVolume}
						onChange={(nextValue): void => {
							updateSongMetadata({ masterVolume: nextValue });
						}}
					/>
				</div>
			</div>

			{/* Offline Export & Project File Actions */}
			<div className="mb-4 grid grid-cols-2 gap-2">
				<button
					className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-cyan-400 px-3 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60"
					disabled={isExportingWav}
					type="button"
					onClick={handleExportWav}
				>
					<SpeakerWaveIcon aria-hidden="true" className="size-4" />
					<span>{isExportingWav ? "Rendering..." : "Export .WAV"}</span>
				</button>

				<button
					className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-400 px-3 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-amber-300"
					type="button"
					onClick={handleExportMidi}
				>
					<MusicalNoteIcon aria-hidden="true" className="size-4" />
					<span>Export .MID</span>
				</button>

				<button
					className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-xs font-semibold text-white hover:border-slate-600"
					type="button"
					onClick={handleExportJson}
				>
					<ArrowDownTrayIcon
						aria-hidden="true"
						className="size-4 text-violet-300"
					/>
					<span>Export .JSON</span>
				</button>

				<button
					className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-xs font-semibold text-white hover:border-slate-600"
					type="button"
					onClick={(): void => {
						fileInputRef.current?.click();
					}}
				>
					<ArrowUpTrayIcon
						aria-hidden="true"
						className="size-4 text-emerald-300"
					/>
					<span>Import .JSON</span>
				</button>

				<button
					className="col-span-2 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-xs font-semibold text-white hover:border-slate-600"
					type="button"
					onClick={(): void => {
						createNewProject();
						setStatusMessage("Created new blank song.");
					}}
				>
					<DocumentPlusIcon
						aria-hidden="true"
						className="size-4 text-amber-300"
					/>
					<span>New Blank Song</span>
				</button>

				<button
					className="col-span-2 inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2.5 text-xs font-bold text-rose-200 hover:border-rose-400 hover:bg-rose-500/20"
					type="button"
					onClick={(): void => {
						dialogRef.current?.close();
						onRequestReset();
					}}
				>
					<TrashIcon aria-hidden="true" className="size-4 text-rose-400" />
					<span>Delete / Reset Everything...</span>
				</button>
			</div>

			<input
				ref={fileInputRef}
				accept=".json,application/json"
				className="hidden"
				type="file"
				onChange={handleImportFile}
			/>

			{/* Dedicated Demo & Retro SFX Browser Launcher */}
			<div className="mb-4 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
				<div className="mb-2 flex items-center justify-between gap-2">
					<h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-300">
						<QueueListIcon
							aria-hidden="true"
							className="size-3.5 text-cyan-400"
						/>
						<span>Built-in Demos &amp; Retro SFX</span>
					</h3>
					<span className="font-mono text-[10px] text-slate-400">
						{DEMO_SONGS.length} Songs · {SFX_PRESETS.length} SFX
					</span>
				</div>
				<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
					<button
						className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-cyan-500/40 bg-cyan-500/15 px-3 py-2 text-xs font-bold text-cyan-100 transition hover:border-cyan-400 hover:bg-cyan-500/25"
						type="button"
						onClick={(): void => {
							dialogRef.current?.close();
							onOpenDemoBrowser("demos");
						}}
					>
						<MusicalNoteIcon
							aria-hidden="true"
							className="size-4 text-cyan-300"
						/>
						<span>Browse Demo Songs ({DEMO_SONGS.length})</span>
					</button>
					<button
						className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/15 px-3 py-2 text-xs font-bold text-amber-100 transition hover:border-amber-400 hover:bg-amber-500/25"
						type="button"
						onClick={(): void => {
							dialogRef.current?.close();
							onOpenDemoBrowser("sfx");
						}}
					>
						<BoltIcon aria-hidden="true" className="size-4 text-amber-300" />
						<span>Browse Retro SFX ({SFX_PRESETS.length})</span>
					</button>
				</div>
			</div>

			{/* Local Browser Library */}
			<div>
				<div className="mb-2 flex items-center justify-between">
					<h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
						<FolderOpenIcon
							aria-hidden="true"
							className="size-3.5 text-rose-400"
						/>
						<span>Saved Offline Library ({savedSongs.length})</span>
					</h3>
					<button
						className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25"
						type="button"
						onClick={(): void => {
							saveCurrentSongToLibrary();
							setStatusMessage(`Saved "${song.title}" to offline storage.`);
						}}
					>
						<BookmarkSquareIcon aria-hidden="true" className="size-3.5" />
						<span>Save Current</span>
					</button>
				</div>

				{savedSongs.length === 0 ? (
					<p className="rounded-xl border border-dashed border-slate-800 p-3 text-center text-xs text-slate-500">
						No songs saved to library yet. Active edits auto-save automatically.
					</p>
				) : (
					<div className="flex flex-col gap-1.5">
						{savedSongs.map((item) => (
							<div
								key={item.id}
								className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2"
							>
								<button
									className="min-w-0 flex-1 text-left"
									type="button"
									onClick={(): void => {
										loadSavedSong(item.id);
										dialogRef.current?.close();
									}}
								>
									<p className="truncate text-xs font-bold text-white">
										{item.title}
									</p>
									<p className="font-mono text-[10px] text-slate-400">
										{item.engine === "modern" ? "Modern · " : ""}
										{item.bpm} BPM · {item.totalBars} Bars
									</p>
								</button>
								<button
									aria-label={`Delete saved song ${item.title}`}
									className="flex size-8 items-center justify-center rounded-lg text-slate-500 hover:bg-rose-500/20 hover:text-rose-300"
									type="button"
									onClick={(): void => {
										deleteSavedSong(item.id);
									}}
								>
									<TrashIcon aria-hidden="true" className="size-3.5" />
								</button>
							</div>
						))}
					</div>
				)}
			</div>
		</dialog>
	);
};

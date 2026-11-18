import { useEffect, useState } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import type { FunctionComponent } from "../../../common/types";
import { registerChiptuneAgentApi } from "../api/chiptuneAgentApi";
import { chiptunePlaybackEngine } from "../audio/playbackEngine";
import { useChiptuneStore } from "../store/useChiptuneStore";
import type { MobileWorkspaceTab } from "../types/music";
import { ConfirmResetDialog } from "./ConfirmResetDialog";
import { InstrumentSynthPanel } from "./InstrumentSynthPanel";
import { PianoRollEditor } from "./PianoRollEditor";
import { ProjectManagerDialog } from "./ProjectManagerDialog";
import { SfxCreatorBanner } from "./SfxCreatorBanner";
import { SongMatrixPanel } from "./SongMatrixPanel";
import { TransportHeader } from "./TransportHeader";

const MOBILE_TABS: Array<{ id: MobileWorkspaceTab; label: string }> = [
	{ id: "all", label: "Split" },
	{ id: "piano", label: "Piano" },
	{ id: "matrix", label: "Matrix" },
	{ id: "synth", label: "Synth" },
];

export const ChiptuneStudioPage = (): FunctionComponent => {
	const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
	const [isResetModalOpen, setIsResetModalOpen] = useState(false);

	const song = useChiptuneStore((state) => state.song);
	const studioMode = useChiptuneStore((state) => state.studioMode);
	const isPlaying = useChiptuneStore((state) => state.isPlaying);
	const loopMode = useChiptuneStore((state) => state.loopMode);
	const selectedBarIndex = useChiptuneStore((state) => state.selectedBarIndex);
	const activeWorkspaceTab = useChiptuneStore(
		(state) => state.activeWorkspaceTab
	);
	const setActiveWorkspaceTab = useChiptuneStore(
		(state) => state.setActiveWorkspaceTab
	);
	const setIsPlaying = useChiptuneStore((state) => state.setIsPlaying);
	const setPlaybackPosition = useChiptuneStore(
		(state) => state.setPlaybackPosition
	);

	// Register step listener from Tone.js / Web Audio scheduler and global AI Agent API
	useEffect(() => {
		registerChiptuneAgentApi();
		chiptunePlaybackEngine.setStepListener((barIndex, stepIndex) => {
			setPlaybackPosition(barIndex, stepIndex);
		});
		chiptunePlaybackEngine.setPlaybackEndedListener(() => {
			setIsPlaying(false);
		});
		return (): void => {
			chiptunePlaybackEngine.setStepListener(null);
			chiptunePlaybackEngine.setPlaybackEndedListener(null);
			chiptunePlaybackEngine.stop();
		};
	}, [setIsPlaying, setPlaybackPosition]);

	// Start or stop engine when isPlaying changes
	useEffect(() => {
		if (isPlaying) {
			chiptunePlaybackEngine.start(song, selectedBarIndex, loopMode);
		} else {
			chiptunePlaybackEngine.stop();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isPlaying]);

	// Keep live song edits, tempo, and mute/solo synced while playing
	useEffect(() => {
		chiptunePlaybackEngine.updateSong(song, loopMode, selectedBarIndex);
	}, [song, loopMode, selectedBarIndex]);

	// Global Keyboard Shortcuts (outside text inputs):
	// Space = Play/Pause, Ctrl/Cmd+Z = Undo, Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y = Redo,
	// Ctrl/Cmd+C = Copy bars, Ctrl/Cmd+V = Paste bars, Ctrl/Cmd+D = Duplicate,
	// Ctrl/Cmd+A = Select all bars, Esc = Deselect bars
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent): void => {
			const target = event.target as HTMLElement | null;
			const tagName = target?.tagName.toLowerCase();
			if (
				tagName === "input" ||
				tagName === "textarea" ||
				tagName === "select" ||
				target?.isContentEditable
			) {
				return;
			}

			const isCtrlOrMeta = event.ctrlKey || event.metaKey;

			// Undo: Cmd+Z / Ctrl+Z (without shift)
			if (
				isCtrlOrMeta &&
				!event.shiftKey &&
				event.key.toLowerCase() === "z"
			) {
				event.preventDefault();
				useChiptuneStore.getState().undo();
				return;
			}

			// Redo: Cmd+Shift+Z / Ctrl+Shift+Z / Cmd+Y / Ctrl+Y
			if (
				(isCtrlOrMeta &&
					event.shiftKey &&
					event.key.toLowerCase() === "z") ||
				(isCtrlOrMeta && event.key.toLowerCase() === "y")
			) {
				event.preventDefault();
				useChiptuneStore.getState().redo();
				return;
			}

			// Copy selected bars: Cmd+C / Ctrl+C
			if (isCtrlOrMeta && event.key.toLowerCase() === "c") {
				const state = useChiptuneStore.getState();
				if (state.barSelection) {
					event.preventDefault();
					state.copySelectedBars();
					return;
				}
			}

			// Paste copied bars: Cmd+V / Ctrl+V
			if (isCtrlOrMeta && event.key.toLowerCase() === "v") {
				const state = useChiptuneStore.getState();
				if (state.copiedBarsClipboard) {
					event.preventDefault();
					state.pasteBarsAt(state.selectedBarIndex);
					return;
				}
			}

			// Duplicate selected bars: Cmd+D / Ctrl+D
			if (isCtrlOrMeta && event.key.toLowerCase() === "d") {
				const state = useChiptuneStore.getState();
				if (state.barSelection) {
					event.preventDefault();
					state.duplicateSelectedBarsTo(state.barSelection.endBar + 1);
					return;
				}
			}

			// Select All Bars: Cmd+A / Ctrl+A
			if (isCtrlOrMeta && event.key.toLowerCase() === "a") {
				event.preventDefault();
				useChiptuneStore.getState().selectAllBars();
				return;
			}

			// Deselect bars: Escape
			if (event.key === "Escape") {
				const state = useChiptuneStore.getState();
				if (state.barSelection) {
					event.preventDefault();
					state.clearBarSelection();
					return;
				}
			}

			// Play/Pause toggle: Space
			if (event.code === "Space") {
				event.preventDefault();
				setIsPlaying(!useChiptuneStore.getState().isPlaying);
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return (): void => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [setIsPlaying]);

	const showPianoMobile =
		activeWorkspaceTab === "all" || activeWorkspaceTab === "piano";
	const showMatrixMobile =
		activeWorkspaceTab === "all" || activeWorkspaceTab === "matrix";
	const showSynthMobile =
		activeWorkspaceTab === "all" || activeWorkspaceTab === "synth";

	return (
		<DndProvider backend={HTML5Backend}>
			<div className="flex h-dvh w-full flex-col overflow-hidden bg-slate-950 text-slate-100">
				<TransportHeader
					onOpenProjectModal={(): void => {
						setIsProjectModalOpen(true);
					}}
					onOpenResetModal={(): void => {
						setIsResetModalOpen(true);
					}}
				/>

				{studioMode === "sfx" && <SfxCreatorBanner />}

				{/* Compact Mobile Workspace Switcher (< md) */}
				<nav
					aria-label="Mobile workspace view"
					className="flex shrink-0 items-center justify-between gap-1 border-b border-slate-800 bg-slate-900/90 px-2 py-1 md:hidden"
				>
					<div className="flex items-center gap-1">
						{MOBILE_TABS.map((tab) => (
							<button
								key={tab.id}
								aria-pressed={activeWorkspaceTab === tab.id}
								type="button"
								className={`rounded px-2.5 py-0.5 text-[11px] font-bold transition ${
									activeWorkspaceTab === tab.id
										? "bg-cyan-500/25 text-cyan-200"
										: "text-slate-400 hover:text-white"
								}`}
								onClick={(): void => {
									setActiveWorkspaceTab(tab.id);
								}}
							>
								{tab.label}
							</button>
						))}
					</div>
					<span className="truncate font-mono text-[10px] font-semibold text-slate-400">
						{song.bpm} BPM · {song.rootKey}
					</span>
				</nav>

				{/* Unified Responsive Studio Layout: Mobile (<md) -> Tablet (md..lg) -> Desktop (lg+) */}
				<main className="flex min-h-0 flex-1 flex-col md:grid md:grid-cols-[minmax(0,1fr)_22rem] md:grid-rows-[minmax(0,1.25fr)_minmax(14rem,0.9fr)] lg:grid-cols-[minmax(0,1fr)_25rem] lg:grid-rows-[minmax(0,1fr)_auto] xl:grid-cols-[minmax(0,1fr)_28rem]">
					{/* Pane 1: Konva Piano Roll */}
					<div
						className={`min-h-0 flex-col ${
							showPianoMobile
								? activeWorkspaceTab === "piano"
									? "flex flex-1"
									: "flex flex-[1.35]"
								: "hidden"
						} md:col-span-2 md:row-start-1 md:flex lg:col-span-1 lg:col-start-1 lg:row-start-1 lg:border-r lg:border-slate-800`}
					>
						<PianoRollEditor />
					</div>

					{/* Pane 2: Drag-and-Drop Song Matrix */}
					<div
						className={`min-h-0 flex-col ${
							showMatrixMobile
								? activeWorkspaceTab === "matrix"
									? "flex flex-1 overflow-y-auto"
									: "flex shrink-0"
								: "hidden"
						} md:col-start-1 md:row-start-2 md:flex md:overflow-auto md:border-r md:border-slate-800 lg:col-start-1 lg:row-start-2 lg:shrink-0 lg:overflow-visible`}
					>
						<SongMatrixPanel />
					</div>

					{/* Pane 3: Instrument Synth & Tone.js Oscilloscope Inspector */}
					<aside
						className={`min-h-0 flex-col bg-slate-950 ${
							showSynthMobile ? "flex flex-1" : "hidden"
						} md:col-start-2 md:row-start-2 md:flex lg:col-start-2 lg:row-span-2 lg:row-start-1`}
					>
						<InstrumentSynthPanel />
					</aside>
				</main>

				<ProjectManagerDialog
					isOpen={isProjectModalOpen}
					onClose={(): void => {
						setIsProjectModalOpen(false);
					}}
					onRequestReset={(): void => {
						setIsResetModalOpen(true);
					}}
				/>

				<ConfirmResetDialog
					isOpen={isResetModalOpen}
					onClose={(): void => {
						setIsResetModalOpen(false);
					}}
				/>
			</div>
		</DndProvider>
	);
};

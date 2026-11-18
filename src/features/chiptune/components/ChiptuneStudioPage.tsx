import { useEffect, useState } from "react";
import type { FunctionComponent } from "../../../common/types";
import { chiptunePlaybackEngine } from "../audio/playbackEngine";
import { useChiptuneStore } from "../store/useChiptuneStore";
import { InstrumentSynthPanel } from "./InstrumentSynthPanel";
import { PianoRollEditor } from "./PianoRollEditor";
import { ProjectManagerDialog } from "./ProjectManagerDialog";
import { SongMatrixPanel } from "./SongMatrixPanel";
import { TransportHeader } from "./TransportHeader";

export const ChiptuneStudioPage = (): FunctionComponent => {
	const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);

	const song = useChiptuneStore((state) => state.song);
	const isPlaying = useChiptuneStore((state) => state.isPlaying);
	const loopMode = useChiptuneStore((state) => state.loopMode);
	const selectedBarIndex = useChiptuneStore((state) => state.selectedBarIndex);
	const setIsPlaying = useChiptuneStore((state) => state.setIsPlaying);
	const setPlaybackPosition = useChiptuneStore(
		(state) => state.setPlaybackPosition
	);

	// Register step listener from Web Audio scheduler
	useEffect(() => {
		chiptunePlaybackEngine.setStepListener((barIndex, stepIndex) => {
			setPlaybackPosition(barIndex, stepIndex);
		});
		return (): void => {
			chiptunePlaybackEngine.setStepListener(null);
			chiptunePlaybackEngine.stop();
		};
	}, [setPlaybackPosition]);

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

	// Spacebar shortcut to Play / Pause outside inputs
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent): void => {
			const target = event.target as HTMLElement | null;
			const tagName = target?.tagName.toLowerCase();
			if (
				tagName === "input" ||
				tagName === "textarea" ||
				tagName === "select"
			) {
				return;
			}
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

	return (
		<div className="flex h-dvh w-full flex-col overflow-hidden bg-slate-950 text-slate-100">
			<TransportHeader
				onOpenProjectModal={(): void => {
					setIsProjectModalOpen(true);
				}}
			/>

			{/* Mobile / Tablet Single-Screen UltraBox Layout (< lg) */}
			<main className="flex min-h-0 flex-1 flex-col lg:hidden">
				<div className="flex min-h-0 flex-[1.35] flex-col">
					<PianoRollEditor />
				</div>
				<SongMatrixPanel />
				<div className="flex min-h-0 flex-1 flex-col">
					<InstrumentSynthPanel />
				</div>
			</main>

			{/* Desktop Multi-Pane UltraBox Workstation (>= lg) */}
			<main className="hidden min-h-0 flex-1 lg:grid lg:grid-cols-[minmax(0,1fr)_23rem]">
				<div className="flex min-h-0 flex-col border-r border-slate-800">
					<PianoRollEditor />
					<SongMatrixPanel />
				</div>
				<aside className="flex min-h-0 flex-col bg-slate-950">
					<InstrumentSynthPanel />
				</aside>
			</main>

			<ProjectManagerDialog
				isOpen={isProjectModalOpen}
				onClose={(): void => {
					setIsProjectModalOpen(false);
				}}
			/>
		</div>
	);
};

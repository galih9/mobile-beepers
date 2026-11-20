import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { DemoSongBrowserDialog } from "../components/DemoSongBrowserDialog";
import { DEMO_SONGS } from "../constants/demoSongs";
import { useChiptuneStore } from "../store/useChiptuneStore";

describe("DemoSongBrowserDialog", () => {
	beforeAll(() => {
		if (!HTMLDialogElement.prototype.showModal) {
			HTMLDialogElement.prototype.showModal = function showModal(
				this: HTMLDialogElement
			): void {
				this.setAttribute("open", "");
			};
		}
		if (!HTMLDialogElement.prototype.close) {
			HTMLDialogElement.prototype.close = function close(
				this: HTMLDialogElement
			): void {
				this.removeAttribute("open");
				this.dispatchEvent(new Event("close"));
			};
		}
	});

	beforeEach(() => {
		useChiptuneStore.getState().createNewProject();
	});

	it("renders all demo songs and supports category + search filtering", () => {
		const onClose = vi.fn();
		render(
			<DemoSongBrowserDialog
				isOpen
				initialTab="demos"
				onClose={onClose}
			/>
		);

		expect(screen.getByText("Demo Song & SFX Library")).toBeTruthy();
		expect(screen.getByText("Pocket Battle 1996")).toBeTruthy();
		expect(
			screen.getByText(`Showing ${DEMO_SONGS.length} of ${DEMO_SONGS.length}`)
		).toBeTruthy();

		// Filter by Battle & Action category
		const battleFilter = screen.getByRole("button", {
			name: /Battle & Action/i,
		});
		fireEvent.click(battleFilter);
		expect(screen.getByText("Pocket Battle 1996")).toBeTruthy();
		expect(screen.getByText("Starlight Boss Rush")).toBeTruthy();
		expect(screen.queryByText("Cozy Pixel Town")).toBeNull();

		// Further narrow by search query
		const searchInput = screen.getByRole("searchbox");
		fireEvent.change(searchInput, { target: { value: "pocket" } });
		expect(screen.getByText("Pocket Battle 1996")).toBeTruthy();
		expect(screen.queryByText("Starlight Boss Rush")).toBeNull();
	});

	it("loads and plays a selected demo song and closes the modal", () => {
		const onClose = vi.fn();
		render(
			<DemoSongBrowserDialog
				isOpen
				initialTab="demos"
				onClose={onClose}
			/>
		);

		const pocketHeading = screen.getByRole("heading", {
			name: "Pocket Battle 1996",
		});
		const card = pocketHeading.closest("article");
		expect(card).not.toBeNull();

		const loadAndPlayButton = within(card as HTMLElement).getByRole("button", {
			name: /Load & Play/i,
		});
		fireEvent.click(loadAndPlayButton);

		const state = useChiptuneStore.getState();
		expect(state.song.title).toBe("Pocket Battle 1996");
		expect(state.song.bpm).toBe(168);
		expect(state.isPlaying).toBe(true);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("switches to Retro SFX tab and loads an SFX preset", () => {
		const onClose = vi.fn();
		render(
			<DemoSongBrowserDialog
				isOpen
				initialTab="demos"
				onClose={onClose}
			/>
		);

		const sfxTab = screen.getByRole("button", { name: /Retro SFX/i });
		fireEvent.click(sfxTab);

		const rayGunHeading = screen.getByRole("heading", {
			name: "Ray Gun Shoot",
		});
		const card = rayGunHeading.closest("article");
		expect(card).not.toBeNull();

		const loadButton = within(card as HTMLElement).getByRole("button", {
			name: /^Load$/i,
		});
		fireEvent.click(loadButton);

		const state = useChiptuneStore.getState();
		expect(state.studioMode).toBe("sfx");
		expect(state.song.title).toBe("Ray Gun Shoot");
		expect(state.isPlaying).toBe(false);
		expect(onClose).toHaveBeenCalledTimes(1);
	});
});

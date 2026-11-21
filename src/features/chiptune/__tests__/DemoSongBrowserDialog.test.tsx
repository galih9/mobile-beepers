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

	it("renders the breakcore demos and supports category + search filtering", () => {
		const onClose = vi.fn();
		render(
			<DemoSongBrowserDialog
				isOpen
				initialTab="demos"
				onClose={onClose}
			/>
		);

		expect(screen.getByText("Demo Song & SFX Library")).toBeTruthy();
		expect(screen.getByText("Breakcore Battle v1")).toBeTruthy();
		expect(screen.getByText("Amen Overdrive 180")).toBeTruthy();
		expect(
			screen.getByText(`Showing ${DEMO_SONGS.length} of ${DEMO_SONGS.length}`)
		).toBeTruthy();

		const breakcoreFilter = screen.getByRole("button", {
			name: /Breakcore & Rave/i,
		});
		fireEvent.click(breakcoreFilter);
		expect(screen.getByText("Breakcore Battle v1")).toBeTruthy();
		expect(screen.getByText("Amen Overdrive 180")).toBeTruthy();

		const searchInput = screen.getByRole("searchbox");
		fireEvent.change(searchInput, { target: { value: "overdrive" } });
		expect(screen.getByText("Amen Overdrive 180")).toBeTruthy();
		expect(screen.queryByText("Breakcore Battle v1")).toBeNull();
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

		const battleHeading = screen.getByRole("heading", {
			name: "Breakcore Battle v1",
		});
		const card = battleHeading.closest("article");
		expect(card).not.toBeNull();

		const loadAndPlayButton = within(card as HTMLElement).getByRole("button", {
			name: /Load & Play/i,
		});
		fireEvent.click(loadAndPlayButton);

		const state = useChiptuneStore.getState();
		expect(state.song.title).toBe("Breakcore Battle v1");
		expect(state.song.bpm).toBe(174);
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

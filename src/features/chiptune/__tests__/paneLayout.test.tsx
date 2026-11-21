import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PaneResizeHandle } from "../components/PaneResizeHandle";
import { useChiptuneStore } from "../store/useChiptuneStore";

describe("resizable panes", () => {
	beforeEach(() => {
		useChiptuneStore
			.getState()
			.setPaneLayout({ asideWidth: null, matrixHeight: null });
	});

	it("stores pane sizes and keeps them across a reset", () => {
		useChiptuneStore.getState().setPaneLayout({ asideWidth: 360 });
		useChiptuneStore.getState().setPaneLayout({ matrixHeight: 220 });
		useChiptuneStore.getState().resetEverything();
		expect(useChiptuneStore.getState().paneLayout).toEqual({
			asideWidth: 360,
			matrixHeight: 220,
		});
	});

	it("resizes with arrow keys within the limits and resets on Home", () => {
		const onPreview = vi.fn();
		const onCommit = vi.fn();
		render(
			<PaneResizeHandle
				axis="column"
				direction={-1}
				getMax={(): number => 420}
				getMin={(): number => 280}
				getSize={(): number => 400}
				label="Resize instrument panel width"
				onCommit={onCommit}
				onPreview={onPreview}
			/>
		);
		const handle = screen.getByRole("separator");
		// Panel sits on the right, so ArrowLeft grows it (clamped to 420)
		fireEvent.keyDown(handle, { key: "ArrowLeft" });
		expect(onCommit).toHaveBeenLastCalledWith(420);
		fireEvent.keyDown(handle, { key: "ArrowRight" });
		expect(onCommit).toHaveBeenLastCalledWith(376);
		fireEvent.keyDown(handle, { key: "Home" });
		expect(onCommit).toHaveBeenLastCalledWith(null);
		fireEvent.doubleClick(handle);
		expect(onCommit).toHaveBeenLastCalledWith(null);
	});

	it("toggles volume numbers on notes", () => {
		const before = useChiptuneStore.getState().showNoteVelocityLabels;
		useChiptuneStore.getState().toggleNoteVelocityLabels();
		expect(useChiptuneStore.getState().showNoteVelocityLabels).toBe(!before);
	});
});

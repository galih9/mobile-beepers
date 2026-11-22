import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { StudioSettingsDialog } from "../components/StudioSettingsDialog";
import { channelInk } from "../components/useCanvasPalette";
import {
	CANVAS_PALETTES,
	DEFAULT_THEME_MODE,
	THEME_OPTIONS,
	type ThemeMode,
} from "../constants/themes";
import {
	buildToolbarPreset,
	DEFAULT_TOOLBAR_VISIBILITY,
	normalizeToolbarVisibility,
	TOOLBAR_ITEMS,
} from "../constants/toolbarItems";
import { useChiptuneStore } from "../store/useChiptuneStore";
import indexHtml from "../../../../index.html?raw";
import tailwindCss from "../../../styles/tailwind.css?raw";

const ensureDialogPolyfill = (): void => {
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
};

describe("studio themes", () => {
	beforeAll(ensureDialogPolyfill);

	beforeEach(() => {
		useChiptuneStore.getState().setThemeMode(DEFAULT_THEME_MODE);
	});

	it("offers eight themes with Neon as the default", () => {
		expect(THEME_OPTIONS.map((option) => option.id)).toEqual([
			"neon",
			"dark",
			"light",
			"synthwave",
			"phosphor",
			"crimson",
			"frost",
			"famicom",
		]);
		expect(useChiptuneStore.getState().themeMode).toBe("neon");
	});

	it("rejects unknown theme ids and keeps the theme across a reset", () => {
		useChiptuneStore.getState().setThemeMode("light");
		useChiptuneStore.getState().setThemeMode("sepia" as ThemeMode);
		expect(useChiptuneStore.getState().themeMode).toBe("neon");
		useChiptuneStore.getState().setThemeMode("synthwave");
		useChiptuneStore.getState().resetEverything();
		expect(useChiptuneStore.getState().themeMode).toBe("synthwave");
	});

	it("defines every canvas colour for every theme", () => {
		const keys = Object.keys(CANVAS_PALETTES.neon).sort();
		for (const option of THEME_OPTIONS) {
			expect(Object.keys(CANVAS_PALETTES[option.id]).sort()).toEqual(keys);
		}
	});

	it("has CSS tokens for every theme and lists them in the pre-paint script", () => {
		const css = tailwindCss;
		const html = indexHtml;
		for (const option of THEME_OPTIONS.filter(
			(candidate) => candidate.id !== "neon"
		)) {
			expect(css).toContain(`:root[data-theme="${option.id}"]`);
			expect(html).toContain(`"${option.id}"`);
		}
	});

	it("only mixes channel colours toward ink on light themes", () => {
		expect(channelInk("#f472b6", CANVAS_PALETTES.neon)).toBe("#f472b6");
		expect(channelInk("#f472b6", CANVAS_PALETTES.synthwave)).toBe("#f472b6");
		for (const option of THEME_OPTIONS.filter(
			(candidate) => candidate.colorScheme === "light"
		)) {
			expect(channelInk("#f472b6", CANVAS_PALETTES[option.id])).toContain(
				"color-mix"
			);
		}
	});

	it("switches theme from the Settings dialog", () => {
		render(<StudioSettingsDialog isOpen onClose={vi.fn()} />);
		// Settings opens on the Mode section; themes live one tab over
		fireEvent.click(screen.getByRole("button", { name: "Theme" }));
		expect(screen.getAllByRole("radio")).toHaveLength(THEME_OPTIONS.length);
		expect(screen.getByRole("radio", { name: /neon theme/i })).toHaveProperty(
			"checked",
			true
		);
		fireEvent.click(screen.getByRole("radio", { name: /phosphor theme/i }));
		expect(useChiptuneStore.getState().themeMode).toBe("phosphor");
	});
});

describe("toolbar visibility settings", () => {
	beforeAll(ensureDialogPolyfill);

	beforeEach(() => {
		useChiptuneStore.getState().applyToolbarPreset("essentials");
	});

	it("starts with the essentials layout and fills gaps in old saves", () => {
		expect(useChiptuneStore.getState().toolbarVisibility).toEqual(
			DEFAULT_TOOLBAR_VISIBILITY
		);
		expect(DEFAULT_TOOLBAR_VISIBILITY.noteFeel).toBe(false);
		expect(DEFAULT_TOOLBAR_VISIBILITY.noteLength).toBe(true);
		const restored = normalizeToolbarVisibility({ noteFeel: true, bogus: 1 });
		expect(restored.noteFeel).toBe(true);
		expect(restored.zoom).toBe(true);
		expect(Object.keys(restored)).toHaveLength(TOOLBAR_ITEMS.length);
	});

	it("toggles single items, applies presets and survives a reset", () => {
		const state = useChiptuneStore.getState();
		state.setToolbarItemVisible("articulation", true);
		expect(useChiptuneStore.getState().toolbarVisibility.articulation).toBe(
			true
		);
		state.applyToolbarPreset("everything");
		expect(useChiptuneStore.getState().toolbarVisibility).toEqual(
			buildToolbarPreset("everything")
		);
		state.setToolbarItemVisible("reset", false);
		state.resetEverything();
		expect(useChiptuneStore.getState().toolbarVisibility.reset).toBe(false);
	});

	it("shows a switch per toolbar item in the Toolbar section", () => {
		render(<StudioSettingsDialog isOpen onClose={vi.fn()} />);
		fireEvent.click(screen.getByRole("button", { name: "Toolbar" }));
		const switches = screen.getAllByRole("switch");
		expect(switches).toHaveLength(TOOLBAR_ITEMS.length);

		const pianoGroup = screen.getByRole("region", {
			name: "Piano roll toolbar",
		});
		const articulationSwitch = within(pianoGroup).getByRole("switch", {
			name: /articulation/i,
		});
		expect(articulationSwitch).toHaveProperty("checked", false);
		fireEvent.click(articulationSwitch);
		expect(useChiptuneStore.getState().toolbarVisibility.articulation).toBe(
			true
		);

		fireEvent.click(screen.getByRole("button", { name: "Show everything" }));
		expect(
			screen.getAllByRole("switch").every((input) => {
				return (input as HTMLInputElement).checked;
			})
		).toBe(true);
	});
});

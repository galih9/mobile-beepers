import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ThemeSwitch } from "../components/ThemeSwitch";
import { channelInk } from "../components/useCanvasPalette";
import {
	CANVAS_PALETTES,
	DEFAULT_THEME_MODE,
	THEME_OPTIONS,
	type ThemeMode,
} from "../constants/themes";
import { useChiptuneStore } from "../store/useChiptuneStore";

describe("studio themes", () => {
	beforeEach(() => {
		useChiptuneStore.getState().setThemeMode(DEFAULT_THEME_MODE);
	});

	it("offers Neon, Dark and Light with Neon as the default", () => {
		expect(THEME_OPTIONS.map((option) => option.id)).toEqual([
			"neon",
			"dark",
			"light",
		]);
		expect(useChiptuneStore.getState().themeMode).toBe("neon");
	});

	it("rejects unknown theme ids and keeps the theme across a reset", () => {
		useChiptuneStore.getState().setThemeMode("light");
		useChiptuneStore.getState().setThemeMode("sepia" as ThemeMode);
		expect(useChiptuneStore.getState().themeMode).toBe("neon");
		useChiptuneStore.getState().setThemeMode("dark");
		useChiptuneStore.getState().resetEverything();
		expect(useChiptuneStore.getState().themeMode).toBe("dark");
	});

	it("defines every canvas colour for every theme", () => {
		const keys = Object.keys(CANVAS_PALETTES.neon).sort();
		for (const option of THEME_OPTIONS) {
			expect(Object.keys(CANVAS_PALETTES[option.id]).sort()).toEqual(keys);
		}
	});

	it("only mixes channel colours toward ink on the light theme", () => {
		expect(channelInk("#f472b6", CANVAS_PALETTES.neon)).toBe("#f472b6");
		expect(channelInk("#f472b6", CANVAS_PALETTES.light)).toContain("color-mix");
	});

	it("switches theme from the slide switch", () => {
		render(<ThemeSwitch />);
		const radios = screen.getAllByRole("radio");
		expect(radios).toHaveLength(3);
		expect(screen.getByRole("radio", { name: /neon theme/i })).toHaveProperty(
			"checked",
			true
		);
		fireEvent.click(screen.getByRole("radio", { name: /light theme/i }));
		expect(useChiptuneStore.getState().themeMode).toBe("light");
	});
});

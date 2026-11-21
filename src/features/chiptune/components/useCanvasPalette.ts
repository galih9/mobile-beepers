import { CANVAS_PALETTES, type CanvasPalette } from "../constants/themes";
import { useChiptuneStore } from "../store/useChiptuneStore";

/** Colours for canvas / SVG drawing that follow the active studio theme. */
export const useCanvasPalette = (): CanvasPalette => {
	const themeMode = useChiptuneStore((state) => state.themeMode);
	return CANVAS_PALETTES[themeMode];
};

/**
 * Text colour for a channel's own colour. On light themes pale channel colours
 * are mixed toward the theme's ink so names and numbers stay readable.
 */
export const channelInk = (color: string, palette: CanvasPalette): string =>
	palette.matrixInk
		? `color-mix(in oklab, ${color} 42%, ${palette.matrixInk})`
		: color;

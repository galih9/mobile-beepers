import {
	useRef,
	type KeyboardEvent as ReactKeyboardEvent,
	type PointerEvent as ReactPointerEvent,
} from "react";
import type { FunctionComponent } from "../../../common/types";

interface PaneResizeHandleProps {
	/** "column" resizes a width (drag left/right); "row" resizes a height (drag up/down) */
	axis: "column" | "row";
	label: string;
	/** Current size in px when a drag starts */
	getSize: () => number;
	getMin: () => number;
	getMax: () => number;
	/** +1 when dragging right/down grows the pane, -1 when it shrinks it */
	direction: 1 | -1;
	/** Called on every move while dragging (cheap, no store write) */
	onPreview: (size: number) => void;
	/** Called once on release / key press; null resets to the default size */
	onCommit: (size: number | null) => void;
	className?: string;
}

const KEYBOARD_STEP = 24;

/**
 * Drag handle between two studio modules. Drag to resize, arrow keys for
 * keyboard users, double-click to reset to the default layout.
 */
export const PaneResizeHandle = ({
	axis,
	label,
	getSize,
	getMin,
	getMax,
	direction,
	onPreview,
	onCommit,
	className = "",
}: PaneResizeHandleProps): FunctionComponent => {
	const dragRef = useRef<{
		start: number;
		startSize: number;
		size: number;
	} | null>(null);

	const clamp = (size: number): number =>
		Math.round(Math.max(getMin(), Math.min(getMax(), size)));

	const pointerPosition = (event: ReactPointerEvent): number =>
		axis === "column" ? event.clientX : event.clientY;

	const handlePointerDown = (
		event: ReactPointerEvent<HTMLDivElement>
	): void => {
		event.preventDefault();
		if (typeof event.currentTarget.setPointerCapture === "function") {
			event.currentTarget.setPointerCapture(event.pointerId);
		}
		const startSize = getSize();
		dragRef.current = {
			start: pointerPosition(event),
			startSize,
			size: startSize,
		};
		document.body.style.cursor =
			axis === "column" ? "col-resize" : "row-resize";
	};

	const handlePointerMove = (
		event: ReactPointerEvent<HTMLDivElement>
	): void => {
		const drag = dragRef.current;
		if (!drag) {
			return;
		}
		const delta = (pointerPosition(event) - drag.start) * direction;
		drag.size = clamp(drag.startSize + delta);
		onPreview(drag.size);
	};

	const finishDrag = (): void => {
		const drag = dragRef.current;
		if (!drag) {
			return;
		}
		dragRef.current = null;
		document.body.style.cursor = "";
		if (drag.size !== drag.startSize) {
			onCommit(drag.size);
		}
	};

	const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
		const growKey =
			axis === "column"
				? direction === 1
					? "ArrowRight"
					: "ArrowLeft"
				: direction === 1
					? "ArrowDown"
					: "ArrowUp";
		const shrinkKey =
			axis === "column"
				? direction === 1
					? "ArrowLeft"
					: "ArrowRight"
				: direction === 1
					? "ArrowUp"
					: "ArrowDown";
		if (event.key === growKey || event.key === shrinkKey) {
			event.preventDefault();
			const next = clamp(
				getSize() + (event.key === growKey ? KEYBOARD_STEP : -KEYBOARD_STEP)
			);
			onPreview(next);
			onCommit(next);
		} else if (event.key === "Home" || event.key === "Escape") {
			event.preventDefault();
			onCommit(null);
		}
	};

	return (
		<div
			aria-label={`${label}. Drag or use arrow keys to resize; double-click to reset.`}
			aria-orientation={axis === "column" ? "vertical" : "horizontal"}
			role="separator"
			tabIndex={0}
			title={`${label} — drag to resize, double-click to reset`}
			className={`group absolute z-30 flex touch-none items-center justify-center outline-none ${
				axis === "column"
					? "inset-y-0 w-2 cursor-col-resize"
					: "inset-x-0 h-2 cursor-row-resize"
			} ${className}`}
			onKeyDown={handleKeyDown}
			onPointerCancel={finishDrag}
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={finishDrag}
			onDoubleClick={(): void => {
				onCommit(null);
			}}
		>
			{/* Fader-style grip, brighter on hover / focus / drag */}
			<span
				aria-hidden="true"
				className={`rounded-full bg-slate-600 opacity-60 transition group-hover:bg-cyan-400 group-hover:opacity-100 group-focus-visible:bg-cyan-400 group-focus-visible:opacity-100 group-active:bg-cyan-300 ${
					axis === "column" ? "h-10 w-1" : "h-1 w-10"
				}`}
			/>
		</div>
	);
};

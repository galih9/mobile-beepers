import {
	ExclamationTriangleIcon,
	TrashIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useId, useRef } from "react";
import type { FunctionComponent } from "../../../common/types";
import { useChiptuneStore } from "../store/useChiptuneStore";

interface ConfirmResetDialogProps {
	isOpen: boolean;
	onClose: () => void;
}

export const ConfirmResetDialog = ({
	isOpen,
	onClose,
}: ConfirmResetDialogProps): FunctionComponent => {
	const titleId = useId();
	const descriptionId = useId();
	const dialogRef = useRef<HTMLDialogElement | null>(null);

	const savedCount = useChiptuneStore((state) => state.savedSongs.length);
	const createNewProject = useChiptuneStore((state) => state.createNewProject);
	const resetEverything = useChiptuneStore((state) => state.resetEverything);

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
			const choice = dialog.returnValue;
			dialog.returnValue = "";
			if (choice === "blank-song") {
				createNewProject();
			} else if (choice === "factory-reset") {
				resetEverything();
			}
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
	}, [createNewProject, onClose, resetEverything]);

	return (
		<dialog
			ref={dialogRef}
			aria-describedby={descriptionId}
			aria-labelledby={titleId}
			className="m-auto w-[min(94vw,28rem)] rounded-2xl border border-rose-500/40 bg-slate-900 p-5 text-slate-100 shadow-2xl"
			{...({ closedby: "any" } as Record<string, string>)}
		>
			<div className="mb-3 flex items-start gap-3">
				<div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/15 text-rose-400">
					<ExclamationTriangleIcon aria-hidden="true" className="size-5" />
				</div>
				<div>
					<h2 className="text-base font-bold text-white" id={titleId}>
						Reset or Delete Everything?
					</h2>
					<p className="mt-1 text-xs text-slate-300" id={descriptionId}>
						Choose whether to clear only the active song to a blank slate or
						permanently delete all saved library songs ({savedCount}) and reset
						all studio settings.
					</p>
				</div>
			</div>

			<form className="mt-4 flex flex-col gap-2" method="dialog">
				<button
					autoFocus
					className="inline-flex h-9 w-full items-center justify-center rounded-xl border border-slate-700 bg-slate-800 px-3 text-xs font-bold text-white transition hover:border-slate-500 hover:bg-slate-700"
					type="submit"
					value="cancel"
				>
					Cancel (Keep Everything)
				</button>

				<button
					className="inline-flex h-9 w-full items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/15 px-3 text-xs font-bold text-amber-200 transition hover:bg-amber-500/25"
					type="submit"
					value="blank-song"
				>
					Clear Song to Blank (Keep Saved Library)
				</button>

				<button
					className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-3 text-xs font-bold text-white transition hover:bg-rose-500"
					type="submit"
					value="factory-reset"
				>
					<TrashIcon aria-hidden="true" className="size-4" />
					<span>Delete All &amp; Reset Everything</span>
				</button>
			</form>
		</dialog>
	);
};

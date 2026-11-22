import {
	AdjustmentsHorizontalIcon,
	BoltIcon,
	CpuChipIcon,
	PaintBrushIcon,
	SparklesIcon,
	Squares2X2Icon,
	XMarkIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useId, useRef, useState } from "react";
import type { FunctionComponent } from "../../../common/types";
import { THEME_OPTIONS, type ThemeOption } from "../constants/themes";
import {
	buildToolbarPreset,
	TOOLBAR_ITEMS,
	type ToolbarGroup,
	type ToolbarItemDefinition,
	type ToolbarVisibility,
} from "../constants/toolbarItems";
import { useChiptuneStore } from "../store/useChiptuneStore";
import type { StudioMode } from "../types/music";

export type SettingsSection = "mode" | "theme" | "toolbar" | "editor";

const SECTIONS: Array<{
	id: SettingsSection;
	label: string;
	icon: typeof PaintBrushIcon;
}> = [
	{ id: "mode", label: "Mode", icon: SparklesIcon },
	{ id: "theme", label: "Theme", icon: PaintBrushIcon },
	{ id: "toolbar", label: "Toolbar", icon: Squares2X2Icon },
	{ id: "editor", label: "Editor", icon: AdjustmentsHorizontalIcon },
];

const TOOLBAR_GROUP_LABELS: Record<ToolbarGroup, string> = {
	top: "Top bar",
	piano: "Piano roll toolbar",
};

const matchesPreset = (
	visibility: ToolbarVisibility,
	preset: ToolbarVisibility
): boolean =>
	TOOLBAR_ITEMS.every((item) => visibility[item.id] === preset[item.id]);

// ─── Mode ────────────────────────────────────────────────────────────────────

const MODE_OPTIONS: Array<{
	id: StudioMode;
	name: string;
	tagline: string;
	description: string;
	icon: typeof SparklesIcon;
	accent: string;
}> = [
	{
		id: "modern",
		name: "Modern Music Maker",
		tagline: "Breakcore · DnB · electronic",
		description:
			"Sampled grand piano, strings and harp, supersaws, pads, reese and 808 bass, punchy and jungle drum kits, your own samples and break slicing — with chorus, synced delay, reverb, drive and sidechain pumping.",
		icon: SparklesIcon,
		accent: "violet",
	},
	{
		id: "music",
		name: "Chiptune Composer",
		tagline: "Retro 8-bit / 16-bit",
		description:
			"The original console-style synth: pulse, triangle, FM and noise voices, arpeggios and retro drum kits.",
		icon: CpuChipIcon,
		accent: "cyan",
	},
	{
		id: "sfx",
		name: "SFX Creator",
		tagline: "Game sound effects",
		description:
			"Short retro sound effects and jingles — lasers, hits, coins, power-ups — with a one-shot player.",
		icon: BoltIcon,
		accent: "amber",
	},
];

const MODE_ACCENT_CLASSES: Record<string, { active: string; icon: string }> = {
	violet: {
		active: "border-violet-400 bg-violet-500/10",
		icon: "border-violet-400/40 bg-violet-500/15 text-violet-200",
	},
	cyan: {
		active: "border-cyan-400 bg-cyan-500/10",
		icon: "border-cyan-400/40 bg-cyan-500/15 text-cyan-200",
	},
	amber: {
		active: "border-amber-400 bg-amber-500/10",
		icon: "border-amber-400/40 bg-amber-500/15 text-amber-200",
	},
};

const ModeSection = (): FunctionComponent => {
	const groupName = useId();
	const studioMode = useChiptuneStore((state) => state.studioMode);
	const setStudioMode = useChiptuneStore((state) => state.setStudioMode);

	return (
		<fieldset>
			<legend className="mb-1 text-sm font-bold text-white">App mode</legend>
			<p className="mb-3 text-xs text-slate-400">
				Each mode keeps its own project — switching back brings your work back
				exactly as you left it.
			</p>
			<div className="flex flex-col gap-2">
				{MODE_OPTIONS.map((option) => {
					const isActive = studioMode === option.id;
					const Icon = option.icon;
					const accent = MODE_ACCENT_CLASSES[option.accent];
					return (
						<label
							key={option.id}
							className={`relative flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
								isActive
									? (accent?.active ?? "")
									: "border-slate-800 bg-slate-950/60 hover:border-slate-600"
							}`}
						>
							<input
								aria-label={`${option.name} — ${option.tagline}`}
								checked={isActive}
								className="peer sr-only"
								name={groupName}
								type="radio"
								value={option.id}
								onChange={(): void => {
									setStudioMode(option.id);
								}}
							/>
							<span
								aria-hidden="true"
								className={`flex size-9 shrink-0 items-center justify-center rounded-lg border ${
									accent?.icon ?? ""
								}`}
							>
								<Icon className="size-5" />
							</span>
							<span className="min-w-0 flex-1">
								<span className="flex flex-wrap items-baseline justify-between gap-x-2">
									<span className="text-sm font-bold text-white">
										{option.name}
									</span>
									<span className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
										{isActive ? "Active" : option.tagline}
									</span>
								</span>
								<span className="mt-0.5 block text-[11px] leading-snug text-slate-400">
									{option.description}
								</span>
							</span>
							<span className="pointer-events-none absolute inset-0 rounded-xl peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-cyan-400" />
						</label>
					);
				})}
			</div>
		</fieldset>
	);
};

// ─── Theme ───────────────────────────────────────────────────────────────────

const ThemePreview = ({
	option,
}: {
	option: ThemeOption;
}): FunctionComponent => (
	<span
		aria-hidden="true"
		className="flex h-14 w-full items-center gap-1.5 rounded-lg p-1.5"
		style={{ backgroundColor: option.swatch.chassis }}
	>
		<span
			className="flex h-full flex-1 flex-col justify-between rounded-md p-1"
			style={{ backgroundColor: option.swatch.module }}
		>
			<span
				className="flex items-center justify-center rounded px-1 font-[family-name:var(--font-lcd)] text-[11px] leading-4 font-bold"
				style={{ backgroundColor: option.swatch.lcd, color: option.swatch.ink }}
			>
				01:01
			</span>
			<span className="flex gap-0.5">
				<span
					className="h-1.5 w-5 rounded-full"
					style={{ backgroundColor: option.swatch.accent }}
				/>
				<span
					className="h-1.5 w-3 rounded-full opacity-50"
					style={{ backgroundColor: option.swatch.ink }}
				/>
			</span>
		</span>
		<span
			className="size-4 shrink-0 rounded-full"
			style={{
				backgroundColor: option.swatch.accent,
				boxShadow: `inset 0 1px 0 rgba(255,255,255,0.35)`,
			}}
		/>
	</span>
);

const ThemeSection = (): FunctionComponent => {
	const groupName = useId();
	const themeMode = useChiptuneStore((state) => state.themeMode);
	const setThemeMode = useChiptuneStore((state) => state.setThemeMode);

	return (
		<fieldset>
			<legend className="mb-1 text-sm font-bold text-white">Theme</legend>
			<p className="mb-3 text-xs text-slate-400">
				Pick a look for the whole studio — chassis, LCD and piano roll.
			</p>
			<div className="grid grid-cols-2 gap-2 md:grid-cols-3">
				{THEME_OPTIONS.map((option) => {
					const isActive = themeMode === option.id;
					return (
						<label
							key={option.id}
							className={`group relative flex cursor-pointer flex-col gap-1.5 rounded-xl border p-1.5 transition ${
								isActive
									? "border-cyan-400 bg-cyan-500/10"
									: "border-slate-800 bg-slate-950/60 hover:border-slate-600"
							}`}
						>
							<input
								aria-label={`${option.name} theme — ${option.description}`}
								checked={isActive}
								className="peer sr-only"
								name={groupName}
								type="radio"
								value={option.id}
								onChange={(): void => {
									setThemeMode(option.id);
								}}
							/>
							<ThemePreview option={option} />
							<span className="flex items-center justify-between gap-1 px-0.5">
								<span className="text-xs font-bold text-white">
									{option.name}
								</span>
								<span className="text-[9px] font-semibold tracking-wide text-slate-500 uppercase">
									{option.colorScheme}
								</span>
							</span>
							<span className="px-0.5 text-[10px] leading-tight text-slate-400">
								{option.description}
							</span>
							<span className="pointer-events-none absolute inset-0 rounded-xl peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-cyan-400" />
						</label>
					);
				})}
			</div>
		</fieldset>
	);
};

// ─── Toolbar ─────────────────────────────────────────────────────────────────

const SettingSwitch = ({
	label,
	description,
	checked,
	onChange,
}: {
	label: string;
	description: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
}): FunctionComponent => {
	const inputId = useId();
	const descriptionId = useId();
	return (
		<div className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-800/50">
			<label className="min-w-0 flex-1 cursor-pointer" htmlFor={inputId}>
				<span className="block text-xs font-semibold text-slate-100">
					{label}
				</span>
				<span
					className="block text-[10px] leading-tight text-slate-400"
					id={descriptionId}
				>
					{description}
				</span>
			</label>
			<input
				aria-describedby={descriptionId}
				checked={checked}
				className="settings-switch"
				id={inputId}
				role="switch"
				type="checkbox"
				onChange={(event): void => {
					onChange(event.target.checked);
				}}
			/>
		</div>
	);
};

const ToolbarSection = (): FunctionComponent => {
	const toolbarVisibility = useChiptuneStore(
		(state) => state.toolbarVisibility
	);
	const setToolbarItemVisible = useChiptuneStore(
		(state) => state.setToolbarItemVisible
	);
	const applyToolbarPreset = useChiptuneStore(
		(state) => state.applyToolbarPreset
	);

	const isEssentials = matchesPreset(
		toolbarVisibility,
		buildToolbarPreset("essentials")
	);
	const isEverything = matchesPreset(
		toolbarVisibility,
		buildToolbarPreset("everything")
	);
	const shownCount = TOOLBAR_ITEMS.filter(
		(item) => toolbarVisibility[item.id]
	).length;

	const groups: Array<ToolbarGroup> = ["top", "piano"];

	return (
		<div className="flex flex-col gap-4">
			<div>
				<h3 className="mb-1 text-sm font-bold text-white">Toolbar</h3>
				<p className="mb-3 text-xs text-slate-400">
					Choose which buttons appear. Play, the screen, File / Export, Settings
					and the Select · Draw · Move · Erase tools always stay. Keyboard
					shortcuts keep working for hidden buttons.
				</p>
				<div className="flex flex-wrap items-center gap-2">
					<button
						aria-pressed={isEssentials}
						type="button"
						className={`inline-flex h-8 items-center rounded-lg border px-3 text-xs font-bold transition ${
							isEssentials
								? "border-cyan-400 bg-cyan-500/20 text-cyan-100"
								: "border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-500"
						}`}
						onClick={(): void => {
							applyToolbarPreset("essentials");
						}}
					>
						Essentials
					</button>
					<button
						aria-pressed={isEverything}
						type="button"
						className={`inline-flex h-8 items-center rounded-lg border px-3 text-xs font-bold transition ${
							isEverything
								? "border-cyan-400 bg-cyan-500/20 text-cyan-100"
								: "border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-500"
						}`}
						onClick={(): void => {
							applyToolbarPreset("everything");
						}}
					>
						Show everything
					</button>
					<span className="font-mono text-[10px] font-semibold text-slate-500">
						{shownCount}/{TOOLBAR_ITEMS.length} shown
						{!isEssentials && !isEverything ? " · custom" : ""}
					</span>
				</div>
			</div>

			{groups.map((group) => (
				<section key={group} aria-label={TOOLBAR_GROUP_LABELS[group]}>
					<h4 className="mb-1 px-2 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
						{TOOLBAR_GROUP_LABELS[group]}
					</h4>
					<div className="flex flex-col rounded-xl border border-slate-800 bg-slate-950/60 p-1">
						{TOOLBAR_ITEMS.filter((item) => item.group === group).map(
							(item: ToolbarItemDefinition) => (
								<SettingSwitch
									key={item.id}
									checked={toolbarVisibility[item.id]}
									description={item.description}
									label={item.label}
									onChange={(checked): void => {
										setToolbarItemVisible(item.id, checked);
									}}
								/>
							)
						)}
					</div>
				</section>
			))}
		</div>
	);
};

// ─── Editor ──────────────────────────────────────────────────────────────────

const EditorSection = (): FunctionComponent => {
	const followPlayhead = useChiptuneStore((state) => state.followPlayhead);
	const setFollowPlayhead = useChiptuneStore(
		(state) => state.setFollowPlayhead
	);
	const showVelocityLane = useChiptuneStore((state) => state.showVelocityLane);
	const toggleVelocityLane = useChiptuneStore(
		(state) => state.toggleVelocityLane
	);
	const showNoteVelocityLabels = useChiptuneStore(
		(state) => state.showNoteVelocityLabels
	);
	const toggleNoteVelocityLabels = useChiptuneStore(
		(state) => state.toggleNoteVelocityLabels
	);
	const showGhostNotes = useChiptuneStore((state) => state.showGhostNotes);
	const toggleShowGhostNotes = useChiptuneStore(
		(state) => state.toggleShowGhostNotes
	);
	const scaleLockOnly = useChiptuneStore((state) => state.scaleLockOnly);
	const toggleScaleLockOnly = useChiptuneStore(
		(state) => state.toggleScaleLockOnly
	);

	return (
		<div>
			<h3 className="mb-1 text-sm font-bold text-white">Editor</h3>
			<p className="mb-3 text-xs text-slate-400">
				How the piano roll and playback behave.
			</p>
			<div className="flex flex-col rounded-xl border border-slate-800 bg-slate-950/60 p-1">
				<SettingSwitch
					checked={followPlayhead}
					description="Keep the view on the bar that is playing"
					label="Follow playhead"
					onChange={setFollowPlayhead}
				/>
				<SettingSwitch
					checked={showVelocityLane}
					description="Per-note volume bars under the piano roll"
					label="Note volume lane"
					onChange={(checked): void => {
						if (checked !== showVelocityLane) {
							toggleVelocityLane();
						}
					}}
				/>
				<SettingSwitch
					checked={showNoteVelocityLabels}
					description="Print each note's volume (%) on the note"
					label="Volume numbers on notes"
					onChange={(checked): void => {
						if (checked !== showNoteVelocityLabels) {
							toggleNoteVelocityLabels();
						}
					}}
				/>
				<SettingSwitch
					checked={showGhostNotes}
					description="Faint notes from the other tracks in the same bar"
					label="Ghost notes"
					onChange={(checked): void => {
						if (checked !== showGhostNotes) {
							toggleShowGhostNotes();
						}
					}}
				/>
				<SettingSwitch
					checked={scaleLockOnly}
					description="Only show rows that are in the song's key and scale"
					label="Scale lock"
					onChange={(checked): void => {
						if (checked !== scaleLockOnly) {
							toggleScaleLockOnly();
						}
					}}
				/>
			</div>
		</div>
	);
};

// ─── Dialog ──────────────────────────────────────────────────────────────────

interface StudioSettingsDialogProps {
	isOpen: boolean;
	onClose: () => void;
	initialSection?: SettingsSection;
}

/**
 * Settings modal: app mode (Modern / Chiptune / SFX), theme picker, which toolbar controls are shown, and editor
 * options. Everything applies instantly and is saved with the studio.
 */
export const StudioSettingsDialog = ({
	isOpen,
	onClose,
	initialSection = "mode",
}: StudioSettingsDialogProps): FunctionComponent => {
	const titleId = useId();
	const dialogRef = useRef<HTMLDialogElement | null>(null);
	const [section, setSection] = useState<SettingsSection>(initialSection);

	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) {
			return;
		}
		if (isOpen && !dialog.open) {
			setSection(initialSection);
			dialog.showModal();
		} else if (!isOpen && dialog.open) {
			dialog.close();
		}
	}, [isOpen, initialSection]);

	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) {
			return;
		}
		const handleNativeClose = (): void => {
			dialog.returnValue = "";
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
	}, [onClose]);

	return (
		<dialog
			ref={dialogRef}
			aria-labelledby={titleId}
			className="settings-dialog m-auto h-[min(88dvh,42rem)] w-[min(94vw,46rem)] flex-col overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900 p-0 text-slate-100 shadow-2xl open:flex"
			{...({ closedby: "any" } as Record<string, string>)}
		>
			<div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
				<div>
					<h2 className="text-base font-bold text-white" id={titleId}>
						Settings
					</h2>
					<p className="text-xs text-slate-400">
						Changes apply right away and are saved with the studio.
					</p>
				</div>
				<form method="dialog">
					<button
						autoFocus
						aria-label="Close settings"
						className="flex size-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:text-white"
						type="submit"
						value="close"
					>
						<XMarkIcon aria-hidden="true" className="size-4" />
					</button>
				</form>
			</div>

			<div className="flex min-h-0 flex-1 flex-col sm:flex-row">
				<nav
					aria-label="Settings sections"
					className="flex shrink-0 gap-1 border-b border-slate-800 p-2 sm:w-40 sm:flex-col sm:border-r sm:border-b-0"
				>
					{SECTIONS.map((item) => {
						const Icon = item.icon;
						const isActive = section === item.id;
						return (
							<button
								key={item.id}
								aria-current={isActive ? "page" : undefined}
								type="button"
								className={`inline-flex h-8 flex-1 items-center gap-2 rounded-lg px-2.5 text-xs font-bold transition sm:flex-none ${
									isActive
										? "bg-cyan-500/20 text-cyan-200"
										: "text-slate-400 hover:bg-slate-800 hover:text-white"
								}`}
								onClick={(): void => {
									setSection(item.id);
								}}
							>
								<Icon aria-hidden="true" className="size-4 shrink-0" />
								<span>{item.label}</span>
							</button>
						);
					})}
				</nav>

				<div className="min-h-0 flex-1 overflow-y-auto p-4">
					{section === "mode" && <ModeSection />}
					{section === "theme" && <ThemeSection />}
					{section === "toolbar" && <ToolbarSection />}
					{section === "editor" && <EditorSection />}
				</div>
			</div>
		</dialog>
	);
};

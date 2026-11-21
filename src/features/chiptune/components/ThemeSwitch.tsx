import { useId } from "react";
import type { FunctionComponent } from "../../../common/types";
import { THEME_OPTIONS } from "../constants/themes";
import { useChiptuneStore } from "../store/useChiptuneStore";

/**
 * Three-position hardware slide switch: Neon · Dark · Light.
 * A native radio group underneath, so arrow keys and screen readers work.
 */
export const ThemeSwitch = (): FunctionComponent => {
	const instanceId = useId();
	const themeMode = useChiptuneStore((state) => state.themeMode);
	const setThemeMode = useChiptuneStore((state) => state.setThemeMode);
	const activeIndex = Math.max(
		0,
		THEME_OPTIONS.findIndex((option) => option.id === themeMode)
	);
	const activeOption = THEME_OPTIONS[activeIndex];

	return (
		<div className="flex items-center gap-1.5">
			<span
				aria-hidden="true"
				className="hidden w-9 text-right text-[11px] font-semibold text-slate-300 lg:inline"
			>
				{activeOption?.name}
			</span>
			<div
				aria-label="Theme"
				className="gear-switch"
				role="radiogroup"
				title={`Theme: ${activeOption?.name ?? ""} — ${activeOption?.description ?? ""}`}
			>
				<span
					aria-hidden="true"
					className="gear-switch-thumb"
					style={{ translate: `${activeIndex * 100}% 0` }}
				/>
				{THEME_OPTIONS.map((option) => (
					<span key={option.id} className="contents">
						<input
							aria-label={`${option.name} theme — ${option.description}`}
							checked={themeMode === option.id}
							id={`${instanceId}-theme-${option.id}`}
							name={`${instanceId}-studio-theme`}
							type="radio"
							value={option.id}
							onChange={(): void => {
								setThemeMode(option.id);
							}}
						/>
						<label
							htmlFor={`${instanceId}-theme-${option.id}`}
							title={option.name}
						>
							<span />
						</label>
					</span>
				))}
			</div>
		</div>
	);
};

import { useEffect, useId, useRef, type CSSProperties } from "react";
import type { FunctionComponent } from "../../../common/types";

interface SliderControlProps {
	label: string;
	value: number;
	min: number;
	max: number;
	step: number;
	formatValue?: (value: number) => string;
	accentColor?: string;
	inline?: boolean;
	onChange: (nextValue: number) => void;
}

export const SliderControl = ({
	label,
	value,
	min,
	max,
	step,
	formatValue,
	accentColor = "var(--accent)",
	inline = false,
	onChange,
}: SliderControlProps): FunctionComponent => {
	const inputId = useId();
	const sliderRef = useRef<HTMLInputElement | null>(null);
	const formattedText = formatValue ? formatValue(value) : String(value);

	useEffect(() => {
		const element = sliderRef.current;
		if (!element) {
			return;
		}
		element.style.setProperty("--attr-min", String(min));
		element.style.setProperty("--attr-max", String(max));
		element.style.setProperty("--control-value", String(value));
	}, [min, max, value]);

	const customStyle = {
		"--slider-accent": accentColor,
	} as CSSProperties;

	if (inline) {
		return (
			<div className="grid grid-cols-[6.75rem_minmax(0,1fr)_3.5rem] items-center gap-2">
				<label
					className="truncate text-[11px] font-medium text-slate-300 select-none"
					htmlFor={inputId}
				>
					{label}
				</label>
				<input
					ref={sliderRef}
					aria-valuetext={formattedText}
					className="chip-slider"
					id={inputId}
					max={max}
					min={min}
					step={step}
					style={customStyle}
					type="range"
					value={value}
					onChange={(event): void => {
						const parsed = Number.parseFloat(event.target.value);
						if (Number.isFinite(parsed)) {
							event.currentTarget.style.setProperty(
								"--control-value",
								event.target.value
							);
							onChange(parsed);
						}
					}}
				/>
				<span className="text-right font-mono text-[10px] font-semibold text-cyan-300">
					{formattedText}
				</span>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-0.5">
			<div className="flex items-center justify-between gap-2 text-xs">
				<label
					className="font-medium text-slate-300 select-none"
					htmlFor={inputId}
				>
					{label}
				</label>
				<span className="font-mono text-[11px] font-semibold text-cyan-300">
					{formattedText}
				</span>
			</div>
			<input
				ref={sliderRef}
				aria-valuetext={formattedText}
				className="chip-slider"
				id={inputId}
				max={max}
				min={min}
				step={step}
				style={customStyle}
				type="range"
				value={value}
				onChange={(event): void => {
					const parsed = Number.parseFloat(event.target.value);
					if (Number.isFinite(parsed)) {
						event.currentTarget.style.setProperty(
							"--control-value",
							event.target.value
						);
						onChange(parsed);
					}
				}}
			/>
		</div>
	);
};

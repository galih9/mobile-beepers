import type { FunctionComponent } from "../../../common/types";
import type { LoopMode } from "../types/music";

interface LcdReadoutProps {
	isPlaying: boolean;
	loopMode: LoopMode;
	bar: number;
	step: number;
	bpm: number;
	keyLabel: string;
	title: string;
	metronomeEnabled?: boolean;
}

const pad = (value: number): string => String(value).padStart(2, "0");

/**
 * The studio's LCD: bar:step in big pixel digits, tempo and key stacked
 * beside it, song title on the right. Status icons are LCD segments — always
 * printed on the glass, only lit when active.
 */
export const LcdReadout = ({
	isPlaying,
	loopMode,
	bar,
	step,
	bpm,
	keyLabel,
	title,
	metronomeEnabled = false,
}: LcdReadoutProps): FunctionComponent => {
	return (
		<div
			aria-label={`Bar ${bar}, step ${step}, ${bpm} BPM, ${keyLabel}${isPlaying ? ", playing" : ""}`}
			className="gear-lcd hidden h-10 min-w-0 items-center gap-3 px-3 md:flex"
			role="status"
		>
			{/* Status segments */}
			<div aria-hidden="true" className="flex shrink-0 flex-col gap-1">
				<svg
					className={isPlaying ? "gear-lcd-ink" : "gear-lcd-ghost"}
					height="10"
					viewBox="0 0 10 10"
					width="10"
				>
					<path d="M1 0 L9 5 L1 10 Z" fill="currentColor" />
				</svg>
				<svg
					className={loopMode === "once" ? "gear-lcd-ghost" : "gear-lcd-ink"}
					height="10"
					viewBox="0 0 10 10"
					width="10"
				>
					<path
						d="M2 3 H7 V1 L10 4 L7 7 V5 H2 Z M8 7 H3 V9 L0 6 L3 3 V5 H8 Z"
						fill="currentColor"
						opacity={loopMode === "bar" ? 0.6 : 1}
					/>
				</svg>
			</div>

			<span className="gear-lcd-ink shrink-0 text-[26px] leading-none font-bold tracking-tight">
				{pad(bar)}
				<span className={step % 4 === 1 ? "gear-lcd-ink" : "gear-lcd-ghost"}>
					:
				</span>
				{pad(step)}
			</span>

			<div className="flex shrink-0 flex-col text-[11px] leading-[1.1] font-medium">
				<span className="flex items-center gap-1.5">
					<span className="gear-lcd-ink-2">{Math.round(bpm)} bpm</span>
					<span
						aria-hidden="true"
						className={`text-[9px] font-bold tracking-wider ${
							metronomeEnabled ? "gear-lcd-ink-2" : "gear-lcd-ghost"
						}`}
					>
						CLK
					</span>
				</span>
				<span className="gear-lcd-ink">{keyLabel}</span>
			</div>

			<span
				className="gear-lcd-ink hidden max-w-48 min-w-0 truncate border-l pl-3 text-[13px] font-medium 2xl:inline"
				style={{ borderColor: "var(--lcd-ghost)" }}
				title={title}
			>
				{title}
			</span>
		</div>
	);
};

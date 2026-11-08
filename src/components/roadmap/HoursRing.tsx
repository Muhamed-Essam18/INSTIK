import { STAGE_NAMES, type Stage } from "@/lib/learner/profile-rules";
import { formatHours, spokenHours } from "@/lib/hours/totals";

const RADIUS = 76;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** The ring from the design: total hours in the middle, the arc showing progress through the current stage. */
export function HoursRing({ totalSeconds, stage, progress }: { totalSeconds: number; stage: Stage; progress: number }) {
  const arc = Math.max(0, Math.min(1, progress)) * CIRCUMFERENCE;
  return (
    <svg
      width="180"
      height="180"
      viewBox="0 0 180 180"
      role="img"
      aria-label={`${spokenHours(totalSeconds)} counted. Progress through the ${STAGE_NAMES[stage]} stage: ${Math.round(progress * 100)} percent.`}
      className="shrink-0"
    >
      <circle cx="90" cy="90" r={RADIUS} fill="none" strokeWidth="16" className="stroke-coral-tint" />
      {arc > 0 ? (
        <circle
          cx="90"
          cy="90"
          r={RADIUS}
          fill="none"
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={`${arc} ${CIRCUMFERENCE}`}
          transform="rotate(-90 90 90)"
          className="stroke-coral"
        />
      ) : null}
      <text x="90" y="86" textAnchor="middle" className="fill-ink font-display text-[34px] font-extrabold">
        {formatHours(totalSeconds)}
      </text>
      <text x="90" y="112" textAnchor="middle" className="fill-slate text-sm">
        Hours
      </text>
    </svg>
  );
}

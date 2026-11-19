import type { DashboardData } from "@/lib/earnings/dashboard-data";

/**
 * Counted views for each of the last five weeks, as bars. This week so far is coral; the others are a soft tint. The chart is an image with a text
 * alternative that lists every number, and each bar also shows its number as text.
 */
export function WeeklyViews({ weeks }: { weeks: DashboardData["weeks"] }) {
  const most = Math.max(1, ...weeks.map((w) => w.count));
  const alternative = `Counted views per week: ${weeks.map((w) => `week of ${w.label}, ${w.count}${w.current ? " so far" : ""}`).join("; ")}.`;
  return (
    <div className="flex flex-col gap-space-3 rounded-lg bg-paper p-space-6 shadow-sm">
      <div role="img" aria-label={alternative} className="flex h-[210px] items-end gap-space-3">
        {weeks.map((week) => (
          <div key={week.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
            <span className="text-caption font-semibold text-ink">{week.count}</span>
            <span
              style={{ height: `${Math.max(2, Math.round((week.count / most) * 150))}px` }}
              className={`w-full max-w-12 rounded-t-sm ${week.current ? "bg-coral" : "bg-coral-tint"}`}
            />
            <span className="text-caption text-slate">{week.label}</span>
          </div>
        ))}
      </div>
      <p className="m-0 text-caption text-slate">Counted views per week. This week so far is in coral.</p>
    </div>
  );
}

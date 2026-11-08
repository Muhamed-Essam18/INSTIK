import type { Rhythm } from "@/lib/hours/rhythm";

/** "Your rhythm": days watched in the last 8 weeks. No streaks and nothing to lose. */
export function RhythmGrid({ rhythm }: { rhythm: Rhythm }) {
  const summary =
    rhythm.watchedDays === 0
      ? "No days watched yet in the last 8 weeks."
      : `Watched on ${rhythm.watchedDays} ${rhythm.watchedDays === 1 ? "day" : "days"} in the last 8 weeks.`;
  return (
    <section aria-labelledby="rhythm-heading" className="flex min-w-0 flex-[1_1_520px] flex-col gap-space-4 rounded-lg bg-paper p-space-8">
      <div className="flex flex-wrap items-baseline gap-space-3">
        <h2 id="rhythm-heading" className="m-0 grow font-display text-[26px] leading-8 font-extrabold text-ink">
          Your rhythm
        </h2>
        <span className="text-label font-normal text-slate">Days you watched, last 8 weeks</span>
      </div>
      <div
        role="img"
        aria-label={`Calendar of days watched. ${summary}`}
        className="grid grid-cols-8 gap-space-2"
      >
        {rhythm.weeks.map((week) => (
          <div key={week[0].day} className="grid grid-rows-7 gap-space-2">
            {week.map((d) => (
              <span
                key={d.day}
                data-state={d.state}
                className={`block h-7 rounded-sm ${
                  d.state === "watched"
                    ? "bg-teal"
                    : d.state === "rest"
                      ? "border border-hairline bg-cream"
                      : "border border-dashed border-hairline bg-transparent opacity-60"
                } ${d.today ? "outline-2 outline-offset-1 outline-ink" : ""}`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-space-6 text-caption text-slate">
        <span className="flex items-center gap-space-2">
          <span aria-hidden="true" className="size-3.5 rounded-pill bg-teal" />
          Watched
        </span>
        <span className="flex items-center gap-space-2">
          <span aria-hidden="true" className="size-3.5 rounded-pill border border-hairline bg-cream" />
          Rest day
        </span>
        <span>No streaks. A rest day never costs you anything.</span>
      </div>
    </section>
  );
}

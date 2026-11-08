import type { StripDay } from "@/lib/hours/rhythm";

const dot: Record<"watched" | "today" | "rest" | "future", string> = {
  watched: "bg-teal",
  today: "bg-coral",
  rest: "box-border border-2 border-cream/30",
  future: "box-border border-2 border-dashed border-cream/30",
};

const spoken = { watched: "watched", today: "today", rest: "rest day", future: "still to come" } as const;

/** This week, Monday to Sunday, on the Done screen. Rest days are plain; nothing is lost. */
export function WeekStrip({ days }: { days: StripDay[] }) {
  return (
    <div className="flex w-full flex-col items-center gap-space-3">
      <span className="text-label">This week</span>
      <ul aria-label="Days you watched this week" className="m-0 flex list-none gap-2.5 p-0">
        {days.map((d) => {
          const kind = d.today ? "today" : d.state;
          return (
            <li
              key={d.day}
              className={`flex flex-col items-center gap-1.5 text-xs ${d.state === "future" ? "text-cream/70" : ""}`}
            >
              <span aria-hidden="true" className={`block size-7 rounded-pill ${dot[kind]}`} />
              {d.today ? "Today" : d.label}
              <span className="sr-only">{`, ${spoken[kind]}`}</span>
            </li>
          );
        })}
      </ul>
      <span className="text-caption text-cream/80">Missed a day? That&apos;s fine. Nothing is lost.</span>
    </div>
  );
}

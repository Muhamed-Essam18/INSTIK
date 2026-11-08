import type { DoneView, RoadmapView } from "@/lib/hours/queries";
import { buildRhythm } from "@/lib/hours/rhythm";
import { stageStates } from "@/lib/hours/stages";

/** A plausible Roadmap view for tests; override what a test cares about. */
export function roadmapView(over: Partial<RoadmapView> = {}): RoadmapView {
  return {
    today: "2026-11-11",
    timeZone: "UTC",
    watchedSeconds: 36_000,
    addedMinutes: 160,
    totalSeconds: 45_600,
    todaySeconds: 0,
    videosToday: 0,
    languageName: "Egyptian Arabic",
    stage: "FOLLOW_IT",
    states: stageStates("FOLLOW_IT"),
    progress: 0.38,
    moreHours: 87,
    nextStage: "UNDERSTAND_IT",
    hasEstimates: true,
    rhythm: buildRhythm({ today: "2026-11-11", watchedByDay: { "2026-11-09": 900, "2026-11-10": 1200 }, addedDays: ["2026-11-03"] }),
    entries: [{ id: "m1", day: "2026-11-03", minutes: 160 }],
    minutesPerDay: 20,
    remindersOn: false,
    hourSound: true,
    ...over,
  };
}

export function doneView(over: Partial<DoneView> = {}): DoneView {
  return {
    languageName: "Egyptian Arabic",
    todaySeconds: 24 * 60,
    videosToday: 3,
    totalSeconds: 13 * 3600 + 4 * 60,
    strip: [
      { day: "2026-11-09", label: "Mon", state: "watched", today: false },
      { day: "2026-11-10", label: "Tue", state: "watched", today: false },
      { day: "2026-11-11", label: "Wed", state: "watched", today: true },
      { day: "2026-11-12", label: "Thu", state: "future", today: false },
      { day: "2026-11-13", label: "Fri", state: "future", today: false },
      { day: "2026-11-14", label: "Sat", state: "future", today: false },
      { day: "2026-11-15", label: "Sun", state: "future", today: false },
    ],
    ...over,
  };
}

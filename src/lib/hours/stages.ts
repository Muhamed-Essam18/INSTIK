// Stage rules for the roadmap. Pure. Stage names only: internal content levels never reach the learner.
import type { RoadmapEstimates } from "@/lib/languages.schema";
import { STAGES, type Stage } from "@/lib/learner/profile-rules";

export type StageState = "done" | "here" | "next" | "later";

/** The hours at which `stage` is passed, or undefined when the language gives no estimate for it. */
export function thresholdFor(stage: Stage, estimates: RoadmapEstimates | undefined): number | undefined {
  return estimates?.stages.find((s) => s.stage === stage)?.upToHours;
}

export const nextStage = (stage: Stage): Stage | undefined => STAGES[STAGES.indexOf(stage) + 1];

/**
 * The stage after counting `totalHours`: forward only, as far as the estimates carry it, never back.
 * Without an estimate for the current stage it stays put.
 */
export function advanceStage(current: Stage, totalHours: number, estimates: RoadmapEstimates | undefined): Stage {
  let stage = current;
  for (;;) {
    const limit = thresholdFor(stage, estimates);
    const next = nextStage(stage);
    if (limit === undefined || next === undefined || !(totalHours > limit)) return stage;
    stage = next;
  }
}

/** Progress through `stage` from 0 to 1, measured from the end of the stage before it. 0 without an estimate. */
export function stageProgress(stage: Stage, totalHours: number, estimates: RoadmapEstimates | undefined): number {
  const to = thresholdFor(stage, estimates);
  if (to === undefined) return 0;
  const previous = STAGES[STAGES.indexOf(stage) - 1];
  const from = (previous && thresholdFor(previous, estimates)) || 0;
  if (!(totalHours > from)) return 0;
  return Math.min(1, (totalHours - from) / (to - from));
}

/** Whole hours still to go in `stage`, rounded up. Null with no estimate and null (never negative) once past it. */
export function moreHours(stage: Stage, totalHours: number, estimates: RoadmapEstimates | undefined): number | null {
  const to = thresholdFor(stage, estimates);
  if (to === undefined || totalHours >= to) return null;
  return Math.max(1, Math.ceil(to - totalHours));
}

export function stageStates(current: Stage): Array<{ stage: Stage; state: StageState }> {
  const at = STAGES.indexOf(current);
  return STAGES.map((stage, i) => ({
    stage,
    state: i < at ? "done" : i === at ? "here" : i === at + 1 ? "next" : "later",
  }));
}

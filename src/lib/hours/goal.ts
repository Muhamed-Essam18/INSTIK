// Done for today: when the day's goal has been reached and the screen has not been shown for it yet. Pure.
import { isWatched } from "./watched";

/** True exactly when today's counted time covers one more goal-sized block than the ones already acknowledged. */
export function shouldShowDone(todaySeconds: number, goalSeconds: number, doneBlocks: number): boolean {
  if (!(goalSeconds > 0) || !Number.isFinite(todaySeconds)) return false;
  return todaySeconds >= goalSeconds * (Math.max(0, doneBlocks) + 1);
}

/** Whole goal-sized blocks reached so far today. */
export function blocksReached(todaySeconds: number, goalSeconds: number): number {
  if (!(goalSeconds > 0) || !(todaySeconds > 0)) return 0;
  return Math.floor(todaySeconds / goalSeconds);
}

/** Blocks already acknowledged today: a new local day starts again from 0. */
export function effectiveDoneBlocks(doneDay: string | null, today: string, doneBlocks: number): number {
  return doneDay === today ? Math.max(0, doneBlocks) : 0;
}

export type DoneDecision = { show: boolean; doneBlocks: number };

/**
 * Called when a video ends. Done for today is shown only after the video has really been watched to its end
 * (never mid-video) and only for a goal-sized block that has not been acknowledged yet.
 */
export function decideDone(input: {
  position: number;
  duration: number;
  todaySeconds: number;
  goalSeconds: number;
  doneDay: string | null;
  doneBlocks: number;
  today: string;
}): DoneDecision {
  const acknowledged = effectiveDoneBlocks(input.doneDay, input.today, input.doneBlocks);
  if (!isWatched(input.position, input.duration)) return { show: false, doneBlocks: acknowledged };
  if (!shouldShowDone(input.todaySeconds, input.goalSeconds, acknowledged)) {
    return { show: false, doneBlocks: acknowledged };
  }
  return { show: true, doneBlocks: blocksReached(input.todaySeconds, input.goalSeconds) };
}

// Server-side check of one counted interval. Pure: the server passes its own clock and the learner's stored state.
// Each interval is judged against its own length, may not overlap time already counted, and may not end in the
// future, so real time is the ceiling no matter how many tabs or devices send. See contracts/counting-rules.md.

export const MAX_INTERVAL_SECONDS = 20;
/** An interval that ended more than this long ago is "late" (it waited in the offline queue). */
export const LATE_AFTER_SECONDS = 30;
/** Late intervals together add at most this many counted seconds per window. */
export const LATE_BUDGET_SECONDS = 300;
export const LATE_WINDOW_MS = 10 * 60 * 1000;
/** Intervals older than this are never accepted. */
export const MAX_AGE_SECONDS = 24 * 60 * 60;
/** Slack for network jitter when comparing an interval's start with the end of the last counted one. */
export const OVERLAP_TOLERANCE_MS = 2000;

export type IntervalInput = {
  /** Counted seconds inside the interval. */
  seconds: number;
  /** How long the interval lasted, in seconds. */
  spanSeconds: number;
  /** How long ago it ended, in seconds, measured by the sender just before sending. */
  endedAgoSeconds: number;
  /** The server's clock, in epoch milliseconds. */
  now: number;
  /** End of the last accepted interval for this learner and language, or null. */
  countedUntil: number | null;
  lateWindowStart: number | null;
  lateSeconds: number;
};

export type IntervalDecision =
  | {
      ok: true;
      accepted: number;
      /** Epoch milliseconds of the interval on the server's clock. */
      startMs: number;
      endMs: number;
      countedUntil: number;
      lateWindowStart: number | null;
      lateSeconds: number;
    }
  | { ok: false; reason: "invalid" | "too-long" | "too-old" | "overlap" };

const finiteNonNegative = (n: number) => Number.isFinite(n) && n >= 0;

export function acceptInterval(input: IntervalInput): IntervalDecision {
  const { seconds, spanSeconds, endedAgoSeconds, now, countedUntil } = input;
  if (!finiteNonNegative(seconds) || !finiteNonNegative(spanSeconds) || !finiteNonNegative(endedAgoSeconds)) {
    return { ok: false, reason: "invalid" };
  }
  if (!Number.isFinite(now)) return { ok: false, reason: "invalid" };
  if (spanSeconds > MAX_INTERVAL_SECONDS) return { ok: false, reason: "too-long" };
  if (endedAgoSeconds > MAX_AGE_SECONDS) return { ok: false, reason: "too-old" };

  const endMs = now - endedAgoSeconds * 1000;
  const startMs = endMs - spanSeconds * 1000;
  if (countedUntil !== null && startMs < countedUntil - OVERLAP_TOLERANCE_MS) return { ok: false, reason: "overlap" };

  let accepted = Math.max(0, Math.min(seconds, spanSeconds, MAX_INTERVAL_SECONDS));
  let { lateWindowStart, lateSeconds } = input;

  if (endedAgoSeconds > LATE_AFTER_SECONDS) {
    if (lateWindowStart === null || now - lateWindowStart > LATE_WINDOW_MS || now < lateWindowStart) {
      lateWindowStart = now;
      lateSeconds = 0;
    }
    accepted = Math.max(0, Math.min(accepted, LATE_BUDGET_SECONDS - lateSeconds));
    lateSeconds += accepted;
  }

  return {
    ok: true,
    accepted,
    startMs,
    endMs,
    countedUntil: Math.max(endMs, countedUntil ?? endMs),
    lateWindowStart,
    lateSeconds,
  };
}

export const WAITLIST_LIMIT_PER_HOUR = 10;

export type WaitlistThrottleResult = { ok: true } | { ok: false; code: "too-many" };

/** Whether this visitor may try again: at most 10 waitlist attempts an hour. */
export function evaluateWaitlistThrottle({ visitorCountLastHour }: { visitorCountLastHour: number }): WaitlistThrottleResult {
  return visitorCountLastHour >= WAITLIST_LIMIT_PER_HOUR ? { ok: false, code: "too-many" } : { ok: true };
}

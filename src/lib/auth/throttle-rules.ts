export const EMAIL_LIMIT_PER_HOUR = 5;
export const VISITOR_LIMIT_PER_HOUR = 20;
export const MIN_SECONDS_BETWEEN_SENDS = 30;

export type ThrottleInput = {
  /** Sign-in links already sent to this address in the last hour. */
  emailCountLastHour: number;
  /** Sign-in links requested by this visitor in the last hour (any address). */
  visitorCountLastHour: number;
  /** When the last link was sent to this address, if any. */
  lastEmailSendAt: Date | null;
  now: Date;
};

export type ThrottleResult = { ok: true } | { ok: false; code: "too-many" };

/** Whether another sign-in link may be sent: 5 per address and 20 per visitor an hour, 30 seconds apart. */
export function evaluateThrottle({
  emailCountLastHour,
  visitorCountLastHour,
  lastEmailSendAt,
  now,
}: ThrottleInput): ThrottleResult {
  if (emailCountLastHour >= EMAIL_LIMIT_PER_HOUR) return { ok: false, code: "too-many" };
  if (visitorCountLastHour >= VISITOR_LIMIT_PER_HOUR) return { ok: false, code: "too-many" };
  if (lastEmailSendAt && now.getTime() - lastEmailSendAt.getTime() < MIN_SECONDS_BETWEEN_SENDS * 1000) {
    return { ok: false, code: "too-many" };
  }
  return { ok: true };
}

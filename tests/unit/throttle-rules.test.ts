import { describe, expect, it } from "vitest";
import { evaluateThrottle } from "@/lib/auth/throttle-rules";

const now = new Date("2026-11-06T12:00:00Z");
const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000);
const input = { emailCountLastHour: 0, visitorCountLastHour: 0, lastEmailSendAt: null, now };

describe("evaluateThrottle", () => {
  it("allows a first request", () => {
    expect(evaluateThrottle(input)).toEqual({ ok: true });
  });

  it("allows up to 5 links to one address an hour and refuses the sixth", () => {
    expect(evaluateThrottle({ ...input, emailCountLastHour: 4 })).toEqual({ ok: true });
    expect(evaluateThrottle({ ...input, emailCountLastHour: 5 })).toEqual({ ok: false, code: "too-many" });
  });

  it("allows 19 requests from one visitor an hour and refuses the 21st", () => {
    expect(evaluateThrottle({ ...input, visitorCountLastHour: 19 })).toEqual({ ok: true });
    expect(evaluateThrottle({ ...input, visitorCountLastHour: 20 })).toEqual({ ok: false, code: "too-many" });
  });

  it("needs 30 seconds between two links to the same address", () => {
    expect(evaluateThrottle({ ...input, lastEmailSendAt: ago(29) })).toEqual({ ok: false, code: "too-many" });
    expect(evaluateThrottle({ ...input, lastEmailSendAt: ago(30) })).toEqual({ ok: true });
    expect(evaluateThrottle({ ...input, lastEmailSendAt: ago(300) })).toEqual({ ok: true });
  });
});

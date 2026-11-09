import { describe, expect, it } from "vitest";
import { evaluateWaitlistThrottle } from "@/lib/waitlist/throttle-rules";

describe("evaluateWaitlistThrottle", () => {
  it("allows up to ten attempts an hour", () => {
    expect(evaluateWaitlistThrottle({ visitorCountLastHour: 0 })).toEqual({ ok: true });
    expect(evaluateWaitlistThrottle({ visitorCountLastHour: 9 })).toEqual({ ok: true });
  });
  it("refuses the eleventh", () => {
    expect(evaluateWaitlistThrottle({ visitorCountLastHour: 10 })).toEqual({ ok: false, code: "too-many" });
  });
});

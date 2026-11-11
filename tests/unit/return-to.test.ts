import { describe, expect, it } from "vitest";
import { sanitiseReturnTo } from "@/lib/auth/return-to";

const FALLBACK = "/learn/arabic-egyptian";

describe("sanitiseReturnTo", () => {
  it.each([
    "/learn/arabic-egyptian/watch/at-the-cafe",
    "/learn/arabic-egyptian",
    "/learn/arabic-egyptian/roadmap",
    "/learn/arabic-egyptian/done",
    "/learn/arabic-egyptian/hosts/mona",
    "/settings",
    "/onboarding/finish?returnTo=%2Fsettings",
    "/settings/add-language?language=es&returnTo=%2Flearn%2Fspanish",
    "/learn/arabic-egyptian/watch/at-the-cafe?t=30",
    "/pricing",
    "/billing/start?period=monthly",
    "/billing/start?period=yearly",
  ])("accepts %s", (path) => {
    expect(sanitiseReturnTo(path, FALLBACK)).toBe(path);
  });

  it.each([
    "//evil.com",
    String.raw`/\evil.com`,
    String.raw`/learn/arabic-egyptian\watch`,
    "https://evil.com",
    "javascript:alert(1)",
    "learn/arabic-egyptian",
    "/learn/arabic-egyptian\n/watch/x",
    "/learn/arabic-egyptian/watch/x\u0000",
    "/api/auth/signout",
    "/billing/start",
    "/billing/start?period=weekly",
    "/billing/start?period=yearly&x=1",
    "/billing/return?session_id=cs_x",
    "/billing/portal",
    "/api/stripe/webhook",
    "/learn/arabic-egyptian/../../etc",
    "/learn//watch",
    `/learn/${"a".repeat(600)}`,
  ])("refuses %j", (value) => {
    expect(sanitiseReturnTo(value, FALLBACK)).toBe(FALLBACK);
  });

  it("refuses values that are not strings", () => {
    expect(sanitiseReturnTo(undefined, FALLBACK)).toBe(FALLBACK);
    expect(sanitiseReturnTo(["/settings"], FALLBACK)).toBe(FALLBACK);
    expect(sanitiseReturnTo(null, FALLBACK)).toBe(FALLBACK);
    expect(sanitiseReturnTo(42, FALLBACK)).toBe(FALLBACK);
  });
});

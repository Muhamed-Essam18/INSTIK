import { describe, expect, it } from "vitest";
import { gateRedirect, hasSessionCookie, isProtectedPath } from "@/lib/auth/gate";

describe("isProtectedPath", () => {
  it.each([
    "/learn/arabic-egyptian/watch/at-the-cafe",
    "/learn/arabic-egyptian/roadmap",
    "/learn/arabic-egyptian/done",
    "/settings",
    "/settings/add-language",
  ])("protects %s", (path) => {
    expect(isProtectedPath(path)).toBe(true);
  });

  it.each([
    "/",
    "/pricing",
    "/onboarding",
    "/onboarding/finish",
    "/sign-in",
    "/learn/arabic-egyptian",
    "/learn/arabic-egyptian/hosts",
    "/learn/arabic-egyptian/hosts/mona",
    "/api/auth/session",
  ])("leaves %s open", (path) => {
    expect(isProtectedPath(path)).toBe(false);
  });
});

describe("hasSessionCookie", () => {
  it("accepts the plain and the secure Auth.js cookie names", () => {
    expect(hasSessionCookie([{ name: "authjs.session-token", value: "abc" }])).toBe(true);
    expect(hasSessionCookie([{ name: "__Secure-authjs.session-token", value: "abc" }])).toBe(true);
  });

  it("refuses other names and empty values", () => {
    expect(hasSessionCookie([{ name: "theme", value: "dark" }])).toBe(false);
    expect(hasSessionCookie([{ name: "authjs.session-token", value: "" }])).toBe(false);
    expect(hasSessionCookie([])).toBe(false);
  });
});

describe("gateRedirect", () => {
  it("sends watch paths to onboarding with the encoded return address", () => {
    expect(gateRedirect("/learn/arabic-egyptian/watch/at-the-cafe", "")).toBe(
      "/onboarding?returnTo=%2Flearn%2Farabic-egyptian%2Fwatch%2Fat-the-cafe",
    );
  });

  it("keeps the query string in the return address", () => {
    expect(gateRedirect("/learn/arabic-egyptian/watch/at-the-cafe", "?t=30")).toBe(
      "/onboarding?returnTo=%2Flearn%2Farabic-egyptian%2Fwatch%2Fat-the-cafe%3Ft%3D30",
    );
  });

  it("sends roadmap, done and settings to sign-in", () => {
    expect(gateRedirect("/learn/arabic-egyptian/roadmap", "")).toBe(
      "/sign-in?returnTo=%2Flearn%2Farabic-egyptian%2Froadmap",
    );
    expect(gateRedirect("/learn/arabic-egyptian/done", "")).toBe(
      "/sign-in?returnTo=%2Flearn%2Farabic-egyptian%2Fdone",
    );
    expect(gateRedirect("/settings", "")).toBe("/sign-in?returnTo=%2Fsettings");
  });
});

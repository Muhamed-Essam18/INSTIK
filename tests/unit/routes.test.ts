import { describe, expect, it } from "vitest";
import {
  donePath,
  hostsPath,
  landingPath,
  languageSlugFromPathname,
  libraryPath,
  onboardingPath,
  pricingPath,
  roadmapPath,
  watchPath,
} from "@/lib/routes";

describe("path builders", () => {
  it("builds language-independent paths", () => {
    expect(landingPath()).toBe("/");
    expect(onboardingPath()).toBe("/onboarding");
    expect(pricingPath()).toBe("/pricing");
  });

  it("builds language-scoped paths", () => {
    expect(libraryPath("arabic-egyptian")).toBe("/learn/arabic-egyptian");
    expect(watchPath("arabic-egyptian")).toBe("/learn/arabic-egyptian/watch");
    expect(donePath("arabic-egyptian")).toBe("/learn/arabic-egyptian/done");
    expect(roadmapPath("arabic-egyptian")).toBe("/learn/arabic-egyptian/roadmap");
    expect(hostsPath("arabic-egyptian")).toBe("/learn/arabic-egyptian/hosts");
  });
});

describe("languageSlugFromPathname", () => {
  it("returns the slug inside language paths", () => {
    expect(languageSlugFromPathname("/learn/arabic-egyptian")).toBe("arabic-egyptian");
    expect(languageSlugFromPathname("/learn/arabic-egyptian/hosts")).toBe("arabic-egyptian");
  });

  it("returns undefined elsewhere", () => {
    expect(languageSlugFromPathname("/")).toBeUndefined();
    expect(languageSlugFromPathname("/pricing")).toBeUndefined();
    expect(languageSlugFromPathname("/learn")).toBeUndefined();
  });
});

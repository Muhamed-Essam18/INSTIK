import { describe, expect, it } from "vitest";
import {
  INVITE_LIFETIME_DAYS,
  creatorPath,
  invitePath,
  ownerCreatorsPath,
  ownerPath,
  billingPortalPath,
  billingReturnPath,
  billingStartPath,
  addLanguagePath,
  onboardingFinishPath,
  settingsPath,
  signInPath,
  donePath,
  hostPath,
  hostsPath,
  landingPath,
  languageSlugFromPathname,
  libraryPath,
  onboardingPath,
  pricingPath,
  roadmapPath,
  watchPath,
  watchVideoPath,
} from "@/lib/routes";

describe("path builders", () => {
  it("builds language-independent paths", () => {
    expect(landingPath()).toBe("/");
    expect(onboardingPath()).toBe("/onboarding");
    expect(pricingPath()).toBe("/pricing");
  });

  it("builds account paths and encodes the return address", () => {
    expect(onboardingPath("/learn/arabic-egyptian/watch/at-the-cafe")).toBe(
      "/onboarding?returnTo=%2Flearn%2Farabic-egyptian%2Fwatch%2Fat-the-cafe",
    );
    expect(onboardingFinishPath()).toBe("/onboarding/finish");
    expect(onboardingFinishPath("/settings")).toBe("/onboarding/finish?returnTo=%2Fsettings");
    expect(signInPath()).toBe("/sign-in");
    expect(signInPath("/settings")).toBe("/sign-in?returnTo=%2Fsettings");
    expect(settingsPath()).toBe("/settings");
    expect(addLanguagePath()).toBe("/settings/add-language");
    expect(addLanguagePath("es", "/learn/spanish")).toBe("/settings/add-language?language=es&returnTo=%2Flearn%2Fspanish");
  });

  it("builds language-scoped paths", () => {
    expect(libraryPath("arabic-egyptian")).toBe("/learn/arabic-egyptian");
    expect(watchPath("arabic-egyptian")).toBe("/learn/arabic-egyptian/watch");
    expect(donePath("arabic-egyptian")).toBe("/learn/arabic-egyptian/done");
    expect(roadmapPath("arabic-egyptian")).toBe("/learn/arabic-egyptian/roadmap");
    expect(hostsPath("arabic-egyptian")).toBe("/learn/arabic-egyptian/hosts");
    expect(hostPath("arabic-egyptian", "salma")).toBe("/learn/arabic-egyptian/hosts/salma");
    expect(watchVideoPath("arabic-egyptian", "at-the-cafe")).toBe("/learn/arabic-egyptian/watch/at-the-cafe");
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

describe("billing paths", () => {
  it("builds the checkout start, portal and return paths", () => {
    expect(billingStartPath("monthly")).toBe("/billing/start?period=monthly");
    expect(billingStartPath("yearly")).toBe("/billing/start?period=yearly");
    expect(billingPortalPath()).toBe("/billing/portal");
    expect(billingPortalPath("cancel")).toBe("/billing/portal?flow=cancel");
    expect(billingReturnPath()).toBe("/billing/return");
  });
});

describe("creator programme paths", () => {
  it("builds the invite, creator and owner paths", () => {
    expect(invitePath("abc_123")).toBe("/invite/abc_123");
    expect(creatorPath()).toBe("/creator");
    expect(ownerPath()).toBe("/owner");
    expect(ownerCreatorsPath()).toBe("/owner/creators");
    expect(INVITE_LIFETIME_DAYS).toBe(7);
  });
});

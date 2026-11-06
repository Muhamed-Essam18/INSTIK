import { describe, expect, it } from "vitest";
import type { Language } from "@/lib/languages.schema";
import {
  DEFAULT_LEVEL,
  DEFAULT_MINUTES,
  LEVELS,
  applyProfileChange,
  canAddProfile,
  isValidMinutes,
  isValidStage,
  languagesToOffer,
  stageForLevel,
  watchAccess,
  type Profile,
} from "@/lib/learner/profile-rules";

const base: Pick<Language, "nativeName" | "direction" | "fonts" | "transcriptLayers"> = {
  nativeName: "x",
  direction: "ltr",
  fonts: { ui: "sans", transcript: "sans" },
  transcriptLayers: ["script", "english"],
};
const arabic: Language = { ...base, code: "arz", slug: "arabic-egyptian", name: "Arabic", script: "arabic", status: "available" };
const spanish: Language = { ...base, code: "es", slug: "spanish", name: "Spanish", script: "latin", status: "coming-soon" };
const french: Language = { ...base, code: "fr", slug: "french", name: "French", script: "latin", status: "available" };
const all = [arabic, spanish, french];

const arz: Profile = { languageCode: "arz", stage: "HEAR_IT", minutesPerDay: 20 };
const fr: Profile = { languageCode: "fr", stage: "FOLLOW_IT", minutesPerDay: 30 };

describe("levels and stages", () => {
  it("maps the onboarding levels to learner stages", () => {
    expect(stageForLevel("none")).toBe("HEAR_IT");
    expect(stageForLevel("few")).toBe("HEAR_IT");
    expect(stageForLevel("slow")).toBe("FOLLOW_IT");
    expect(stageForLevel("most")).toBe("UNDERSTAND_IT");
  });

  it("offers four levels and never Join in during onboarding", () => {
    expect(LEVELS.map((l) => l.id)).toEqual(["none", "few", "slow", "most"]);
    expect(LEVELS.some((l) => (l.stage as string) === "JOIN_IN")).toBe(false);
    expect(isValidStage("JOIN_IN")).toBe(true);
  });

  it("has the design's defaults", () => {
    expect(DEFAULT_MINUTES).toBe(20);
    expect(DEFAULT_LEVEL).toBe("none");
  });

  it("accepts only 10, 20, 30 and 60 minutes", () => {
    for (const m of [10, 20, 30, 60]) expect(isValidMinutes(m)).toBe(true);
    for (const m of [0, 15, 45, 90, -10, 20.5, "20", null, undefined]) expect(isValidMinutes(m)).toBe(false);
  });

  it("accepts only the four stages", () => {
    for (const s of ["HEAR_IT", "FOLLOW_IT", "UNDERSTAND_IT", "JOIN_IN"]) expect(isValidStage(s)).toBe(true);
    for (const s of ["BEGINNER", "hear_it", "", null, 3]) expect(isValidStage(s)).toBe(false);
  });
});

describe("canAddProfile", () => {
  it("allows an available language the learner does not have", () => {
    expect(canAddProfile([arz], "fr", all)).toEqual({ ok: true });
  });

  it("refuses an unknown code", () => {
    expect(canAddProfile([], "xx", all)).toEqual({ ok: false, reason: "unknown" });
  });

  it("refuses a coming-soon language", () => {
    expect(canAddProfile([], "es", all)).toEqual({ ok: false, reason: "unavailable" });
  });

  it("refuses a language already added", () => {
    expect(canAddProfile([arz], "arz", all)).toEqual({ ok: false, reason: "exists" });
  });
});

describe("applyProfileChange", () => {
  it("changes only the named profile", () => {
    const profiles = [arz, fr];
    const next = applyProfileChange(profiles, { languageCode: "fr", minutesPerDay: 60 });
    expect(next[1]).toEqual({ languageCode: "fr", stage: "FOLLOW_IT", minutesPerDay: 60 });
    expect(next[0]).toBe(arz);
    expect(profiles[1]).toBe(fr);
  });

  it("changes stage and minutes together", () => {
    const next = applyProfileChange([arz], { languageCode: "arz", stage: "JOIN_IN", minutesPerDay: 10 });
    expect(next[0]).toEqual({ languageCode: "arz", stage: "JOIN_IN", minutesPerDay: 10 });
  });

  it("leaves everything alone when the language is not there", () => {
    expect(applyProfileChange([arz], { languageCode: "fr", minutesPerDay: 10 })).toEqual([arz]);
  });
});

describe("languagesToOffer", () => {
  it("marks each language as available, added or waitlist", () => {
    const offered = languagesToOffer(all, [arz]);
    expect(offered.map((o) => [o.language.code, o.state])).toEqual([
      ["arz", "added"],
      ["es", "waitlist"],
      ["fr", "available"],
    ]);
  });

  it("offers an available language to someone with no profiles", () => {
    expect(languagesToOffer(all, []).map((o) => o.state)).toEqual(["available", "waitlist", "available"]);
  });

  it("lets a language that becomes available later be added", () => {
    const later = [{ ...spanish, status: "available" as const }];
    expect(languagesToOffer(later, [])[0].state).toBe("available");
    expect(canAddProfile([], "es", later)).toEqual({ ok: true });
  });
});

describe("watchAccess", () => {
  it("is ok with a profile for an available language", () => {
    expect(watchAccess({ language: arabic, profile: arz })).toBe("ok");
  });

  it("asks for a profile when there is none", () => {
    expect(watchAccess({ language: arabic, profile: undefined })).toBe("no-profile");
  });

  it("keeps the profile but says the language is on its way when it is no longer available", () => {
    expect(
      watchAccess({ language: spanish, profile: { languageCode: "es", stage: "HEAR_IT", minutesPerDay: 20 } }),
    ).toBe("language-unavailable");
  });
});

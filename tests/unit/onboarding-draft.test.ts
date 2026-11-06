import { describe, expect, it } from "vitest";
import {
  EMPTY_DRAFT,
  chooseLanguage,
  chooseLevel,
  chooseMinutes,
  clampStep,
  confirmLevel,
  confirmMinutes,
  firstMissingStep,
  parseDraft,
  toProfileInput,
  type Draft,
} from "@/lib/onboarding/draft";

const codes = ["arz", "es"];
const complete: Draft = { step: 4, language: "arz", level: "few", minutes: 30 };

describe("draft", () => {
  it("starts at step 1 with nothing chosen", () => {
    expect(EMPTY_DRAFT).toEqual({ step: 1 });
  });

  it("choosing one thing keeps the others", () => {
    let d: Draft = chooseLanguage(EMPTY_DRAFT, "arz");
    d = chooseLevel(d, "slow");
    d = chooseMinutes(d, 60);
    expect(d).toEqual({ step: 1, language: "arz", level: "slow", minutes: 60 });
    expect(chooseLevel(d, "most")).toEqual({ step: 1, language: "arz", level: "most", minutes: 60 });
  });

  it("stores the preselected level and minutes only when Continue confirms them", () => {
    const afterLanguage = chooseLanguage(EMPTY_DRAFT, "arz");
    expect(afterLanguage.level).toBeUndefined();
    expect(afterLanguage.minutes).toBeUndefined();
    // Continue without touching the preselection stores what was shown.
    expect(confirmLevel(afterLanguage).level).toBe("none");
    expect(confirmMinutes(afterLanguage).minutes).toBe(20);
    // A touched choice is kept, not replaced by the default.
    expect(confirmLevel(chooseLevel(afterLanguage, "most")).level).toBe("most");
    expect(confirmMinutes(chooseMinutes(afterLanguage, 10)).minutes).toBe(10);
  });
});

describe("firstMissingStep and clampStep", () => {
  it("names the first unanswered step", () => {
    expect(firstMissingStep(EMPTY_DRAFT)).toBe(1);
    expect(firstMissingStep({ step: 2, language: "arz" })).toBe(2);
    expect(firstMissingStep({ step: 3, language: "arz", level: "none" })).toBe(3);
    expect(firstMissingStep(complete)).toBe(4);
  });

  it("starts at step 2 when a language is already known from the address", () => {
    expect(firstMissingStep(EMPTY_DRAFT, "arz")).toBe(2);
  });

  it("never lets the learner past the first unanswered step", () => {
    expect(clampStep(EMPTY_DRAFT, 4)).toBe(1);
    expect(clampStep({ step: 1, language: "arz" }, 3)).toBe(2);
    expect(clampStep(complete, 4)).toBe(4);
  });

  it("lets the learner go back and keeps the step in range", () => {
    expect(clampStep(complete, 1)).toBe(1);
    expect(clampStep(complete, 0)).toBe(1);
    expect(clampStep(complete, 9)).toBe(4);
    expect(clampStep(complete, Number.NaN)).toBe(1);
  });
});

describe("parseDraft", () => {
  it("reads a good draft back, so choices survive a reload", () => {
    expect(parseDraft(complete, codes)).toEqual(complete);
  });

  it("falls back to the empty draft for the wrong shape", () => {
    expect(parseDraft(null, codes)).toEqual(EMPTY_DRAFT);
    expect(parseDraft("nope", codes)).toEqual(EMPTY_DRAFT);
    expect(parseDraft([], codes)).toEqual(EMPTY_DRAFT);
  });

  it("drops a level, minutes or step that is not allowed", () => {
    const d = parseDraft({ step: 3, language: "arz", level: "expert", minutes: 15 }, codes);
    expect(d.level).toBeUndefined();
    expect(d.minutes).toBeUndefined();
    expect(d.step).toBe(2);
  });

  it("throws away a draft for a language that is no longer on offer", () => {
    expect(parseDraft({ step: 4, language: "fr", level: "few", minutes: 30 }, codes)).toEqual(EMPTY_DRAFT);
  });

  it("does not let a stored step skip an unanswered question", () => {
    expect(parseDraft({ step: 4, language: "arz" }, codes).step).toBe(2);
  });
});

describe("toProfileInput", () => {
  it("turns a complete draft into the profile that will be created", () => {
    expect(toProfileInput(complete)).toEqual({ languageCode: "arz", stage: "HEAR_IT", minutesPerDay: 30 });
    expect(toProfileInput({ ...complete, level: "slow", minutes: 60 })).toEqual({
      languageCode: "arz",
      stage: "FOLLOW_IT",
      minutesPerDay: 60,
    });
    expect(toProfileInput({ ...complete, level: "most", minutes: 10 })?.stage).toBe("UNDERSTAND_IT");
  });

  it("is undefined while any answer is missing", () => {
    expect(toProfileInput(EMPTY_DRAFT)).toBeUndefined();
    expect(toProfileInput({ step: 2, language: "arz" })).toBeUndefined();
    expect(toProfileInput({ step: 3, language: "arz", level: "none" })).toBeUndefined();
  });
});

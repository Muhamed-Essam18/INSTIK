import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_DRAFT } from "@/lib/onboarding/draft";
import { ONBOARDING_KEY, clearDraft, readDraft, saveDraft } from "@/lib/onboarding/draft-storage";
import { resetStoredMemory } from "@/lib/player/preferences";

const codes = ["arz", "es"];

beforeEach(() => {
  window.localStorage.clear();
  resetStoredMemory();
});
afterEach(() => vi.restoreAllMocks());

describe("draft storage", () => {
  it("uses the documented key", () => {
    expect(ONBOARDING_KEY).toBe("instik:v1:onboarding");
  });

  it("reads the empty draft before anything is saved", () => {
    expect(readDraft(codes)).toEqual(EMPTY_DRAFT);
  });

  it("reads back what was saved", () => {
    saveDraft({ step: 3, language: "arz", level: "slow" });
    expect(readDraft(codes)).toEqual({ step: 3, language: "arz", level: "slow" });
    expect(JSON.parse(window.localStorage.getItem(ONBOARDING_KEY)!).level).toBe("slow");
  });

  it("treats corrupt JSON as the empty draft", () => {
    window.localStorage.setItem(ONBOARDING_KEY, "{not json");
    expect(readDraft(codes)).toEqual(EMPTY_DRAFT);
  });

  it("still works for the visit when the device refuses to store", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    saveDraft({ step: 2, language: "arz" });
    expect(readDraft(codes)).toEqual({ step: 2, language: "arz" });
  });

  it("clearDraft removes it from the device and the visit", () => {
    saveDraft({ step: 2, language: "arz" });
    clearDraft();
    expect(window.localStorage.getItem(ONBOARDING_KEY)).toBeNull();
    expect(readDraft(codes)).toEqual(EMPTY_DRAFT);
  });

  it("clearDraft leaves other keys alone", () => {
    window.localStorage.setItem("instik:v1:autoplay", "true");
    saveDraft({ step: 2, language: "arz" });
    clearDraft();
    expect(window.localStorage.getItem("instik:v1:autoplay")).toBe("true");
  });
});

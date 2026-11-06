import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTOPLAY_KEY,
  AUTOPLAY_NEXT_KEY,
  DEFAULT_LAYERS,
  autoplaySchema,
  layersKey,
  layersSchema,
  readStored,
  resetStoredMemory,
  understoodKey,
  understoodSchema,
  writeStored,
} from "@/lib/player/preferences";

beforeEach(() => {
  window.localStorage.clear();
  resetStoredMemory();
});
afterEach(() => vi.restoreAllMocks());

describe("keys and defaults", () => {
  it("builds the documented keys", () => {
    expect(layersKey("arabic-egyptian")).toBe("instik:v1:arabic-egyptian:layers");
    expect(understoodKey("arabic-egyptian", "at-the-cafe")).toBe("instik:v1:arabic-egyptian:understood:at-the-cafe");
    expect(AUTOPLAY_KEY).toBe("instik:v1:autoplay");
    expect(AUTOPLAY_NEXT_KEY).toBe("instik:v1:autoplay-next");
  });

  it("defaults to Arabic, tashkeel and transliteration on, English off", () => {
    expect(DEFAULT_LAYERS).toEqual({ script: true, tashkeel: true, transliteration: true, english: false });
  });
});

describe("schemas", () => {
  it("accepts valid values and rejects others", () => {
    expect(layersSchema.safeParse(DEFAULT_LAYERS).success).toBe(true);
    expect(layersSchema.safeParse({ script: true }).success).toBe(false);
    expect(understoodSchema.safeParse("mostly").success).toBe(true);
    expect(understoodSchema.safeParse("perfect").success).toBe(false);
    expect(autoplaySchema.safeParse(false).success).toBe(true);
    expect(autoplaySchema.safeParse("yes").success).toBe(false);
  });
});

describe("readStored / writeStored", () => {
  it("round-trips a value", () => {
    writeStored(AUTOPLAY_KEY, true);
    expect(readStored(AUTOPLAY_KEY, autoplaySchema)).toBe(true);
    expect(window.localStorage.getItem(AUTOPLAY_KEY)).toBe("true");
  });

  it("returns undefined for missing, corrupt and wrong-shape data", () => {
    expect(readStored(AUTOPLAY_KEY, autoplaySchema)).toBeUndefined();
    window.localStorage.setItem(AUTOPLAY_KEY, "{not json");
    expect(readStored(AUTOPLAY_KEY, autoplaySchema)).toBeUndefined();
    window.localStorage.setItem(AUTOPLAY_KEY, '"yes"');
    expect(readStored(AUTOPLAY_KEY, autoplaySchema)).toBeUndefined();
  });

  it("never throws and still remembers the value for this visit when localStorage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readStored(AUTOPLAY_KEY, autoplaySchema)).toBeUndefined();
    expect(() => writeStored(AUTOPLAY_KEY, true)).not.toThrow();
    expect(readStored(AUTOPLAY_KEY, autoplaySchema)).toBe(true);
  });
});

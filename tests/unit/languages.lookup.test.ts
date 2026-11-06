import { describe, expect, it } from "vitest";
import { defaultLanguage, getLanguageByCode, getLanguageBySlug, isAvailable } from "@/lib/languages";

describe("language lookups", () => {
  it("defaults to Egyptian Arabic", () => {
    expect(defaultLanguage.slug).toBe("arabic-egyptian");
    expect(defaultLanguage.code).toBe("arz");
  });

  it("resolves known slugs", () => {
    expect(getLanguageBySlug("arabic-egyptian")?.name).toBe("Arabic");
    expect(getLanguageBySlug("spanish")?.code).toBe("es");
  });

  it("returns undefined for unknown or differently cased slugs", () => {
    expect(getLanguageBySlug("nope")).toBeUndefined();
    expect(getLanguageBySlug("ARABIC-EGYPTIAN")).toBeUndefined();
  });

  it("resolves codes, not slugs", () => {
    expect(getLanguageByCode("arz")?.slug).toBe("arabic-egyptian");
    expect(getLanguageByCode("es")?.slug).toBe("spanish");
    expect(getLanguageByCode("arabic-egyptian")).toBeUndefined();
    expect(getLanguageByCode("")).toBeUndefined();
  });

  it("reports availability", () => {
    expect(isAvailable(getLanguageBySlug("arabic-egyptian")!)).toBe(true);
    expect(isAvailable(getLanguageBySlug("spanish")!)).toBe(false);
  });
});

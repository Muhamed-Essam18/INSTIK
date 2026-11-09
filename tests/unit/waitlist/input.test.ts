import { describe, expect, it } from "vitest";
import { languages } from "@/lib/languages";
import { parseWaitlistInput } from "@/lib/waitlist/input";

const parse = (input: Parameters<typeof parseWaitlistInput>[0]) => parseWaitlistInput(input, languages);

describe("parseWaitlistInput", () => {
  it("trims and lower-cases the email", () => {
    expect(parse({ language: "es", email: "  Someone@Example.COM " })).toEqual({
      kind: "entry",
      language: "es",
      email: "someone@example.com",
    });
  });
  it("accepts French and Other", () => {
    expect(parse({ language: "fr", email: "a@b.co" })).toMatchObject({ kind: "entry", language: "fr" });
    expect(parse({ language: "other", email: "a@b.co" })).toMatchObject({ kind: "entry", language: "other" });
  });
  it("rejects missing and malformed emails", () => {
    for (const email of ["", "   ", "nope", "a@", undefined, 5]) {
      expect(parse({ language: "es", email })).toEqual({ kind: "invalid", code: "invalid-email" });
    }
  });
  it("rejects an email longer than 254 characters", () => {
    const email = `${"a".repeat(250)}@example.com`;
    expect(parse({ language: "es", email })).toEqual({ kind: "invalid", code: "invalid-email" });
  });
  it("rejects a language that is not offered, including the available one", () => {
    for (const language of ["", "zz", "arz", undefined, 3]) {
      expect(parse({ language, email: "a@b.co" })).toEqual({ kind: "invalid", code: "invalid-language" });
    }
  });
  it("treats a filled hidden field as a robot", () => {
    expect(parse({ language: "es", email: "a@b.co", website: "http://spam" })).toEqual({ kind: "trap" });
  });
  it("accepts an empty hidden field", () => {
    expect(parse({ language: "es", email: "a@b.co", website: "" })).toMatchObject({ kind: "entry" });
  });
});

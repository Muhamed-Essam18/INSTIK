import { describe, expect, it } from "vitest";
import { languages } from "@/lib/languages";
import { isWaitlistCode, waitlistOptions } from "@/lib/waitlist/options";

describe("waitlistOptions", () => {
  it("lists the languages that are coming, in data order, then Other", () => {
    expect(waitlistOptions(languages).map((o) => o.name)).toEqual(["Spanish", "French", "Other"]);
  });
  it("leaves out available languages", () => {
    expect(waitlistOptions(languages).map((o) => o.code)).not.toContain("arz");
  });
  it("checks codes against the options", () => {
    expect(isWaitlistCode("fr", languages)).toBe(true);
    expect(isWaitlistCode("other", languages)).toBe(true);
    expect(isWaitlistCode("arz", languages)).toBe(false);
    expect(isWaitlistCode(undefined, languages)).toBe(false);
  });
});

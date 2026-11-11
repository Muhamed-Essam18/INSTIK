import { describe, expect, it } from "vitest";
import { languageName } from "@/lib/language-name";

describe("languageName", () => {
  it("puts the variety before the name", () => {
    expect(languageName({ variety: "Egyptian", name: "Arabic" })).toBe("Egyptian Arabic");
  });
  it("is just the name when there is no variety", () => {
    expect(languageName({ name: "Spanish" })).toBe("Spanish");
  });
});

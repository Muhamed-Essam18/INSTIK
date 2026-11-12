import { describe, expect, it } from "vitest";
import { panelLinksFor } from "@/lib/roles/panels";

describe("panelLinksFor", () => {
  it("gives a learner no panel entry", () => {
    expect(panelLinksFor("learner")).toEqual([]);
  });

  it("gives a creator the Creator panel only", () => {
    expect(panelLinksFor("creator")).toEqual([{ label: "Creator panel", href: "/creator" }]);
  });

  it("gives an owner the Owner panel only", () => {
    expect(panelLinksFor("owner")).toEqual([{ label: "Owner panel", href: "/owner" }]);
  });
});

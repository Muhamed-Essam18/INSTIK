import { describe, expect, it } from "vitest";
import { panelLinksFor } from "@/lib/roles/panels";

const creator = { label: "Creator panel", href: "/creator" };
const owner = { label: "Owner panel", href: "/owner" };

describe("panelLinksFor", () => {
  it("gives a learner no panel entry", () => {
    expect(panelLinksFor({ role: "learner" })).toEqual([]);
    expect(panelLinksFor({ role: "learner", isCreator: false })).toEqual([]);
  });

  it("gives a creator the Creator panel only", () => {
    expect(panelLinksFor({ role: "creator", isCreator: true })).toEqual([creator]);
  });

  it("gives an owner the Owner panel only", () => {
    expect(panelLinksFor({ role: "owner", isCreator: false })).toEqual([owner]);
  });

  it("gives someone who is both an owner and a creator both entries", () => {
    expect(panelLinksFor({ role: "owner", isCreator: true })).toEqual([creator, owner]);
  });
});

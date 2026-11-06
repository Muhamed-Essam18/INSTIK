import { describe, expect, it } from "vitest";
import { getUpNext } from "@/lib/content/upnext";

const v = (slug: string, stage: string) => ({ slug, stage });
const all = [
  v("a1", "hear-it"),
  v("a2", "hear-it"),
  v("b1", "follow-it"),
  v("b2", "follow-it"),
  v("b3", "follow-it"),
  v("b4", "follow-it"),
  v("b5", "follow-it"),
  v("c1", "understand-it"),
];
const slugs = (list: { slug: string }[]) => list.map((x) => x.slug);

describe("getUpNext", () => {
  it("returns only videos at the same stage, never the current one", () => {
    const result = getUpNext(all, "b2");
    expect(slugs(result)).not.toContain("b2");
    expect(result.every((x) => x.stage === "follow-it")).toBe(true);
  });

  it("starts after the current video in library order and wraps around, at most three", () => {
    expect(slugs(getUpNext(all, "b2"))).toEqual(["b3", "b4", "b5"]);
    expect(slugs(getUpNext(all, "b4"))).toEqual(["b5", "b1", "b2"]);
    expect(slugs(getUpNext(all, "b5"))).toEqual(["b1", "b2", "b3"]);
  });

  it("returns fewer when fewer exist, and nothing when there is no other video at the stage", () => {
    expect(slugs(getUpNext(all, "a1"))).toEqual(["a2"]);
    expect(getUpNext(all, "c1")).toEqual([]);
  });

  it("honours a smaller limit and ignores an unknown slug", () => {
    expect(slugs(getUpNext(all, "b1", 2))).toEqual(["b2", "b3"]);
    expect(getUpNext(all, "nope")).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { resolveSource } from "@/lib/player/source";

describe("resolveSource", () => {
  it("has no source for a missing or blank id", () => {
    for (const id of [undefined, null, "", "   "]) expect(resolveSource(id)).toEqual({ kind: "none" });
  });

  it("plays the sample clip for sample- ids", () => {
    expect(resolveSource("sample-playback-id-at-the-cafe")).toEqual({ kind: "sample", src: "/sample/sample-clip.mp4" });
  });

  it("uses Mux for any other id", () => {
    expect(resolveSource("a1B2c3D4e5")).toEqual({ kind: "mux", playbackId: "a1B2c3D4e5" });
    expect(resolveSource("  a1B2  ")).toEqual({ kind: "mux", playbackId: "a1B2" });
  });
});

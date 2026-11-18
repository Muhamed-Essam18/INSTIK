import { describe, expect, it, vi } from "vitest";
import { owner, setupReview, video } from "../../helpers/review-memory";

// Plan performance goals: a 500-segment transcript stays responsive because every save is per segment, in one transaction on that video.

const many = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `s${i}`, position: i + 1, start: i * 2, end: i * 2 + 1.5, script: "كلام", transliteration: "", english: "", revision: 0 }));

const setup = () => {
  const t = setupReview({ videos: [video({ id: "v1", durationSeconds: 5000 })], segments: { v1: many(500) } });
  const writes = {
    transaction: vi.spyOn(t.store, "transaction"),
    updateSegment: vi.spyOn(t.tx, "updateSegment"),
    insertSegment: vi.spyOn(t.tx, "insertSegment"),
    deleteSegment: vi.spyOn(t.tx, "deleteSegment"),
    deleteAll: vi.spyOn(t.tx, "deleteAllSegments"),
    setPositions: vi.spyOn(t.tx, "setPositions"),
  };
  return { t, writes };
};

describe("saving one segment of a 500-segment transcript", () => {
  it("is one transaction that writes only that segment, and renumbers nothing when the order does not change", async () => {
    const { t, writes } = setup();
    const result = await t.service.saveSegment(owner, { videoId: "v1", segmentId: "s250", revision: 0, start: 500, end: 501.5, script: "جديد", transliteration: "gdeed", english: "new" });
    expect(result.ok).toBe(true);
    expect(writes.transaction).toHaveBeenCalledTimes(1);
    expect(writes.updateSegment).toHaveBeenCalledTimes(1);
    expect(writes.updateSegment).toHaveBeenCalledWith("v1", "s250", expect.anything(), 1);
    expect(writes.setPositions).not.toHaveBeenCalled();
    expect(writes.deleteAll).not.toHaveBeenCalled();
    expect(t.state.segments.get("v1")).toHaveLength(500);
  });

  it("adding at the end writes one row and renumbers nothing", async () => {
    const { t, writes } = setup();
    await t.service.saveSegment(owner, { videoId: "v1", start: 2000, end: 2002, script: "ك", transliteration: "", english: "" });
    expect(writes.insertSegment).toHaveBeenCalledTimes(1);
    expect(writes.setPositions).not.toHaveBeenCalled();
  });

  it("moving a segment renumbers only the ones between its old and new place, in one call", async () => {
    const { t, writes } = setup();
    // Segment 10 moves into the gap just before segment 5: only positions 5 to 10 change.
    await t.service.saveSegment(owner, { videoId: "v1", segmentId: "s9", revision: 0, start: 7.55, end: 7.95, script: "ك", transliteration: "", english: "" });
    expect(writes.setPositions).toHaveBeenCalledTimes(1);
    const [, moves] = writes.setPositions.mock.calls[0];
    expect(moves.length).toBeLessThanOrEqual(7);
    expect(writes.updateSegment).toHaveBeenCalledTimes(1);
  });

  it("stays fast: a save in the memory store takes a few milliseconds", async () => {
    const { t } = setup();
    const started = performance.now();
    for (let i = 0; i < 20; i += 1) {
      await t.service.saveSegment(owner, { videoId: "v1", segmentId: `s${i}`, revision: 0, start: i * 2, end: i * 2 + 1.4, script: "ك", transliteration: "", english: "" });
    }
    expect(performance.now() - started).toBeLessThan(1000);
  });
});

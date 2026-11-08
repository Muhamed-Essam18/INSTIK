import { describe, expect, it } from "vitest";
import { ack, emptyQueue, enqueue, peek, queuedSeconds, toPayload, QUEUE_LIMIT_SECONDS } from "@/lib/hours/queue";

const iv = (start: number, seconds: number) => ({ startWall: start, endWall: start + seconds * 1000, seconds });

describe("queue", () => {
  it("keeps intervals oldest first", () => {
    const q = enqueue(emptyQueue(), [iv(0, 10), iv(20_000, 12)]);
    expect(q.items.map((i) => i.seconds)).toEqual([10, 12]);
    expect(peek(q)?.seconds).toBe(10);
  });

  it("removes a sent interval and keeps the order of the rest", () => {
    let q = enqueue(emptyQueue(), [iv(0, 10), iv(20_000, 12), iv(40_000, 5)]);
    q = ack(q, q.items[0].id);
    expect(q.items.map((i) => i.seconds)).toEqual([12, 5]);
  });

  it("a failed send changes nothing: the interval stays at the front", () => {
    const q = enqueue(emptyQueue(), [iv(0, 10), iv(20_000, 12)]);
    expect(peek(q)?.id).toBe(q.items[0].id);
    expect(queuedSeconds(q)).toBe(22);
  });

  it("holds at most 300 counted seconds and drops the excess", () => {
    const many = Array.from({ length: 25 }, (_, i) => iv(i * 20_000, 20)); // 500 seconds
    const q = enqueue(emptyQueue(), many);
    expect(queuedSeconds(q)).toBe(QUEUE_LIMIT_SECONDS);
    expect(q.items).toHaveLength(15);
  });

  it("drops later intervals once full, even small ones that would still fit later", () => {
    let q = enqueue(emptyQueue(), Array.from({ length: 15 }, (_, i) => iv(i * 20_000, 20)));
    q = enqueue(q, [iv(999_000, 1)]);
    expect(queuedSeconds(q)).toBe(300);
  });

  it("gives every queued interval its own id, even after earlier ones are removed", () => {
    let q = enqueue(emptyQueue(), [iv(0, 5), iv(10_000, 5)]);
    q = ack(q, q.items[0].id);
    q = enqueue(q, [iv(30_000, 5)]);
    expect(new Set(q.items.map((i) => i.id)).size).toBe(q.items.length);
  });

  it("turns an interval into a payload relative to the send time", () => {
    const payload = toPayload(iv(100_000, 15), 130_000);
    expect(payload).toEqual({ seconds: 15, spanSeconds: 15, endedAgoSeconds: 15 });
  });

  it("never reports a span shorter than the counted seconds or a negative age", () => {
    const payload = toPayload({ startWall: 0, endWall: 5000, seconds: 6 }, 4000);
    expect(payload.spanSeconds).toBeGreaterThanOrEqual(6);
    expect(payload.endedAgoSeconds).toBe(0);
  });
});

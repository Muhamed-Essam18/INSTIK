// Device-side queue of counted intervals waiting to be sent. Pure; it lives in memory only (never persisted).
// Oldest first. Holds at most 300 counted seconds; anything that would not fit is dropped, so a long offline
// session counts honestly up to 5 minutes and no more.
import type { Interval } from "./counter";

export const QUEUE_LIMIT_SECONDS = 300;

export type QueuedInterval = Interval & { id: string };
export type Queue = { items: QueuedInterval[]; nextId: number };

export const emptyQueue = (): Queue => ({ items: [], nextId: 1 });

export const queuedSeconds = (q: Queue): number => q.items.reduce((n, i) => n + i.seconds, 0);

/** Adds intervals in order. An interval that would take the queue past 300 counted seconds is dropped. */
export function enqueue(q: Queue, intervals: Interval[]): Queue {
  let items = q.items;
  let nextId = q.nextId;
  let total = queuedSeconds(q);
  for (const interval of intervals) {
    if (total + interval.seconds > QUEUE_LIMIT_SECONDS) continue;
    items = [...items, { ...interval, id: `i${nextId}` }];
    nextId += 1;
    total += interval.seconds;
  }
  return { items, nextId };
}

export const peek = (q: Queue): QueuedInterval | undefined => q.items[0];

/** Removes a sent (or rejected) interval. */
export const ack = (q: Queue, id: string): Queue => ({ ...q, items: q.items.filter((i) => i.id !== id) });

/**
 * What the server needs for one interval, relative to the moment of sending so the device clock never matters:
 * the counted seconds, how long the stretch lasted and how long ago it ended.
 */
export function toPayload(interval: Interval, nowMs: number) {
  const span = Math.max(0, (interval.endWall - interval.startWall) / 1000);
  return {
    seconds: interval.seconds,
    spanSeconds: Math.max(span, interval.seconds),
    endedAgoSeconds: Math.max(0, (nowMs - interval.endWall) / 1000),
  };
}

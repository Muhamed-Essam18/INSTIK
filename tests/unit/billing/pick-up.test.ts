import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: () => ({ videoProgress: { findMany: mocks.findMany } }) }));

import { getLibraryProgress } from "@/lib/hours/queries";

// Newest first, as the query orders them: a full-access video most recently, a free one before it.
const rows = [
  { videoSlug: "a-day-at-a-wedding", positionSeconds: 90, watched: false }, // full access
  { videoSlug: "at-the-cafe", positionSeconds: 40, watched: false }, // free
];

beforeEach(() => mocks.findMany.mockReset().mockResolvedValue(rows));

describe("Pick up where you left off", () => {
  it("picks the most recent video when the learner can watch it", async () => {
    const { pickUp } = await getLibraryProgress("u1", "arz", () => true);
    expect(pickUp).toEqual({ videoSlug: "a-day-at-a-wedding", positionSeconds: 90 });
  });

  it("with no filter behaves as before", async () => {
    const { pickUp } = await getLibraryProgress("u1", "arz");
    expect(pickUp?.videoSlug).toBe("a-day-at-a-wedding");
  });

  it("skips a locked video and picks the newest one the learner can still watch", async () => {
    const { pickUp } = await getLibraryProgress("u1", "arz", (slug) => slug !== "a-day-at-a-wedding");
    expect(pickUp).toEqual({ videoSlug: "at-the-cafe", positionSeconds: 40 });
  });

  it("shows nothing when every in-progress video is locked", async () => {
    const { pickUp } = await getLibraryProgress("u1", "arz", () => false);
    expect(pickUp).toBeNull();
  });

  it("does not change the Watched list", async () => {
    mocks.findMany.mockResolvedValue([{ videoSlug: "at-the-cafe", positionSeconds: 0, watched: true }, ...rows]);
    const { watchedSlugs } = await getLibraryProgress("u1", "arz", () => false);
    expect(watchedSlugs).toEqual(["at-the-cafe"]);
  });
});

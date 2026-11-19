import { afterEach, describe, expect, it, vi } from "vitest";
import { recordCountedViewIfCrossed, type Crossing, type CountingClient } from "@/lib/earnings/record-view";

// Counted views are recorded after a heartbeat commits (spec 11 FR-001 to FR-006, research.md section 1).

vi.mock("@/lib/db", () => ({ db: () => ({}) }));

const NOW = Date.parse("2026-11-18T12:00:00Z");
const active = { status: "ACTIVE", currentPeriodEnd: new Date(NOW + 10 * 86_400_000), cancelAtPeriodEnd: false };

type Setup = {
  video?: { id: string; host: { userId: string | null } } | null;
  subscription?: unknown;
  manualAccessAt?: Date | null;
  failOn?: "video" | "insert";
};

function fake(setup: Setup = {}) {
  const inserted: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  const video = "video" in setup ? setup.video : { id: "v1", host: { userId: "ann" } };
  const client = {
    video: {
      findUnique: vi.fn(async () => {
        if (setup.failOn === "video") throw Object.assign(new Error("connection refused for lea@example.com"), { code: "P1001" });
        return video;
      }),
    },
    subscription: { findUnique: vi.fn(async () => ("subscription" in setup ? setup.subscription : active)) },
    user: { findUnique: vi.fn(async () => ({ manualAccessAt: setup.manualAccessAt ?? null })) },
    countedView: {
      createMany: vi.fn(async ({ data }: { data: Record<string, unknown>[] }) => {
        if (setup.failOn === "insert") throw new Error("insert failed");
        for (const row of data) {
          const key = `${row.userId}|${row.videoId}|${(row.day as Date).toISOString()}`;
          if (seen.has(key)) continue; // skipDuplicates: the unique key makes a repeat harmless
          seen.add(key);
          inserted.push(row);
        }
      }),
    },
  };
  return { client: client as unknown as CountingClient, raw: client, inserted };
}

const crossing = (over: Partial<Crossing> = {}): Crossing => ({
  userId: "lea",
  languageCode: "arz",
  videoSlug: "at-the-cafe",
  day: "2026-11-18",
  secondsBefore: 25,
  secondsAfter: 35,
  ...over,
});

afterEach(() => vi.restoreAllMocks());

describe("recordCountedViewIfCrossed", () => {
  it("stores one view at the crossing, with the Warsaw month and day set once", async () => {
    const { client, inserted } = fake();
    await recordCountedViewIfCrossed([crossing()], NOW, client);
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ userId: "lea", videoId: "v1", creatorId: "ann", monthKey: "2026-11" });
    expect((inserted[0].day as Date).toISOString()).toBe("2026-11-18T00:00:00.000Z");
    expect((inserted[0].warsawDay as Date).toISOString()).toBe("2026-11-18T00:00:00.000Z");
    expect((inserted[0].countedAt as Date).getTime()).toBe(NOW);
  });

  it("puts 23:30 UTC on the last day of a month into the next Warsaw month and day", async () => {
    const { client, inserted } = fake();
    await recordCountedViewIfCrossed([crossing({ day: "2026-11-30" })], Date.parse("2026-11-30T23:30:00Z"), client);
    expect(inserted[0]).toMatchObject({ monthKey: "2026-12" });
    expect((inserted[0].warsawDay as Date).toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect((inserted[0].day as Date).toISOString()).toBe("2026-11-30T00:00:00.000Z");
  });

  it("does not query at all for a heartbeat that did not cross", async () => {
    const { client, raw } = fake();
    await recordCountedViewIfCrossed([crossing({ secondsBefore: 5, secondsAfter: 15 }), crossing({ secondsBefore: 40, secondsAfter: 50 })], NOW, client);
    expect(raw.video.findUnique).not.toHaveBeenCalled();
    expect(raw.countedView.createMany).not.toHaveBeenCalled();
  });

  it("makes no second view when the same crossing arrives again (retry or second device)", async () => {
    const { client, inserted } = fake();
    await recordCountedViewIfCrossed([crossing()], NOW, client);
    await recordCountedViewIfCrossed([crossing()], NOW + 1000, client);
    expect(inserted).toHaveLength(1);
  });

  it("makes a new view on a new day", async () => {
    const { client, inserted } = fake();
    await recordCountedViewIfCrossed([crossing()], NOW, client);
    await recordCountedViewIfCrossed([crossing({ day: "2026-11-19" })], NOW + 86_400_000, client);
    expect(inserted).toHaveLength(2);
  });

  it("judges two day parts of one heartbeat separately", async () => {
    const { client, inserted } = fake();
    // The first part crossed on 17 November, the second (after midnight) stays below 30 on 18 November.
    await recordCountedViewIfCrossed(
      [crossing({ day: "2026-11-17", secondsBefore: 28, secondsAfter: 33 }), crossing({ day: "2026-11-18", secondsBefore: 0, secondsAfter: 5 })],
      NOW,
      client,
    );
    expect(inserted).toHaveLength(1);
    expect((inserted[0].day as Date).toISOString()).toBe("2026-11-17T00:00:00.000Z");
  });

  it("makes none for a free learner", async () => {
    const { client, inserted } = fake({ subscription: null });
    await recordCountedViewIfCrossed([crossing()], NOW, client);
    expect(inserted).toHaveLength(0);
  });

  it("makes none for a lapsed subscriber", async () => {
    const { client, inserted } = fake({ subscription: { ...active, status: "CANCELED" } });
    await recordCountedViewIfCrossed([crossing()], NOW, client);
    expect(inserted).toHaveLength(0);
  });

  it("makes none when the learner is the video's creator", async () => {
    const { client, inserted } = fake({ video: { id: "v1", host: { userId: "lea" } } });
    await recordCountedViewIfCrossed([crossing()], NOW, client);
    expect(inserted).toHaveLength(0);
  });

  it("makes none for a video with no creator account (an imported sample video)", async () => {
    const { client, inserted } = fake({ video: { id: "v1", host: { userId: null } } });
    await recordCountedViewIfCrossed([crossing()], NOW, client);
    expect(inserted).toHaveLength(0);
  });

  it("makes one for an account with a manual grant and no subscription", async () => {
    const { client, inserted } = fake({ subscription: null, manualAccessAt: new Date("2026-11-01T00:00:00Z") });
    await recordCountedViewIfCrossed([crossing()], NOW, client);
    expect(inserted).toHaveLength(1);
  });

  it("does not back-credit the day when access is gained after the crossing", async () => {
    const free = fake({ subscription: null });
    await recordCountedViewIfCrossed([crossing()], NOW, free.client);
    expect(free.inserted).toHaveLength(0);
    // The learner upgrades and watches a little more the same day: the day is already past 30 seconds, so there is no new crossing.
    const paid = fake();
    await recordCountedViewIfCrossed([crossing({ secondsBefore: 35, secondsAfter: 45 })], NOW + 60_000, paid.client);
    expect(paid.inserted).toHaveLength(0);
  });

  it("makes none when the video is not in the database", async () => {
    const { client, inserted } = fake({ video: null });
    await recordCountedViewIfCrossed([crossing()], NOW, client);
    expect(inserted).toHaveLength(0);
  });
});

describe("a failure while counting", () => {
  it("is logged and swallowed: the function resolves and never throws", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = fake({ failOn: "insert" });
    await expect(recordCountedViewIfCrossed([crossing()], NOW, client)).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledTimes(1);
  });

  it("logs no learner id, email or query text", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = fake({ failOn: "video" });
    await expect(recordCountedViewIfCrossed([crossing()], NOW, client)).resolves.toBeUndefined();
    const text = log.mock.calls.flat().join(" ");
    expect(text).not.toContain("lea");
    expect(text).not.toContain("example.com");
    expect(text).toContain("P1001");
  });
});

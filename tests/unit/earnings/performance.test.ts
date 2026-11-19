import { describe, expect, it, vi } from "vitest";
import { recordCountedViewIfCrossed, type CountingClient } from "@/lib/earnings/record-view";
import { creatorActor, setupEarnings } from "../../helpers/earnings-memory";

// The plan's performance goals (spec 11 plan.md "Performance Goals"): counting adds nothing to an ordinary heartbeat and a bounded handful of
// queries to the one that crosses 30 seconds, after the commit; one dashboard is at most ten reads, run together.

vi.mock("@/lib/db", () => ({ db: () => ({}) }));

const NOW = Date.parse("2026-11-18T12:00:00Z");

function counting() {
  const calls = { reads: 0, inserts: 0 };
  const client = {
    video: { findUnique: async () => ((calls.reads += 1), { id: "v1", host: { userId: "ann" } }) },
    subscription: { findUnique: async () => ((calls.reads += 1), { status: "ACTIVE", currentPeriodEnd: new Date(NOW + 86_400_000), cancelAtPeriodEnd: false }) },
    user: { findUnique: async () => ((calls.reads += 1), { manualAccessAt: null }) },
    countedView: { createMany: async () => void (calls.inserts += 1) },
  };
  return { client: client as unknown as CountingClient, calls };
}

const crossing = { userId: "lea", languageCode: "arz", videoSlug: "v", day: "2026-11-18", secondsBefore: 25, secondsAfter: 35 };

describe("counting a view", () => {
  it("issues no query at all for a heartbeat that did not cross 30 seconds", async () => {
    const { client, calls } = counting();
    await recordCountedViewIfCrossed([{ ...crossing, secondsBefore: 5, secondsAfter: 15 }, { ...crossing, secondsBefore: 31, secondsAfter: 41 }], NOW, client);
    expect(calls).toEqual({ reads: 0, inserts: 0 });
  });

  it("issues at most four reads and one insert for the heartbeat that crosses", async () => {
    const { client, calls } = counting();
    await recordCountedViewIfCrossed([crossing], NOW, client);
    expect(calls.reads).toBeLessThanOrEqual(4);
    expect(calls.inserts).toBe(1);
  });

  it("does not run inside the heartbeat transaction (it is called only after the commit)", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("src/lib/hours/service.ts", "utf8");
    const transaction = source.slice(source.indexOf("db().$transaction"), source.indexOf("// After the commit"));
    expect(transaction).not.toMatch(/recordCountedViewIfCrossed|countedView/);
    expect(source.indexOf("recordCountedViewIfCrossed(crossings")).toBeGreaterThan(source.indexOf("// After the commit"));
  });
});

describe("the creator dashboard", () => {
  it("issues at most ten reads, each once, and the result holds no learner field", async () => {
    const t = setupEarnings({
      now: "2026-11-11T12:00:00Z",
      revenue: { "2026-11": {} },
      dashboard: { videos: [{ id: "v1", creatorId: "ann", title: "A", stage: null, status: "APPROVED", duration: 100 }] },
    });
    const d = await t.service.getDashboard(creatorActor("ann"));
    expect(t.dashReads.length).toBeLessThanOrEqual(10);
    expect(new Set(t.dashReads).size).toBe(t.dashReads.length);
    expect(JSON.stringify(d)).not.toMatch(/userId|email/);
  });

  it("runs the ten reads together, not one after another", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("src/lib/earnings/dashboard-data.ts", "utf8");
    expect(source).toMatch(/await Promise\.all\(\[/);
    // Nothing is awaited before or between the reads: one Promise.all holds them all.
    expect(source.match(/await store\./g)).toBeNull();
  });
});

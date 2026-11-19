import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { creatorActor, creatorViews, setupEarnings, owner } from "../../helpers/earnings-memory";

// Creators and owners see counts, never which learner produced a view (spec 11 FR-014; constitution X, XI).

const read = (file: string) => readFileSync(file, "utf8");
const strip = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const creatorScreens = ["StatTile", "WeeklyViews", "EarningsCard", "AnswerBar", "TopVideos", "RequestsList"].map((n) => `src/components/creator/${n}.tsx`);

describe("the creator dashboard", () => {
  it("renders no email, name or id of a learner: the creator components never touch one", () => {
    for (const file of [...creatorScreens, "src/components/screens/CreatorScreen.tsx"]) {
      const text = strip(read(file));
      expect(text, file).not.toMatch(/\.email\b|learnerId|learnerEmail|learnerName|userId/);
    }
  });

  it("has a result type with no learner field: only counts", () => {
    // Every exported type except the store's own interface (which names the creator id its queries are scoped by).
    const types = read("src/lib/earnings/dashboard-data.ts").replace(/export interface DashboardStore \{[\s\S]*?\n\}/, "").split("export type BuildDeps")[0];
    expect(types).not.toMatch(/userId|learnerId|email|learnerName/);
    // The number of different learners is a count, named as one.
    expect(types).toMatch(/learners: number/);
  });

  it("never identifies a learner in what a built dashboard contains", async () => {
    const t = setupEarnings({
      now: "2026-11-11T12:00:00Z",
      dashboard: {
        videos: [{ id: "v1", creatorId: "ann", title: "At the café", stage: "follow-it", status: "APPROVED", duration: 600 }],
        counted: [{ creatorId: "ann", userId: "secret-learner-id", videoId: "v1", warsawDay: "2026-11-03", month: "2026-11" }],
        watch: [{ videoId: "v1", userId: "secret-learner-id", day: "2026-11-03", seconds: 100 }],
        progress: [{ videoId: "v1", userId: "secret-learner-id", position: 100 }],
      },
    });
    const d = await t.service.getDashboard(creatorActor("ann"));
    expect(JSON.stringify(d)).not.toContain("secret-learner-id");
    expect(d.learners).toBe(1);
  });

  it("reads counted views for creator-facing pages without ever selecting a learner id", () => {
    const store = read("src/lib/earnings/store.ts").split("The creator dashboard's reads")[1];
    expect(store).toBeDefined();
    // No Prisma select of the learner column in the dashboard's reads; the raw queries only count or join on it.
    expect(store).not.toMatch(/userId:\s*true/);
    expect(store).not.toMatch(/SELECT[^;]*"userId"\s*(,|FROM)/);
    expect(store).toMatch(/COUNT\(DISTINCT "userId"\)/);
  });
});

describe("the owner screens", () => {
  it("the Earnings page shows creator names and counts, never a learner", async () => {
    const t = setupEarnings({ now: "2026-10-20T10:00:00Z", revenue: { "2026-10": {} }, views: { "2026-10": [creatorViews("omar", 5, 1, "Omar")] } });
    const statement = (await t.service.getStatement(owner, "2026-10"))!;
    expect(Object.keys(statement.lines[0]).sort()).toEqual(["creatorId", "earningsCents", "name", "paidAt", "payout", "shareBasisPoints", "views"]);
    const source = strip(read("src/lib/earnings/service.ts"));
    expect(source).not.toMatch(/learnerId|learnerEmail|learnerName/);
  });

  it("the Access page shows the account the owner typed, and no other learner", () => {
    const history = strip(read("src/components/owner/GrantHistory.tsx"));
    // It lists accounts that have (or had) a grant: those emails were typed by an owner. Nothing here reads watching or other learner data.
    expect(history).not.toMatch(/watch|progress|answer|hours/i);
  });
});

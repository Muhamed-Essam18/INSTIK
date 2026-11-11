import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

// A subscription starting, changing or ending must never touch hours, rhythm, level, preferences or answers (FR-006,
// FR-012). Two guards: the code that writes subscriptions can reach only its own tables, and the screens that show
// hours know nothing about billing.

const read = (path: string) => readFileSync(path, "utf8");
const learnerData = /watchSession|manualTime|videoProgress|learnerLanguage|comprehensionAnswer|\bpreference\b|signInAttempt|waitlistEntry/i;

describe("the sync and its store", () => {
  it("only reach User.stripeCustomerId, Subscription and StripeEvent", () => {
    const store = read("src/lib/billing/store.ts");
    const tables = [...store.matchAll(/db\(\)\s*\.?\s*(\w+)\./g)].map((m) => m[1]);
    const unique = [...new Set(tables)].sort();
    expect(unique).toEqual(["stripeEvent", "subscription", "user"]);
    expect(store).not.toMatch(learnerData);
  });

  it("the sync code has no access to learner data at all", () => {
    expect(read("src/lib/billing/sync.ts")).not.toMatch(learnerData);
    expect(read("src/lib/billing/status.ts")).not.toMatch(learnerData);
    expect(read("src/lib/billing/webhook.ts")).not.toMatch(learnerData);
  });

  it("the store interface offers only subscription and customer operations", async () => {
    vi.doMock("@/lib/db", () => ({ db: () => ({}) }));
    const { syncStore } = await import("@/lib/billing/store");
    expect(Object.keys(syncStore).sort()).toEqual(
      ["findUserIdByCustomer", "getByUserId", "insert", "linkCustomer", "replaceIf", "userExists"].sort(),
    );
    vi.doUnmock("@/lib/db");
  });

  it("the user update only ever sets stripeCustomerId", () => {
    const sources = [read("src/lib/billing/store.ts"), read("src/lib/billing/checkout.ts")].join("\n");
    const updates = [...sources.matchAll(/user\s*\.updateMany\([\s\S]*?data:\s*\{\s*([^}]*)\}/g)].map((m) => m[1].trim());
    expect(updates.length).toBeGreaterThan(0);
    for (const data of updates) expect(data).toMatch(/^stripeCustomerId:/);
  });
});

describe("screens that show hours", () => {
  it.each([
    "src/components/screens/DoneScreen.tsx",
    "src/components/screens/RoadmapScreen.tsx",
    "src/lib/hours/queries.ts",
    "src/lib/hours/service.ts",
    "src/lib/hours/totals.ts",
    "src/lib/hours/rhythm.ts",
  ])("%s does not import billing", (file) => {
    expect(read(file)).not.toMatch(/lib\/billing/);
  });
});

import { describe, expect, it, vi } from "vitest";
import { canWatch, hasFullAccess, markLocked } from "@/lib/billing/access";
import { recordCountedViewIfCrossed, type CountingClient, type Crossing } from "@/lib/earnings/record-view";
import type { Actor } from "@/lib/roles/actor";
import { account, setupGrants } from "../../helpers/grants-memory";

// A manual grant is served by the same access function as paid access, and its watching counts (spec 11 FR-033, FR-034).

vi.mock("@/lib/db", () => ({ db: () => ({}) }));

const owner: Actor = { id: "boss", email: "boss@x.com", name: "Boss", role: "owner" };
const NOW = Date.parse("2026-11-18T12:00:00Z");
const full = { access: "full" };
const free = { access: "free" };

/** A fake database whose user row comes from the grants memory, so a grant or removal changes what counting sees. */
function countingClient(t: ReturnType<typeof setupGrants>) {
  const inserted: Record<string, unknown>[] = [];
  const client = {
    video: { findUnique: async () => ({ id: "v1", host: { userId: "ann" } }) },
    subscription: { findUnique: async () => null },
    user: { findUnique: async ({ where }: { where: { id: string } }) => ({ manualAccessAt: t.state.users.get(where.id)?.manualAccessAt ?? null }) },
    countedView: { createMany: async ({ data }: { data: Record<string, unknown>[] }) => void inserted.push(...data) },
  };
  return { client: client as unknown as CountingClient, inserted };
}

const crossing = (userId: string, over: Partial<Crossing> = {}): Crossing => ({
  userId,
  languageCode: "arz",
  videoSlug: "at-the-cafe",
  day: "2026-11-18",
  secondsBefore: 25,
  secondsAfter: 35,
  ...over,
});

describe("access through the one access rule", () => {
  it("unlocks a full-access video for a granted free account and locks it again after removal", async () => {
    const t = setupGrants({ accounts: [account("mona")] });
    const state = () => t.state.users.get("mona")!.manualAccessAt !== null;

    expect(canWatch(full, null, new Date(NOW), state())).toBe(false);
    await t.service.grantAccess(owner, { email: "mona@example.com", reason: "TESTING" });
    expect(canWatch(full, null, new Date(NOW), state())).toBe(true);
    expect(markLocked([full, free], null, new Date(NOW), state()).map((v) => v.locked)).toEqual([false, false]);

    await t.service.removeAccess(owner, { email: "mona@example.com" });
    expect(canWatch(full, null, new Date(NOW), state())).toBe(false);
    expect(markLocked([full, free], null, new Date(NOW), state()).map((v) => v.locked)).toEqual([true, false]);
  });

  it("is true with no subscription at all, and does not depend on one", () => {
    expect(hasFullAccess(null, new Date(NOW), true)).toBe(true);
    expect(hasFullAccess({ status: "CANCELED", currentPeriodEnd: new Date(NOW - 99 * 86_400_000), cancelAtPeriodEnd: false }, new Date(NOW), true)).toBe(true);
  });
});

describe("counted views from a granted account", () => {
  it("counts like a paying learner's, and stops counting after the grant is removed while the earlier view stays", async () => {
    const t = setupGrants({ accounts: [account("mona")] });
    const { client, inserted } = countingClient(t);

    await recordCountedViewIfCrossed([crossing("mona")], NOW, client);
    expect(inserted).toHaveLength(0); // no grant yet: a free learner

    await t.service.grantAccess(owner, { email: "mona@example.com", reason: "TESTING" });
    await recordCountedViewIfCrossed([crossing("mona")], NOW, client);
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ userId: "mona", videoId: "v1", creatorId: "ann", monthKey: "2026-11" });

    await t.service.removeAccess(owner, { email: "mona@example.com" });
    await recordCountedViewIfCrossed([crossing("mona", { day: "2026-11-19" })], NOW + 86_400_000, client);
    expect(inserted).toHaveLength(1); // nothing new, and the earlier view is still there
  });

  it("makes none when the granted account is the video's own creator", async () => {
    const t = setupGrants({ accounts: [account("ann", { manualAccessAt: new Date(NOW) })] });
    const { client, inserted } = countingClient(t);
    await recordCountedViewIfCrossed([crossing("ann")], NOW, client);
    expect(inserted).toHaveLength(0);
  });
});

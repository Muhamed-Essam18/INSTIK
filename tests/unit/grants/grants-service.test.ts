import { describe, expect, it, vi } from "vitest";
import { ForbiddenError } from "@/lib/roles/forbidden";
import type { Actor } from "@/lib/roles/actor";
import { account, setupGrants } from "../../helpers/grants-memory";

// Manual full access (spec 11 User Story 5; FR-032 to FR-035): recorded, append-only, owner only.

const owner: Actor = { id: "boss", email: "boss@x.com", name: "Boss", role: "owner" };
const creator: Actor = { id: "ann", email: "ann@x.com", name: "Ann", role: "creator" };
const pausedCreator: Actor = { ...creator, paused: true };
const learner: Actor = { id: "lea", email: "lea@x.com", name: null, role: "learner" };

const setup = () => setupGrants({ accounts: [account("mona"), account("sami", { subscription: { status: "ACTIVE" } })] });

describe("grantAccess", () => {
  it("gives the account Full access and records who, when, why and the note, in one step", async () => {
    const t = setup();
    expect(await t.service.grantAccess(owner, { email: "mona@example.com", reason: "TESTING", note: "  Trying the flow  " })).toEqual({ ok: true, email: "mona@example.com" });
    expect(t.state.users.get("mona")!.manualAccessAt).toEqual(new Date("2026-11-18T10:00:00Z"));
    expect(t.state.events).toEqual([{ id: "ev1", userId: "mona", kind: "GRANTED", reason: "TESTING", note: "Trying the flow", byId: "boss", at: new Date("2026-11-18T10:00:00Z") }]);
  });

  it("finds the account by the email as typed, ignoring case and spaces", async () => {
    const t = setup();
    expect(await t.service.grantAccess(owner, { email: "  MONA@Example.COM ", reason: "GIFT" })).toMatchObject({ ok: true, email: "mona@example.com" });
    expect(t.state.events[0].note).toBeNull();
  });

  it("accepts each of the four reasons", async () => {
    for (const reason of ["TESTING", "CREATOR", "GIFT", "OTHER"]) {
      const t = setup();
      expect(await t.service.grantAccess(owner, { email: "mona@example.com", reason })).toMatchObject({ ok: true });
    }
  });

  it("says so and creates nothing when no account has that email", async () => {
    const t = setup();
    expect(await t.service.grantAccess(owner, { email: "nobody@example.com", reason: "GIFT" })).toEqual({ ok: false, reason: "no-account" });
    expect(t.state.users.size).toBe(2);
    expect(t.state.events).toHaveLength(0);
  });

  it("refuses a bad email, a reason outside the four, a note over 200 characters and an account that already has a grant", async () => {
    const t = setup();
    expect(await t.service.grantAccess(owner, { email: "not-an-email", reason: "GIFT" })).toEqual({ ok: false, reason: "email" });
    expect(await t.service.grantAccess(owner, { email: "mona@example.com", reason: "BIRTHDAY" })).toEqual({ ok: false, reason: "reason" });
    expect(await t.service.grantAccess(owner, { email: "mona@example.com", reason: "GIFT", note: "a".repeat(201) })).toEqual({ ok: false, reason: "note-too-long" });
    expect(await t.service.grantAccess(owner, { email: "mona@example.com", reason: "GIFT", note: "a".repeat(200) })).toMatchObject({ ok: true });
    expect(await t.service.grantAccess(owner, { email: "mona@example.com", reason: "GIFT" })).toEqual({ ok: false, reason: "already-granted" });
    expect(t.state.events).toHaveLength(1);
  });

  it("never leaves a grant without its record: if writing the event fails, the access flag is rolled back", async () => {
    const t = setup();
    vi.spyOn(t.tx, "appendEvent").mockRejectedValueOnce(new Error("disk full"));
    await expect(t.service.grantAccess(owner, { email: "mona@example.com", reason: "GIFT" })).rejects.toThrow("disk full");
    expect(t.state.users.get("mona")!.manualAccessAt).toBeNull();
    expect(t.state.events).toHaveLength(0);
  });

  it("records one grant when two owners grant the same account at once", async () => {
    const t = setup();
    const [a, b] = await Promise.all([
      t.service.grantAccess(owner, { email: "mona@example.com", reason: "GIFT" }),
      t.service.grantAccess({ ...owner, id: "boss2" }, { email: "mona@example.com", reason: "TESTING" }),
    ]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect(t.state.events).toHaveLength(1);
  });

  it("never creates a subscription or a payment", async () => {
    const t = setup();
    await t.service.grantAccess(owner, { email: "mona@example.com", reason: "GIFT" });
    expect(t.state.users.get("mona")!.subscription).toBeNull();
  });
});

describe("removeAccess", () => {
  it("clears the grant and records the removal with the original reason", async () => {
    const t = setup();
    await t.service.grantAccess(owner, { email: "mona@example.com", reason: "CREATOR" });
    t.clock.now = new Date("2026-11-20T10:00:00Z");
    expect(await t.service.removeAccess(owner, { email: "mona@example.com", note: "Trial over" })).toEqual({ ok: true, email: "mona@example.com" });
    expect(t.state.users.get("mona")!.manualAccessAt).toBeNull();
    expect(t.state.events).toHaveLength(2);
    expect(t.state.events[1]).toMatchObject({ kind: "REMOVED", reason: "CREATOR", note: "Trial over", byId: "boss", at: new Date("2026-11-20T10:00:00Z") });
    expect(t.state.events[0].kind).toBe("GRANTED"); // the history is kept
  });

  it("never touches the account's own paid subscription", async () => {
    const t = setup();
    const subscription = t.state.users.get("sami")!.subscription;
    await t.service.grantAccess(owner, { email: "sami@example.com", reason: "TESTING" });
    await t.service.removeAccess(owner, { email: "sami@example.com" });
    expect(t.state.users.get("sami")!.subscription).toBe(subscription);
    expect(t.state.users.get("sami")!.subscription).toEqual({ status: "ACTIVE" });
  });

  it("refuses an account with no grant, or none at all, and a long note", async () => {
    const t = setup();
    expect(await t.service.removeAccess(owner, { email: "mona@example.com" })).toEqual({ ok: false, reason: "no-grant" });
    expect(await t.service.removeAccess(owner, { email: "nobody@example.com" })).toEqual({ ok: false, reason: "no-account" });
    expect(await t.service.removeAccess(owner, { email: "bad" })).toEqual({ ok: false, reason: "email" });
    await t.service.grantAccess(owner, { email: "mona@example.com", reason: "GIFT" });
    expect(await t.service.removeAccess(owner, { email: "mona@example.com", note: "a".repeat(201) })).toEqual({ ok: false, reason: "note-too-long" });
    expect(t.state.users.get("mona")!.manualAccessAt).not.toBeNull();
  });

  it("allows a new grant after a removal", async () => {
    const t = setup();
    await t.service.grantAccess(owner, { email: "mona@example.com", reason: "GIFT" });
    await t.service.removeAccess(owner, { email: "mona@example.com" });
    expect(await t.service.grantAccess(owner, { email: "mona@example.com", reason: "TESTING" })).toMatchObject({ ok: true });
    expect(t.state.events.map((e) => e.kind)).toEqual(["GRANTED", "REMOVED", "GRANTED"]);
  });
});

describe("the history", () => {
  it("is append-only: the service has no function to edit or delete an event", () => {
    expect(Object.keys(setup().service).sort()).toEqual(["grantAccess", "listGrants", "removeAccess"]);
  });

  it("lists active grants, then the latest events newest first, at most 100", async () => {
    const t = setup();
    await t.service.grantAccess(owner, { email: "mona@example.com", reason: "GIFT" });
    t.clock.now = new Date("2026-11-19T10:00:00Z");
    await t.service.grantAccess(owner, { email: "sami@example.com", reason: "TESTING", note: "n" });
    const view = await t.service.listGrants(owner);
    expect(view.active.map((a) => a.email).sort()).toEqual(["mona@example.com", "sami@example.com"]);
    expect(view.events.map((e) => e.email)).toEqual(["sami@example.com", "mona@example.com"]);
    expect(view.truncated).toBe(false);

    for (let i = 0; i < 105; i += 1) t.state.events.push({ id: `x${i}`, userId: "mona", kind: "GRANTED", reason: "OTHER", note: null, byId: "boss", at: new Date(Date.UTC(2026, 0, 1, 0, i)) });
    const long = await t.service.listGrants(owner);
    expect(long.events).toHaveLength(100);
    expect(long.truncated).toBe(true);
  });
});

describe("who may use it", () => {
  it.each(["grantAccess", "removeAccess", "listGrants"] as const)("%s refuses a creator, a paused creator, a learner and nobody, before touching the store", async (name) => {
    for (const actor of [creator, pausedCreator, learner, null, undefined]) {
      const t = setup();
      const transaction = vi.spyOn(t.store, "transaction");
      const active = vi.spyOn(t.store, "active");
      const call =
        name === "grantAccess"
          ? t.service.grantAccess(actor, { email: "mona@example.com", reason: "GIFT" })
          : name === "removeAccess"
            ? t.service.removeAccess(actor, { email: "mona@example.com" })
            : t.service.listGrants(actor);
      await expect(call).rejects.toBeInstanceOf(ForbiddenError);
      expect(transaction).not.toHaveBeenCalled();
      expect(active).not.toHaveBeenCalled();
      expect(t.state.events).toHaveLength(0);
      expect(t.state.users.get("mona")!.manualAccessAt).toBeNull();
    }
  });
});

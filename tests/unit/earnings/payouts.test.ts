import { describe, expect, it } from "vitest";
import { creatorActor, creatorViews, learnerActor, owner, setupEarnings } from "../../helpers/earnings-memory";
import { ForbiddenError } from "@/lib/roles/forbidden";

// Payouts are recorded, never sent (spec 11 FR-029 to FR-031; constitution XII): append-only, amount copied from the closed earning.

const october = [creatorViews("omar", 3_680, 1, "Omar"), creatorViews("salma", 2_300, 2, "Salma"), creatorViews("nour", 1_840, 3, "Nour"), creatorViews("karim", 1_380, 4, "Karim")];

async function closed(over: Parameters<typeof setupEarnings>[0] = {}) {
  const t = setupEarnings({ now: "2026-11-05T09:00:00Z", revenue: { "2026-10": {} }, views: { "2026-10": october }, ...over });
  await t.service.closeMonth(owner, "2026-10");
  return t;
}
const pay = (t: Awaited<ReturnType<typeof closed>>, creatorId: string, reference = "TR-2026-11-05-001") => t.service.markPaid(owner, { month: "2026-10", creatorId, reference });

describe("markPaid", () => {
  it("stores creator, month, amount and currency from the closed earning, the owner, the time and the reference", async () => {
    const t = await closed();
    expect(await pay(t, "omar", "  TR-001 ")).toEqual({ ok: true });
    expect(t.state.payouts).toHaveLength(1);
    expect(t.state.payouts[0]).toMatchObject({ month: "2026-10", creatorId: "omar", kind: "PAID", amountCents: 73_600, currency: "EUR", reference: "TR-001", byId: "boss", reversesId: null });
    expect(t.state.payouts[0].at).toEqual(new Date("2026-11-05T09:00:00Z"));
  });

  it("never takes the amount or currency from the caller", async () => {
    const t = await closed();
    await t.service.markPaid(owner, { month: "2026-10", creatorId: "omar", reference: "TR-1", amountCents: 1, currency: "USD" } as never);
    expect(t.state.payouts[0]).toMatchObject({ amountCents: 73_600, currency: "EUR" });
  });

  it("marks that creator paid and leaves the others unpaid", async () => {
    const t = await closed();
    await pay(t, "salma");
    const s = (await t.service.getStatement(owner, "2026-10"))!;
    expect(s.lines.map((l) => [l.name, l.payout])).toEqual([["Omar", "unpaid"], ["Salma", "paid"], ["Nour", "unpaid"], ["Karim", "unpaid"]]);
    expect(s.lines.find((l) => l.name === "Salma")!.paidAt).toEqual(new Date("2026-11-05T09:00:00Z"));
    expect(s.payouts).toHaveLength(1);
    expect(t.state.payouts.filter((p) => p.creatorId !== "salma")).toHaveLength(0);
  });

  it("is refused for a month that is still open", async () => {
    const t = setupEarnings({ now: "2026-11-05T09:00:00Z", revenue: { "2026-10": {} }, views: { "2026-10": october } });
    expect(await pay(t as never, "omar")).toEqual({ ok: false, reason: "open" });
    expect(t.state.payouts).toHaveLength(0);
  });

  it("is refused when the creator has nothing to be paid, or is not in that month", async () => {
    const t = await closed({ revenue: { "2026-10": { grossCents: 100, vatCents: 100, feesCents: 0, refundsCents: 0 } } });
    expect(await pay(t, "omar")).toEqual({ ok: false, reason: "nothing-to-pay" });
    expect(await pay(t, "stranger")).toEqual({ ok: false, reason: "nothing-to-pay" });
    expect(t.state.payouts).toHaveLength(0);
  });

  it("is refused when the creator is already marked as paid", async () => {
    const t = await closed();
    await pay(t, "omar");
    expect(await pay(t, "omar", "TR-2")).toEqual({ ok: false, reason: "already-paid" });
    expect(t.state.payouts).toHaveLength(1);
  });

  it("needs a reference of 1 to 120 characters", async () => {
    const t = await closed();
    expect(await pay(t, "omar", "   ")).toEqual({ ok: false, reason: "empty" });
    expect(await pay(t, "omar", "a".repeat(121))).toEqual({ ok: false, reason: "too-long" });
    expect(await pay(t, "omar", "a".repeat(120))).toEqual({ ok: true });
  });

  it("records one payment when two owners mark the same creator at once", async () => {
    const t = await closed();
    const [a, b] = await Promise.all([pay(t, "omar", "A"), pay(t, "omar", "B")]);
    expect([a, b].filter((r) => r.ok)).toHaveLength(1);
    expect(t.state.payouts).toHaveLength(1);
  });
});

describe("reversing a payment", () => {
  it("adds a reversing record, after which the creator is unpaid and can be marked paid again", async () => {
    const t = await closed();
    await pay(t, "omar", "TR-WRONG");
    const paid = t.state.payouts[0];
    expect(await t.service.reversePayout(owner, { payoutId: paid.id, reason: "Sent to the wrong account" })).toEqual({ ok: true });

    expect(t.state.payouts).toHaveLength(2);
    expect(t.state.payouts[1]).toMatchObject({ kind: "REVERSAL", amountCents: 73_600, currency: "EUR", reference: "Sent to the wrong account", reversesId: paid.id, byId: "boss" });
    expect(t.state.payouts[0]).toEqual(paid); // the payment itself is untouched

    const unpaid = (await t.service.getStatement(owner, "2026-10"))!.lines.find((l) => l.name === "Omar")!;
    expect(unpaid.payout).toBe("unpaid");
    expect(await pay(t, "omar", "TR-RIGHT")).toEqual({ ok: true });
    expect((await t.service.getStatement(owner, "2026-10"))!.lines.find((l) => l.name === "Omar")!.payout).toBe("paid");
    expect(t.state.payouts).toHaveLength(3); // the history stays
  });

  it("refuses to reverse the same payment twice, a reversal, an unknown record, or with no reason", async () => {
    const t = await closed();
    await pay(t, "omar");
    const paid = t.state.payouts[0];
    expect(await t.service.reversePayout(owner, { payoutId: paid.id, reason: "   " })).toEqual({ ok: false, reason: "empty" });
    expect(await t.service.reversePayout(owner, { payoutId: paid.id, reason: "Mistake" })).toEqual({ ok: true });
    expect(await t.service.reversePayout(owner, { payoutId: paid.id, reason: "Again" })).toEqual({ ok: false, reason: "already-reversed" });
    expect(await t.service.reversePayout(owner, { payoutId: t.state.payouts[1].id, reason: "Undo the undo" })).toEqual({ ok: false, reason: "not-paid" });
    expect(await t.service.reversePayout(owner, { payoutId: "nope", reason: "x" })).toEqual({ ok: false, reason: "not-found" });
    expect(t.state.payouts).toHaveLength(2);
  });
});

describe("the payout records are append-only", () => {
  it("the service offers no way to edit or delete a payout", async () => {
    const t = await closed();
    const names = Object.keys(t.service);
    expect(names.filter((n) => /edit|update|delete|remove/i.test(n))).toEqual([]);
  });

  it("keeps only the latest 100 records in the history shown, and says so", async () => {
    const t = await closed();
    for (let i = 0; i < 101; i += 1) t.state.payouts.push({ id: `old${i}`, month: "2026-10", creatorId: "omar", kind: "REVERSAL", amountCents: 1, currency: "EUR", reference: "x", byId: "boss", at: new Date(Date.UTC(2026, 10, 1, 0, i)), reversesId: null });
    const s = (await t.service.getStatement(owner, "2026-10"))!;
    expect(s.payouts).toHaveLength(100);
    expect(s.payoutsTruncated).toBe(true);
    expect(s.payouts[0].at.getTime()).toBeGreaterThan(s.payouts[99].at.getTime());
  });
});

describe("who may mark payments", () => {
  it("refuses a creator (even for their own month) and a learner, and records nothing", async () => {
    const t = await closed();
    for (const actor of [creatorActor("omar"), learnerActor, null]) {
      await expect(t.service.markPaid(actor, { month: "2026-10", creatorId: "omar", reference: "x" })).rejects.toBeInstanceOf(ForbiddenError);
      await expect(t.service.reversePayout(actor, { payoutId: "p", reason: "x" })).rejects.toBeInstanceOf(ForbiddenError);
    }
    expect(t.state.payouts).toHaveLength(0);
  });
});

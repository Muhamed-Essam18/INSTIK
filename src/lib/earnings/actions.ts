"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import {
  adjustmentRefusal,
  amountProblem,
  closeRefusal,
  fieldLabel,
  payoutRefusal,
  saveRefusal,
  type RevenueField,
} from "./messages";
import { earningsService } from "./instance";
import { parseEuros, parseSignedEuros } from "./rules";
import { ownerEarningsPath } from "@/lib/routes";
import { requireOwner } from "@/lib/session";

// The owner's earnings actions. Each one checks the owner role again on the server, validates its input with zod, and never takes
// an actor, a role, a user id, an amount for a payout or a currency from its input. After a change that creators can see, it expires
// the cached dashboards (updateTag works only inside a server action): "creator-earnings" for every creator, "creator-stats:<id>" for one.

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; message: string };

const INPUT_PROBLEM = { ok: false, message: "Something didn't go through. Please try again." } as const;
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

const revenueInput = z.object({
  month,
  expectedVersion: z.number().int().min(0).max(1_000_000),
  gross: z.string().max(40),
  vat: z.string().max(40),
  fees: z.string().max(40),
  refunds: z.string().max(40),
});

/** Saves the month's revenue figures, typed as euros. The service checks the month is open and the version is current. */
export async function saveRevenue(input: unknown): Promise<ActionResult<{ version: number }>> {
  const actor = await requireOwner(ownerEarningsPath());
  const parsed = revenueInput.safeParse(input);
  if (!parsed.success) return INPUT_PROBLEM;

  const cents: Record<RevenueField, number> = { grossCents: 0, vatCents: 0, feesCents: 0, refundsCents: 0 };
  const fields: [RevenueField, string][] = [
    ["grossCents", parsed.data.gross],
    ["vatCents", parsed.data.vat],
    ["feesCents", parsed.data.fees],
    ["refundsCents", parsed.data.refunds],
  ];
  for (const [field, text] of fields) {
    const result = parseEuros(text);
    if (!result.ok) return { ok: false, message: amountProblem(result.reason, fieldLabel[field]) };
    cents[field] = result.cents;
  }

  const result = await earningsService().saveRevenue(actor, { month: parsed.data.month, figures: cents, expectedVersion: parsed.data.expectedVersion });
  if (!result.ok) return { ok: false, message: saveRefusal(result.reason, result.field) };
  updateTag("creator-earnings");
  return { ok: true, version: result.version };
}

const adjustmentInput = z.object({ month, amount: z.string().max(40), note: z.string().max(400) });

/** Adds a signed correction to an open month (usually for an earlier closed one). The month's currency is used; none is taken from input. */
export async function addAdjustment(input: unknown): Promise<ActionResult> {
  const actor = await requireOwner(ownerEarningsPath());
  const parsed = adjustmentInput.safeParse(input);
  if (!parsed.success) return INPUT_PROBLEM;
  const amount = parseSignedEuros(parsed.data.amount);
  if (!amount.ok) return { ok: false, message: amountProblem(amount.reason === "negative" ? "not-a-number" : amount.reason, "The amount") };

  const result = await earningsService().addAdjustment(actor, { month: parsed.data.month, amountCents: amount.cents, note: parsed.data.note });
  if (!result.ok) return { ok: false, message: adjustmentRefusal(result.reason) };
  updateTag("creator-earnings");
  return { ok: true };
}

/** Closes an ended month and locks its numbers. Safe to repeat: a second call changes nothing. */
export async function closeMonth(input: unknown): Promise<ActionResult<{ alreadyClosed: boolean }>> {
  const actor = await requireOwner(ownerEarningsPath());
  const parsed = z.object({ month }).safeParse(input);
  if (!parsed.success) return INPUT_PROBLEM;

  const result = await earningsService().closeMonth(actor, parsed.data.month);
  if (!result.ok) return { ok: false, message: closeRefusal(result.reason) };
  updateTag("creator-earnings");
  for (const id of result.creatorIds) updateTag(`creator-stats:${id}`);
  return { ok: true, alreadyClosed: result.alreadyClosed };
}

const markPaidInput = z.object({ month, creatorId: z.string().min(1).max(64), reference: z.string().max(400) });

/** Records that a creator was paid for a closed month. The amount and currency come from the closed month, never from the browser. */
export async function markPaid(input: unknown): Promise<ActionResult> {
  const actor = await requireOwner(ownerEarningsPath());
  const parsed = markPaidInput.safeParse(input);
  if (!parsed.success) return INPUT_PROBLEM;

  const result = await earningsService().markPaid(actor, parsed.data);
  if (!result.ok) return { ok: false, message: payoutRefusal(result.reason) };
  updateTag(`creator-stats:${parsed.data.creatorId}`);
  return { ok: true };
}

const reverseInput = z.object({ payoutId: z.string().min(1).max(64), creatorId: z.string().min(1).max(64), reason: z.string().max(400) });

/** Undoes a payment by adding a reversing record. The creatorId is only used to refresh that creator's dashboard, never to find the payment. */
export async function reversePayout(input: unknown): Promise<ActionResult> {
  const actor = await requireOwner(ownerEarningsPath());
  const parsed = reverseInput.safeParse(input);
  if (!parsed.success) return INPUT_PROBLEM;

  const result = await earningsService().reversePayout(actor, { payoutId: parsed.data.payoutId, reason: parsed.data.reason });
  if (!result.ok) return { ok: false, message: payoutRefusal(result.reason) };
  updateTag(`creator-stats:${parsed.data.creatorId}`);
  return { ok: true };
}

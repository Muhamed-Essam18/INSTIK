import { isMonthKey, monthKeyOf, nextMonth } from "@/lib/time/warsaw";

// Validation and small rules for money input (spec 11). Pure: no database, no clock except what is passed in.
// Amounts are integer cents. Text is converted by string handling only; nothing here multiplies a float.

export const MAX_CENTS = 1_000_000_000;
export const MAX_NOTE = 200;
export const MAX_REFERENCE = 120;
export const CURRENCY = "EUR";

export { isMonthKey };

export type CentsProblem = "empty" | "not-a-number" | "too-many-decimals" | "negative" | "too-large";
export type CentsResult = { ok: true; cents: number } | { ok: false; reason: CentsProblem };

const UNSIGNED = /^(\d{1,3}(,\d{3})+|\d+)(\.(\d+))?$/;

function toCents(unsigned: string): CentsResult {
  const match = UNSIGNED.exec(unsigned);
  if (!match) return { ok: false, reason: "not-a-number" };
  if (match[4] && match[4].length > 2) return { ok: false, reason: "too-many-decimals" };
  const whole = match[1].replace(/,/g, "");
  if (whole.replace(/^0+/, "").length > 10) return { ok: false, reason: "too-large" };
  const fraction = (match[4] ?? "").padEnd(2, "0");
  return { ok: true, cents: Number(whole) * 100 + Number(fraction) };
}

const clean = (text: string) => text.trim().replace(/^€\s*/, "");

/** Euros typed by a person (plain digits, thousands separators, an optional euro sign) to whole cents. Never negative; at most two decimals. */
export function parseEuros(text: string): CentsResult {
  const value = clean(text);
  if (value === "") return { ok: false, reason: "empty" };
  if (value.startsWith("-")) return { ok: false, reason: "negative" };
  const result = toCents(value);
  if (result.ok && result.cents > MAX_CENTS) return { ok: false, reason: "too-large" };
  return result;
}

/** Like `parseEuros` but a leading minus is allowed (adjustments can go either way). */
export function parseSignedEuros(text: string): CentsResult {
  const value = clean(text);
  if (value === "") return { ok: false, reason: "empty" };
  const negative = value.startsWith("-");
  const result = toCents(negative || value.startsWith("+") ? value.slice(1).trim() : value);
  if (!result.ok) return result;
  if (result.cents > MAX_CENTS) return { ok: false, reason: "too-large" };
  return { ok: true, cents: negative ? -result.cents : result.cents };
}

export type RevenueFigures = { grossCents: number; vatCents: number; feesCents: number; refundsCents: number };
export type RevenueProblem = { ok: false; field: keyof RevenueFigures; reason: "not-whole" | "negative" | "too-large" };

/** Each figure is a whole number of cents from 0 to 1,000,000,000. */
export function validateRevenue(figures: RevenueFigures): { ok: true } | RevenueProblem {
  for (const field of ["grossCents", "vatCents", "feesCents", "refundsCents"] as const) {
    const value = figures[field];
    if (!Number.isInteger(value)) return { ok: false, field, reason: "not-whole" };
    if (value < 0) return { ok: false, field, reason: "negative" };
    if (value > MAX_CENTS) return { ok: false, field, reason: "too-large" };
  }
  return { ok: true };
}

export type AdjustmentProblem = "not-whole" | "zero" | "too-large" | "no-note" | "note-too-long";

/** A signed, non-zero whole number of cents within plus or minus 1,000,000,000, and a note of 1 to 200 characters. */
export function validateAdjustment(input: { amountCents: number; note: string }): { ok: true } | { ok: false; reason: AdjustmentProblem } {
  if (!Number.isInteger(input.amountCents)) return { ok: false, reason: "not-whole" };
  if (input.amountCents === 0) return { ok: false, reason: "zero" };
  if (Math.abs(input.amountCents) > MAX_CENTS) return { ok: false, reason: "too-large" };
  const note = input.note.trim();
  if (note.length === 0) return { ok: false, reason: "no-note" };
  if (note.length > MAX_NOTE) return { ok: false, reason: "note-too-long" };
  return { ok: true };
}

/** A payout reference (or the reason for a reversal): 1 to 120 characters once trimmed. */
export function validateReference(text: string): { ok: true; value: string } | { ok: false; reason: "empty" | "too-long" } {
  const value = text.trim();
  if (value.length === 0) return { ok: false, reason: "empty" };
  if (value.length > MAX_REFERENCE) return { ok: false, reason: "too-long" };
  return { ok: true, value };
}

export type PayoutRecord = { kind: "PAID" | "REVERSAL"; amountCents: number };

/** A creator-month is paid when the paid records minus the reversals equal the earnings, and there is something to pay. */
export function isPaid(earningsCents: number, records: readonly PayoutRecord[]): boolean {
  if (earningsCents <= 0) return false;
  const net = records.reduce((sum, r) => sum + (r.kind === "PAID" ? r.amountCents : -r.amountCents), 0);
  return net === earningsCents;
}

/** The "next payout" day shown to creators: the 5th of next month in Warsaw time, as "YYYY-MM-DD". Display only; never enforced. */
export function nextPayoutDay(now: Date): string {
  return `${nextMonth(monthKeyOf(now))}-05`;
}

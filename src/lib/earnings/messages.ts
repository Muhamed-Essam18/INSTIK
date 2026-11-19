import type { CentsProblem } from "./rules";

// What the earnings screens say. Short, calm and specific: what happened and what to do next. No blame, no alarm words.

export type RevenueField = "grossCents" | "vatCents" | "feesCents" | "refundsCents";

export const fieldLabel: Record<RevenueField, string> = {
  grossCents: "Subscription revenue (gross)",
  vatCents: "VAT collected",
  feesCents: "Payment fees",
  refundsCents: "Refunds",
};

export type SaveReason = "month" | "future" | "closed" | "stale" | "negative" | "not-whole" | "too-large" | "read-only";

/** The sentence shown when a revenue save is not accepted. */
export function saveRefusal(reason: SaveReason, field?: RevenueField): string {
  switch (reason) {
    case "month":
      return "Choose a month from the list.";
    case "future":
      return "That month hasn't started yet.";
    case "closed":
      return "This month is closed, so its numbers stay as they are. Corrections go in as an adjustment in the open month.";
    case "stale":
      return "Figures changed. Reload to see them.";
    case "negative":
      return `${field ? fieldLabel[field] : "That amount"} can't be below zero.`;
    case "not-whole":
      return "Use euros with up to two decimals, like 12.50.";
    case "too-large":
      return "That amount is larger than we can keep. Please check it.";
    case "read-only":
      return "These figures come from the payment provider and can't be edited here.";
  }
}

/** The sentence for a typed amount that could not be read. */
export function amountProblem(reason: CentsProblem, label: string): string {
  switch (reason) {
    case "empty":
      return `Please fill in ${label.toLowerCase()}. Zero is fine.`;
    case "negative":
      return `${label} can't be below zero.`;
    case "too-large":
      return "That amount is larger than we can keep. Please check it.";
    case "too-many-decimals":
    case "not-a-number":
      return `${label}: use euros with up to two decimals, like 12.50.`;
  }
}

export const NOT_ENTERED = "Revenue for this month hasn't been entered yet.";
export const NO_VIEWS = "No counted views this month, so nobody earns anything.";
export const ESTIMATED = "estimated";
export const FINAL = "final";

/** Shown when net revenue is floored at zero (the amount is passed in already formatted). */
export const netZeroExplanation = (zero: string) =>
  `Net revenue is ${zero} this month because VAT, fees and refunds are as much as the gross revenue. Nobody earns this month.`;

export const LEFTOVER_CENTS_HELP =
  "When a split does not divide into whole cents, the extra cents go to the creators with the largest remainders, earlier-joined first.";

export type AdjustmentRefusal = "month" | "future" | "closed" | "not-whole" | "zero" | "too-large" | "no-note" | "note-too-long";

/** The sentence shown when an adjustment is not accepted. */
export function adjustmentRefusal(reason: AdjustmentRefusal): string {
  switch (reason) {
    case "month":
      return "Choose a month from the list.";
    case "future":
      return "That month hasn't started yet.";
    case "closed":
      return "That month is closed. Add the adjustment to the open month instead.";
    case "not-whole":
      return "Use euros with up to two decimals, like -12.50.";
    case "zero":
      return "An adjustment needs an amount, plus or minus. Zero changes nothing.";
    case "too-large":
      return "That amount is larger than we can keep. Please check it.";
    case "no-note":
      return "Add a short note: which month it corrects and why.";
    case "note-too-long":
      return "Please shorten the note to 200 characters or fewer.";
  }
}

export type CloseRefusal = "month" | "not-ended" | "no-revenue";

export function closeRefusal(reason: CloseRefusal): string {
  switch (reason) {
    case "month":
      return "Choose a month from the list.";
    case "not-ended":
      return "This month hasn't ended yet. You can close it once it has.";
    case "no-revenue":
      return "Enter this month's revenue first, then close it.";
  }
}

export const CLOSE_CONFIRM = (monthLabel: string) => `Close ${monthLabel}? This locks its numbers. Corrections go in as adjustments in the next open month.`;

export type PayoutRefusal = "month" | "open" | "nothing-to-pay" | "already-paid" | "empty" | "too-long" | "not-found" | "not-paid" | "already-reversed";

export function payoutRefusal(reason: PayoutRefusal): string {
  switch (reason) {
    case "month":
    case "not-found":
      return "We couldn't find that payment. Reload and try again.";
    case "open":
      return "Close the month first, then mark payments.";
    case "nothing-to-pay":
      return "There is nothing to pay this creator for this month.";
    case "already-paid":
      return "This creator is already marked as paid.";
    case "empty":
      return "Add a reference, like the bank transfer number.";
    case "too-long":
      return "Please shorten the reference to 120 characters or fewer.";
    case "not-paid":
      return "Only a payment can be undone.";
    case "already-reversed":
      return "This payment has already been undone.";
  }
}

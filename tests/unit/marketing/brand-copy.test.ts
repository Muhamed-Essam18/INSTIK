import { describe, expect, it } from "vitest";
import { priceLabel, savingLabel } from "@/lib/billing/plans";
import * as copy from "@/lib/marketing/copy";

// Brand behaviours as acceptance criteria (constitution II): no streak pressure, urgency or real prices, no internal
// level names, hours only ever "estimates". This walks every learner-facing string in the marketing copy.

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (typeof value === "function") return strings((value as (name: string) => unknown)("Egyptian Arabic"));
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

const all = strings(copy);

// Sentences that say the opposite of the bad thing.
const allowedStreak = ["streak panic", "streak pressure"];
const withoutAllowed = (text: string) => allowedStreak.reduce((t, a) => t.split(a).join(""), text);

describe("marketing copy", () => {
  it("finds the copy to check", () => {
    expect(all.length).toBeGreaterThan(60);
  });

  it.each(all)("%s", (text) => {
    const t = withoutAllowed(text);
    expect(t).not.toMatch(/streak/i);
    expect(t).not.toMatch(/hurry|limited time|countdown|last chance|don't miss|only \d+ left/i);
    expect(t).not.toMatch(/superbeginner|\bbeginner\b|intermediate|\badvanced\b/i);
    expect(t).not.toMatch(/[$€£]\s?\d|\d\s?(usd|eur|gbp)\b/i);
    expect(t).not.toMatch(/gdpr|compliant|certified/i);
  });

  it("keeps price placeholders visible", () => {
    expect(priceLabel("monthly")).toMatch(/^\[.*\]$/);
    expect(priceLabel("yearly")).toMatch(/^\[.*\]$/);
    expect(savingLabel()).toMatch(/^\[.*\]$/);
  });

  it("has the agreed pricing content", () => {
    expect(copy.pricing.free.items).toHaveLength(4);
    expect(copy.pricing.full.items).toHaveLength(5);
    expect(copy.pricing.faqs).toHaveLength(4);
  });

  it("says the Privacy text is a placeholder about the waitlist", () => {
    const text = strings(copy.privacy).join(" ");
    expect(text).toMatch(/waitlist/i);
    expect(text).toMatch(/full policy/i);
  });

  it("gives the pronunciation", () => {
    expect(strings(copy.about).join(" ")).toContain("in-STICK");
  });
});

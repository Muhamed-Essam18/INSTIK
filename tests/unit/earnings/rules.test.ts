import { describe, expect, it } from "vitest";
import {
  isPaid,
  MAX_CENTS,
  nextPayoutDay,
  parseEuros,
  parseSignedEuros,
  validateAdjustment,
  validateReference,
  validateRevenue,
} from "@/lib/earnings/rules";

const cents = (text: string) => {
  const r = parseEuros(text);
  return r.ok ? r.cents : r.reason;
};

describe("parseEuros", () => {
  it("converts whole euros, euros with cents and thousands separators", () => {
    expect(cents("3000")).toBe(300_000);
    expect(cents("3,000.50")).toBe(300_050);
    expect(cents("12.5")).toBe(1_250);
    expect(cents("€43")).toBe(4_300);
    expect(cents("0.07")).toBe(7);
    expect(cents("  96.00 ")).toBe(9_600);
  });

  it("is exact where floating point is not (0.1, 0.2, 1.15, 4.35)", () => {
    expect(cents("0.1")).toBe(10);
    expect(cents("0.2")).toBe(20);
    expect(cents("1.15")).toBe(115);
    expect(cents("4.35")).toBe(435);
    expect(cents("1.005")).toBe("too-many-decimals");
  });

  it("refuses text that is not an amount", () => {
    expect(cents("")).toBe("empty");
    expect(cents("   ")).toBe("empty");
    expect(cents("1e3")).toBe("not-a-number");
    expect(cents("abc")).toBe("not-a-number");
    expect(cents("12,34")).toBe("not-a-number");
    expect(cents("1.2.3")).toBe("not-a-number");
  });

  it("refuses negatives and more than two decimals", () => {
    expect(cents("-5")).toBe("negative");
    expect(cents("-0.01")).toBe("negative");
    expect(cents("5.123")).toBe("too-many-decimals");
  });

  it("accepts exactly 1,000,000,000 cents and refuses one more", () => {
    expect(cents("10000000.00")).toBe(MAX_CENTS);
    expect(cents("10000000.01")).toBe("too-large");
    expect(cents("99999999999")).toBe("too-large");
  });
});

describe("parseSignedEuros", () => {
  it("allows a minus or plus sign", () => {
    expect(parseSignedEuros("-43")).toEqual({ ok: true, cents: -4_300 });
    expect(parseSignedEuros("+12.50")).toEqual({ ok: true, cents: 1_250 });
    expect(parseSignedEuros("7")).toEqual({ ok: true, cents: 700 });
  });

  it("keeps the other refusals", () => {
    expect(parseSignedEuros("-5.123")).toEqual({ ok: false, reason: "too-many-decimals" });
    expect(parseSignedEuros("--5")).toEqual({ ok: false, reason: "not-a-number" });
    expect(parseSignedEuros("-10000000.01")).toEqual({ ok: false, reason: "too-large" });
    expect(parseSignedEuros("")).toEqual({ ok: false, reason: "empty" });
  });
});

describe("validateRevenue", () => {
  const ok = { grossCents: 300_000, vatCents: 56_100, feesCents: 9_600, refundsCents: 4_300 };

  it("accepts whole cents from 0 to 1,000,000,000", () => {
    expect(validateRevenue(ok)).toEqual({ ok: true });
    expect(validateRevenue({ ...ok, refundsCents: 0 })).toEqual({ ok: true });
    expect(validateRevenue({ ...ok, grossCents: MAX_CENTS })).toEqual({ ok: true });
  });

  it("names the field it refuses", () => {
    expect(validateRevenue({ ...ok, vatCents: -1 })).toEqual({ ok: false, field: "vatCents", reason: "negative" });
    expect(validateRevenue({ ...ok, feesCents: 1.5 })).toEqual({ ok: false, field: "feesCents", reason: "not-whole" });
    expect(validateRevenue({ ...ok, grossCents: MAX_CENTS + 1 })).toEqual({ ok: false, field: "grossCents", reason: "too-large" });
    expect(validateRevenue({ ...ok, refundsCents: Number.NaN })).toEqual({ ok: false, field: "refundsCents", reason: "not-whole" });
  });
});

describe("validateAdjustment", () => {
  it("needs a non-zero whole amount within the limit and a note of 1 to 200 characters", () => {
    expect(validateAdjustment({ amountCents: -4_300, note: "Late refund for October" })).toEqual({ ok: true });
    expect(validateAdjustment({ amountCents: 0, note: "x" })).toEqual({ ok: false, reason: "zero" });
    expect(validateAdjustment({ amountCents: 1.5, note: "x" })).toEqual({ ok: false, reason: "not-whole" });
    expect(validateAdjustment({ amountCents: MAX_CENTS + 1, note: "x" })).toEqual({ ok: false, reason: "too-large" });
    expect(validateAdjustment({ amountCents: -MAX_CENTS - 1, note: "x" })).toEqual({ ok: false, reason: "too-large" });
    expect(validateAdjustment({ amountCents: 5, note: "   " })).toEqual({ ok: false, reason: "no-note" });
    expect(validateAdjustment({ amountCents: 5, note: "a".repeat(200) })).toEqual({ ok: true });
    expect(validateAdjustment({ amountCents: 5, note: "a".repeat(201) })).toEqual({ ok: false, reason: "note-too-long" });
  });
});

describe("validateReference", () => {
  it("trims, and needs 1 to 120 characters", () => {
    expect(validateReference("  TR-2026-11-04 ")).toEqual({ ok: true, value: "TR-2026-11-04" });
    expect(validateReference("")).toEqual({ ok: false, reason: "empty" });
    expect(validateReference("a".repeat(120))).toEqual({ ok: true, value: "a".repeat(120) });
    expect(validateReference("a".repeat(121))).toEqual({ ok: false, reason: "too-long" });
  });
});

describe("isPaid", () => {
  it("is paid when paid records minus reversals equal the earnings", () => {
    expect(isPaid(1_000, [])).toBe(false);
    expect(isPaid(1_000, [{ kind: "PAID", amountCents: 1_000 }])).toBe(true);
    expect(isPaid(1_000, [{ kind: "PAID", amountCents: 1_000 }, { kind: "REVERSAL", amountCents: 1_000 }])).toBe(false);
    expect(
      isPaid(1_000, [
        { kind: "PAID", amountCents: 1_000 },
        { kind: "REVERSAL", amountCents: 1_000 },
        { kind: "PAID", amountCents: 1_000 },
      ]),
    ).toBe(true);
  });

  it("is never paid when there is nothing to pay", () => {
    expect(isPaid(0, [])).toBe(false);
    expect(isPaid(0, [{ kind: "PAID", amountCents: 0 }])).toBe(false);
  });
});

describe("nextPayoutDay", () => {
  it("is the 5th of next month in Warsaw time", () => {
    expect(nextPayoutDay(new Date("2026-11-10T12:00:00Z"))).toBe("2026-12-05");
    expect(nextPayoutDay(new Date("2026-12-31T12:00:00Z"))).toBe("2027-01-05");
  });

  it("follows the Warsaw month, not UTC, around midnight", () => {
    expect(nextPayoutDay(new Date("2026-11-30T23:30:00Z"))).toBe("2027-01-05");
    expect(nextPayoutDay(new Date("2026-11-30T22:30:00Z"))).toBe("2026-12-05");
  });
});

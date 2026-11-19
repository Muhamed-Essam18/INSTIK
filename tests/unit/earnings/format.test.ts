import { describe, expect, it } from "vitest";
import { formatDay, formatEuros, formatMoney, formatMonth, formatPercent } from "@/lib/earnings/format";

describe("formatMoney", () => {
  it("shows euros with thousands separators and two decimals", () => {
    expect(formatEuros(230_000)).toBe("€2,300.00");
    expect(formatEuros(41_250)).toBe("€412.50");
    expect(formatEuros(5)).toBe("€0.05");
    expect(formatEuros(0)).toBe("€0.00");
    expect(formatEuros(100_000_000_000)).toBe("€1,000,000,000.00");
  });

  it("shows a negative amount with a minus before the sign", () => {
    expect(formatEuros(-56_100)).toBe("−€561.00");
  });

  it("shows another currency by its code", () => {
    expect(formatMoney(1_250, "USD")).toBe("USD 12.50");
  });
});

describe("formatPercent", () => {
  it("shows one decimal place", () => {
    expect(formatPercent(3_680, 9_200)).toBe("40.0%");
    expect(formatPercent(2_300, 9_200)).toBe("25.0%");
    expect(formatPercent(1, 3)).toBe("33.3%");
    expect(formatPercent(2, 3)).toBe("66.7%");
  });

  it("is 0.0% with no views or no total", () => {
    expect(formatPercent(0, 10)).toBe("0.0%");
    expect(formatPercent(5, 0)).toBe("0.0%");
  });
});

describe("day and month labels", () => {
  it("formats a day and a month key in plain English", () => {
    expect(formatDay("2026-12-05")).toBe("5 December");
    expect(formatDay("2027-01-05", true)).toBe("5 January 2027");
    expect(formatMonth("2026-11")).toBe("November 2026");
  });
});

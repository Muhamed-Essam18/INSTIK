import { describe, expect, it } from "vitest";
import {
  billing,
  billingReady,
  lookupKey,
  periodLabel,
  priceLabel,
  pricesAreSet,
  savingLabel,
  validateBilling,
  yearlySavingPercent,
  type BillingConfig,
} from "@/lib/billing/plans";

const config = (monthly: number | null, yearly: number | null): BillingConfig => ({
  ...billing,
  amounts: { monthly, yearly },
});
const real = config(900, 8100);

describe("placeholder state (today's config)", () => {
  it("ships as placeholders", () => {
    expect(pricesAreSet()).toBe(false);
    expect(() => validateBilling()).not.toThrow();
  });

  it("shows the design's placeholder labels", () => {
    expect(priceLabel("monthly")).toBe("[PRICE]");
    expect(priceLabel("yearly")).toBe("[PRICE]");
    expect(savingLabel()).toBe("[Save X%]");
  });
});

describe("validateBilling", () => {
  it("fails when only one amount is set, naming the field", () => {
    expect(() => validateBilling(config(900, null))).toThrow(/billing\.amounts\.yearly/);
    expect(() => validateBilling(config(null, 8100))).toThrow(/billing\.amounts\.monthly/);
  });

  it("fails for zero, negative and fractional amounts", () => {
    expect(() => validateBilling(config(0, 8100))).toThrow();
    expect(() => validateBilling(config(-900, 8100))).toThrow();
    expect(() => validateBilling(config(900.5, 8100))).toThrow();
  });

  it("fails when yearly is not cheaper than twelve months, or not above monthly", () => {
    expect(() => validateBilling(config(900, 10800))).toThrow(/less than 12/);
    expect(() => validateBilling(config(900, 900))).toThrow(/greater than/);
  });

  it("fails for a bad currency", () => {
    expect(() => validateBilling({ ...real, currency: "EUR" })).toThrow(/currency/);
  });

  it("accepts real amounts", () => {
    expect(() => validateBilling(real)).not.toThrow();
  });
});

describe("derived values", () => {
  it("calculates the yearly saving and rounds down", () => {
    expect(yearlySavingPercent(real)).toBe(25);
    expect(yearlySavingPercent(config(900, 8200))).toBe(24);
    expect(savingLabel(real)).toBe("Save 25%");
  });

  it("has no saving without real amounts", () => {
    expect(yearlySavingPercent(config(null, null))).toBeNull();
  });

  it("formats prices in the configured currency", () => {
    expect(priceLabel("monthly", real)).toBe("€9.00");
    expect(priceLabel("yearly", real)).toBe("€81.00");
    expect(priceLabel("monthly", { ...real, currency: "usd" })).toBe("$9.00");
  });

  it("labels the periods", () => {
    expect(periodLabel("monthly")).toBe("per month");
    expect(periodLabel("yearly")).toBe("per year");
  });

  it("changes the lookup key when the amount changes", () => {
    expect(lookupKey("monthly", real)).toBe("instik_full_monthly_eur_900");
    expect(lookupKey("monthly", config(1000, 8100))).not.toBe(lookupKey("monthly", real));
  });
});

describe("billingReady", () => {
  const keys = { STRIPE_SECRET_KEY: "sk_test_x", STRIPE_WEBHOOK_SECRET: "whsec_x" };
  it("is true only with real prices and both Stripe settings", () => {
    expect(billingReady(keys, real)).toBe(true);
  });
  it("is false for placeholders, or a missing key or secret", () => {
    expect(billingReady(keys)).toBe(false);
    expect(billingReady({ STRIPE_WEBHOOK_SECRET: "whsec_x" }, real)).toBe(false);
    expect(billingReady({ STRIPE_SECRET_KEY: "sk_test_x" }, real)).toBe(false);
    expect(billingReady({}, real)).toBe(false);
  });
});

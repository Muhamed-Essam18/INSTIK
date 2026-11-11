import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PricingSwitch } from "@/components/marketing/PricingSwitch";
import { billing } from "@/lib/billing/plans";

// The pricing page reads the one price config: placeholders as designed, real amounts once they are set.

const setup = () => render(<PricingSwitch free={<div>free plan</div>} fullCta={<a href="/x">Get full access</a>} />);
const original = { ...billing.amounts };

beforeEach(() => {
  billing.amounts.monthly = original.monthly;
  billing.amounts.yearly = original.yearly;
});
afterEach(() => {
  cleanup();
  billing.amounts.monthly = original.monthly;
  billing.amounts.yearly = original.yearly;
});

describe("placeholder amounts", () => {
  it("show [PRICE] for both periods and [Save X%] on Yearly, as in the design", () => {
    setup();
    expect(screen.getByText("[PRICE]")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Yearly" }));
    expect(screen.getByText("[PRICE]")).toBeTruthy();
    expect(screen.getByText("per year")).toBeTruthy();
    expect(screen.getByText("[Save X%]")).toBeTruthy();
  });
});

describe("real amounts", () => {
  beforeEach(() => {
    billing.amounts.monthly = 900;
    billing.amounts.yearly = 8100;
  });

  it("show the formatted monthly price and no saving on Monthly", () => {
    setup();
    expect(screen.getByText("€9.00")).toBeTruthy();
    expect(screen.getByText("per month")).toBeTruthy();
    expect(screen.queryByText(/Save/)).toBeNull();
    expect(screen.queryByText("[PRICE]")).toBeNull();
  });

  it("show the formatted yearly price and the calculated saving on Yearly", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Yearly" }));
    expect(screen.getByText("€81.00")).toBeTruthy();
    expect(screen.getByText("per year")).toBeTruthy();
    expect(screen.getByText("Save 25%")).toBeTruthy();
    expect(screen.queryByText("[Save X%]")).toBeNull();
  });

  it("follow a change in the config with no other edit", () => {
    billing.amounts.monthly = 1000;
    billing.amounts.yearly = 9000;
    setup();
    expect(screen.getByText("€10.00")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Yearly" }));
    expect(screen.getByText("€90.00")).toBeTruthy();
    expect(screen.getByText("Save 25%")).toBeTruthy();
  });
});

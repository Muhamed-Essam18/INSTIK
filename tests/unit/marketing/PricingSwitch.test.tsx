import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PricingSwitch } from "@/components/marketing/PricingSwitch";

afterEach(cleanup);

const setup = () =>
  render(<PricingSwitch free={<div>free plan</div>} fullCta={<a href="/onboarding">Get full access</a>} />);

describe("PricingSwitch", () => {
  it("starts on Monthly", () => {
    setup();
    expect(screen.getByRole("button", { name: "Monthly" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Yearly" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByText("per month")).toBeTruthy();
    expect(screen.queryByText("[Save X%]")).toBeNull();
  });
  it("switches to Yearly and back", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Yearly" }));
    expect(screen.getByRole("button", { name: "Yearly" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("per year")).toBeTruthy();
    expect(screen.getByText("[Save X%]")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Monthly" }));
    expect(screen.getByText("per month")).toBeTruthy();
  });
  it("shows only placeholder prices and keeps both plans and the button", () => {
    setup();
    expect(screen.getByText("[PRICE]")).toBeTruthy();
    expect(screen.getByText("free plan")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Get full access" }).getAttribute("href")).toBe("/onboarding");
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
  });
  it("uses real buttons, so the keyboard works", () => {
    setup();
    expect(screen.getAllByRole("button").every((b) => b.tagName === "BUTTON")).toBe(true);
  });
});

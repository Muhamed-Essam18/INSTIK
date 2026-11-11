import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FullAccessAction } from "@/components/billing/FullAccessAction";
import { PricingSwitch } from "@/components/marketing/PricingSwitch";

afterEach(cleanup);

const setup = () => render(<PricingSwitch free={<div>free plan</div>} fullCta={<FullAccessAction />} />);

describe("FullAccessAction on the pricing page", () => {
  it("links to checkout for the monthly period by default", () => {
    setup();
    expect(screen.getByRole("link", { name: "Get full access" }).getAttribute("href")).toBe("/billing/start?period=monthly");
  });

  it("follows the switch to yearly and back", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Yearly" }));
    expect(screen.getByRole("link", { name: "Get full access" }).getAttribute("href")).toBe("/billing/start?period=yearly");
    fireEvent.click(screen.getByRole("button", { name: "Monthly" }));
    expect(screen.getByRole("link", { name: "Get full access" }).getAttribute("href")).toBe("/billing/start?period=monthly");
  });

  it("is a plain anchor, so it works without scripts and is never prefetched", () => {
    setup();
    const link = screen.getByRole("link", { name: "Get full access" });
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("data-prefetch")).toBeNull();
  });

  it("defaults to monthly outside the switch", () => {
    render(<FullAccessAction />);
    expect(screen.getByRole("link", { name: "Get full access" }).getAttribute("href")).toBe("/billing/start?period=monthly");
  });
});

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PlanSection } from "@/components/billing/PlanSection";
import type { SubscriptionStatus } from "@/lib/billing/access";

afterEach(cleanup);

const now = new Date("2026-03-01T12:00:00Z");
const row = (
  status: SubscriptionStatus,
  over: { cancelAtPeriodEnd?: boolean; end?: string; plan?: "MONTHLY" | "YEARLY" } = {},
) => ({
  status,
  plan: over.plan ?? ("MONTHLY" as const),
  cancelAtPeriodEnd: over.cancelAtPeriodEnd ?? false,
  currentPeriodEnd: new Date(over.end ?? "2026-03-14T10:00:00Z"),
});
const show = (
  subscription: ReturnType<typeof row> | null,
  extra: { timeZone?: string; billingOn?: boolean; canSwitchPlan?: boolean } = {},
) =>
  render(
    <PlanSection
      subscription={subscription}
      billingOn={extra.billingOn ?? true}
      canSwitchPlan={extra.canSwitchPlan}
      timeZone={extra.timeZone}
      now={now}
    />,
  );

const planLine = () => screen.getByText((_, el) => el?.tagName === "P" && (el.textContent ?? "").startsWith("Full access ·"));

const SWITCH = "Changing between monthly and yearly takes effect when your current period ends.";

describe("Free (never subscribed)", () => {
  it("says so, reassures about hours and links to pricing", () => {
    show(null);
    expect(screen.getByText(/You.re on/).textContent).toContain("Your hours and roadmap are exactly as you left them.");
    expect(screen.getByRole("link", { name: "See Full access" }).getAttribute("href")).toBe("/pricing");
    expect(screen.queryByRole("link", { name: "Cancel subscription" })).toBeNull();
    expect(screen.queryByText(SWITCH)).toBeNull();
  });
});

describe("active", () => {
  it("shows the plan, period, price placeholder and renewal date", () => {
    show(row("ACTIVE"));
    expect(planLine().textContent).toContain("Monthly");
    expect(planLine().textContent).toContain("[PRICE] per month");
    expect(screen.getByText("Renews on 14 March 2026.")).toBeTruthy();
  });

  it("shows the yearly period", () => {
    show(row("ACTIVE", { plan: "YEARLY" }));
    expect(planLine().textContent).toContain("Yearly");
    expect(planLine().textContent).toContain("per year");
  });

  it("says when a plan switch takes effect only once learners can switch (tasks.md T074)", () => {
    show(row("ACTIVE"));
    expect(screen.queryByText(SWITCH)).toBeNull();
    cleanup();
    show(row("ACTIVE"), { canSwitchPlan: true });
    expect(screen.getByText(SWITCH)).toBeTruthy();
  });

  it("links to manage payment details and to cancel", () => {
    show(row("ACTIVE"), { canSwitchPlan: true });
    expect(screen.getByRole("link", { name: "Manage payment and invoices" }).getAttribute("href")).toBe("/billing/portal");
    expect(screen.getByRole("link", { name: "Cancel subscription" }).getAttribute("href")).toBe("/billing/portal?flow=cancel");
    expect(screen.getByText(SWITCH)).toBeTruthy();
  });

  it("shows the date in the learner's time zone", () => {
    show(row("ACTIVE", { end: "2026-03-13T23:30:00Z" }), { timeZone: "Africa/Cairo" });
    expect(screen.getByText("Renews on 14 March 2026.")).toBeTruthy();
  });
});

describe("cancelled before the period end", () => {
  it("says access lasts until the date and offers Resume, not Cancel", () => {
    show(row("ACTIVE", { cancelAtPeriodEnd: true }));
    expect(screen.getByText("Full access until 14 March 2026. Your hours stay with you.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Resume" }).getAttribute("href")).toBe("/billing/portal");
    expect(screen.queryByRole("link", { name: "Cancel subscription" })).toBeNull();
    expect(screen.queryByText(SWITCH)).toBeNull();
  });
});

describe("past due", () => {
  it("is kind, says access continues, and links to update the card", () => {
    show(row("PAST_DUE", { end: "2026-02-27T10:00:00Z" }));
    expect(
      screen.getByText(
        "We couldn't take your last payment. You still have access while we try again. You can update your card any time.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Update payment details" }).getAttribute("href")).toBe("/billing/portal");
    expect(screen.queryByRole("link", { name: "Cancel subscription" })).toBeNull();
  });
});

describe("ended", () => {
  it("is Free again with the reassurance and a link to pricing", () => {
    show(row("CANCELED"));
    expect(screen.getByText(/You.re on/).textContent).toContain("exactly as you left them");
    expect(screen.getByRole("link", { name: "See Full access" }).getAttribute("href")).toBe("/pricing");
    expect(screen.queryByRole("link", { name: "Resume" })).toBeNull();
  });

  it("is also Free when the safety net has passed", () => {
    show(row("ACTIVE", { end: "2026-02-01T00:00:00Z" }));
    expect(screen.getByRole("link", { name: "See Full access" })).toBeTruthy();
  });
});

describe("billing off", () => {
  it("still shows the state and the date but no links to Stripe", () => {
    show(row("ACTIVE"), { billingOn: false });
    expect(screen.getByText("Renews on 14 March 2026.")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Cancel subscription" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Manage payment and invoices" })).toBeNull();
  });
  it("hides Resume too", () => {
    show(row("ACTIVE", { cancelAtPeriodEnd: true }), { billingOn: false });
    expect(screen.getByText(/Full access until/)).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Resume" })).toBeNull();
  });
});

describe("tone", () => {
  it.each([null, row("ACTIVE"), row("ACTIVE", { cancelAtPeriodEnd: true }), row("PAST_DUE", { end: "2026-02-27T10:00:00Z" }), row("CANCELED")])(
    "has no pop-up, countdown or urgency",
    (subscription) => {
      const { container } = show(subscription);
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(container.querySelector("[aria-modal]")).toBeNull();
      expect(container.textContent ?? "").not.toMatch(/hurry|last chance|limited|expires soon|don.t miss|only \d+ (days|hours) left|countdown/i);
      cleanup();
    },
  );
});

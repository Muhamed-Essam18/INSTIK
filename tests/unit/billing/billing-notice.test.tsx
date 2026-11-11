import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BillingNotice } from "@/components/billing/BillingNotice";
import { router, searchParams } from "../../helpers/next-navigation";

vi.mock("next/navigation", () => import("../../helpers/next-navigation"));

const at = (query: string) => {
  searchParams.value = new URLSearchParams(query);
};

beforeEach(() => {
  vi.useFakeTimers();
  router.refresh.mockClear();
  at("");
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("pricing notices", () => {
  it("says no payment was taken after a cancelled checkout", () => {
    at("checkout=cancelled");
    render(<BillingNotice />);
    expect(screen.getByText("No payment was taken. You can try again whenever you like.")).toBeTruthy();
  });

  it("says kindly that the payment page could not be reached", () => {
    at("checkout=unavailable");
    render(<BillingNotice />);
    expect(screen.getByText("We couldn't reach the payment page. Please try again in a moment.")).toBeTruthy();
  });

  it("says nothing for an unknown value, or none", () => {
    at("checkout=whatever");
    const { container, rerender } = render(<BillingNotice />);
    expect(container.textContent).toBe("");
    at("billing=whatever");
    rerender(<BillingNotice />);
    expect(container.textContent).toBe("");
    at("");
    rerender(<BillingNotice />);
    expect(container.textContent).toBe("");
  });
});

describe("settings notices", () => {
  it("welcomes a new subscriber", () => {
    at("billing=success");
    render(<BillingNotice />);
    expect(screen.getByText("You have Full access. Enjoy every video.")).toBeTruthy();
  });

  it("says kindly that the payment page could not be reached from settings", () => {
    at("billing=unavailable");
    render(<BillingNotice />);
    expect(screen.getByText("We couldn't reach the payment page. Please try again in a moment.")).toBeTruthy();
  });

  it("announces politely, as a status, never as an alert or a dialog", () => {
    at("billing=success");
    render(<BillingNotice />);
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("pending", () => {
  it("shows the setting-up line and looks again every 2 seconds", () => {
    at("billing=pending");
    render(<BillingNotice />);
    expect(screen.getByText("Setting things up. This usually takes a few seconds.")).toBeTruthy();
    expect(router.refresh).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(2000));
    expect(router.refresh).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(4000));
    expect(router.refresh).toHaveBeenCalledTimes(3);
  });

  it("stops after 30 seconds and says it is taking longer", () => {
    at("billing=pending");
    render(<BillingNotice />);
    act(() => vi.advanceTimersByTime(30_000));
    expect(
      screen.getByText("This is taking a little longer than usual. You will have access as soon as the payment clears."),
    ).toBeTruthy();
    const calls = router.refresh.mock.calls.length;
    act(() => vi.advanceTimersByTime(20_000));
    expect(router.refresh.mock.calls.length).toBe(calls);
  });

  it("stops looking when the notice goes away (the server moved the page on to success)", () => {
    at("billing=pending");
    const { rerender } = render(<BillingNotice />);
    act(() => vi.advanceTimersByTime(2000));
    expect(router.refresh).toHaveBeenCalledTimes(1);
    at("billing=success");
    rerender(<BillingNotice />);
    const calls = router.refresh.mock.calls.length;
    act(() => vi.advanceTimersByTime(10_000));
    expect(router.refresh.mock.calls.length).toBe(calls);
    expect(screen.getByText("You have Full access. Enjoy every video.")).toBeTruthy();
  });
});

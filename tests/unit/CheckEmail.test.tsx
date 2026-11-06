import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requestEmailLink: vi.fn() }));
vi.mock("@/lib/auth/actions", () => ({ requestEmailLink: mocks.requestEmailLink }));

import { ResendLink } from "@/components/onboarding/ResendLink";
import CheckEmailPage from "@/app/(shell)/sign-in/check-email/page";

beforeEach(() => {
  vi.useFakeTimers();
  mocks.requestEmailLink.mockReset();
  window.sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const remember = () =>
  window.sessionStorage.setItem(
    "instik:v1:last-email",
    JSON.stringify({ email: "amal@example.com", returnTo: "/settings" }),
  );

describe("Check your email page", () => {
  it("says the same thing for every address and mentions nothing about accounts", () => {
    render(<CheckEmailPage />);
    expect(screen.getByRole("heading", { name: "Check your email" })).toBeTruthy();
    expect(screen.getByText("We've sent a sign-in link. It works once and lasts an hour.")).toBeTruthy();
  });
});

describe("ResendLink", () => {
  it("is disabled for 30 seconds, then sends again with the remembered address", async () => {
    remember();
    mocks.requestEmailLink.mockResolvedValue({ ok: true });
    render(<ResendLink />);
    const button = screen.getByRole("button", { name: "Send it again" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toMatch(/in 30 seconds/);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(button.disabled).toBe(false);

    await act(async () => {
      fireEvent.click(button);
    });
    expect(mocks.requestEmailLink).toHaveBeenCalledWith({ email: "amal@example.com", returnTo: "/settings" });
    expect(screen.getByRole("status").textContent).toMatch(/Sent again/);
    expect(button.disabled).toBe(true);
  });

  it("shows the kind message when the limit is reached", async () => {
    remember();
    mocks.requestEmailLink.mockResolvedValue({ ok: false, code: "too-many" });
    render(<ResendLink />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send it again" }));
    });
    expect(screen.getByRole("status").textContent).toBe("Please wait a little before asking again.");
  });

  it("falls back to a link to sign in when no address is remembered", () => {
    render(<ResendLink />);
    expect(screen.queryByRole("button", { name: "Send it again" })).toBeNull();
    expect(screen.getByRole("link", { name: "Back to sign in" }).getAttribute("href")).toBe("/sign-in");
  });
});

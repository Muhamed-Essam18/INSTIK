import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requestEmailLink: vi.fn(),
  signInWithGoogle: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/lib/auth/actions", () => ({
  requestEmailLink: mocks.requestEmailLink,
  signInWithGoogle: mocks.signInWithGoogle,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));

import { SignInForm } from "@/components/onboarding/SignInForm";

beforeEach(() => {
  mocks.requestEmailLink.mockReset();
  mocks.signInWithGoogle.mockReset();
  mocks.push.mockReset();
  window.sessionStorage.clear();
});
afterEach(cleanup);

const type = (value: string) => fireEvent.change(screen.getByLabelText("Email"), { target: { value } });

describe("SignInForm", () => {
  it("shows Google, an email field and the no-password line", () => {
    render(<SignInForm />);
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeTruthy();
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByText("We'll send you a sign-in link. No password to remember.")).toBeTruthy();
  });

  it("has no password field", () => {
    const { container } = render(<SignInForm />);
    expect(container.querySelector('input[type="password"]')).toBeNull();
    expect(container.textContent?.toLowerCase().replace("no password to remember", "")).not.toContain("password");
  });

  it("shows a message next to the field for an invalid address and calls nothing", async () => {
    render(<SignInForm />);
    type("not-an-email");
    fireEvent.click(screen.getByRole("button", { name: "Send me a link" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/doesn't look like an email/);
    expect(screen.getByLabelText("Email").getAttribute("aria-invalid")).toBe("true");
    expect(mocks.requestEmailLink).not.toHaveBeenCalled();
  });

  it("sends a link for a valid address, remembers it for this tab and moves on", async () => {
    mocks.requestEmailLink.mockResolvedValue({ ok: true });
    render(<SignInForm returnTo="/learn/arabic-egyptian/watch/at-the-cafe" />);
    type("  Amal@Example.com ");
    fireEvent.click(screen.getByRole("button", { name: "Send me a link" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/sign-in/check-email"));
    expect(mocks.requestEmailLink).toHaveBeenCalledWith({
      email: "amal@example.com",
      returnTo: "/learn/arabic-egyptian/watch/at-the-cafe",
    });
    expect(JSON.parse(window.sessionStorage.getItem("instik:v1:last-email")!).email).toBe("amal@example.com");
  });

  it("shows a kind message when asked too often", async () => {
    mocks.requestEmailLink.mockResolvedValue({ ok: false, code: "too-many" });
    render(<SignInForm />);
    type("amal@example.com");
    fireEvent.click(screen.getByRole("button", { name: "Send me a link" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Please wait a little before asking again.");
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("disables the buttons while sending", async () => {
    let finish: (v: { ok: true }) => void = () => {};
    mocks.requestEmailLink.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    render(<SignInForm />);
    type("amal@example.com");
    fireEvent.click(screen.getByRole("button", { name: "Send me a link" }));
    const sending = await screen.findByRole("button", { name: "Sending…" });
    expect((sending as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Continue with Google" }) as HTMLButtonElement).disabled).toBe(true);
    finish({ ok: true });
    await waitFor(() => expect(mocks.push).toHaveBeenCalled());
  });

  it("starts Google sign-in with the return address", () => {
    mocks.signInWithGoogle.mockResolvedValue(undefined);
    render(<SignInForm returnTo="/settings" />);
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    expect(mocks.signInWithGoogle).toHaveBeenCalledWith({ returnTo: "/settings" });
  });

  it("shows a kind message when Google fails", async () => {
    mocks.signInWithGoogle.mockRejectedValue(new Error("boom"));
    render(<SignInForm />);
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/couldn't sign you in with Google/);
  });
});

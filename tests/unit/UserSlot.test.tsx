import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getLearner: vi.fn() }));
vi.mock("@/lib/session", () => ({ getLearner: mocks.getLearner }));
vi.mock("@/lib/learner/preference-actions", () => ({ importDevicePreferences: vi.fn() }));
vi.mock("@/lib/auth/actions", () => ({ signOutAction: vi.fn() }));

import { UserSlot, initialFor } from "@/components/shell/UserSlot";

afterEach(cleanup);

describe("initialFor", () => {
  it("uses the first letter of the name, upper-cased", () => {
    expect(initialFor({ name: "amal", email: "x@example.com" })).toBe("A");
    expect(initialFor({ name: "  Mona Ali ", email: "x@example.com" })).toBe("M");
  });

  it("falls back to the email when there is no name", () => {
    expect(initialFor({ name: null, email: "zaid@example.com" })).toBe("Z");
    expect(initialFor({ name: "  ", email: "zaid@example.com" })).toBe("Z");
  });

  it("handles a name that starts with a non-Latin letter", () => {
    expect(initialFor({ name: "منى", email: "x@example.com" })).toBe("م");
  });
});

describe("UserSlot", () => {
  it("shows the account button for a learner", async () => {
    mocks.getLearner.mockResolvedValue({ id: "u1", email: "amal@example.com", name: "Amal", image: null });
    render(await UserSlot());
    expect(screen.getByRole("button", { name: "Your account" }).textContent).toBe("A");
    expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
  });

  it("shows a Sign in link and no account button when signed out", async () => {
    mocks.getLearner.mockResolvedValue(null);
    render(await UserSlot());
    const link = screen.getByRole("link", { name: "Sign in" });
    expect(link.getAttribute("href")).toBe("/sign-in");
    expect(link.className).toContain("min-h-11");
    expect(screen.queryByRole("button", { name: "Your account" })).toBeNull();
  });
});

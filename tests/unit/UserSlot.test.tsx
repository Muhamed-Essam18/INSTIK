import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getLearner: vi.fn(), getActor: vi.fn() }));
vi.mock("@/lib/session", () => ({ getLearner: mocks.getLearner, getActor: mocks.getActor }));
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
  const learner = { id: "u1", email: "amal@example.com", name: "Amal", image: null };
  const actor = (role: "learner" | "creator" | "owner") => ({ id: "u1", email: "amal@example.com", name: "Amal", role });
  const menuLabels = async () => {
    render(await UserSlot());
    fireEvent.click(screen.getByRole("button", { name: "Your account" }));
    const labels = screen.getAllByRole("menuitem").map((i) => i.textContent);
    cleanup();
    return labels;
  };

  it("shows the account button for a learner", async () => {
    mocks.getLearner.mockResolvedValue(learner);
    mocks.getActor.mockResolvedValue(actor("learner"));
    render(await UserSlot());
    expect(screen.getByRole("button", { name: "Your account" }).textContent).toBe("A");
    expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
  });

  it("adds no panel entry for a learner, the Creator panel for a creator and the Owner panel for an owner", async () => {
    mocks.getLearner.mockResolvedValue(learner);
    mocks.getActor.mockResolvedValue(actor("learner"));
    expect(await menuLabels()).toEqual(["Settings", "Sign out"]);
    mocks.getActor.mockResolvedValue(actor("creator"));
    expect(await menuLabels()).toEqual(["Creator panel", "Settings", "Sign out"]);
    mocks.getActor.mockResolvedValue(actor("owner"));
    expect(await menuLabels()).toEqual(["Owner panel", "Settings", "Sign out"]);
  });

  it("reads the role again on every render: a role that changes shows at the next page", async () => {
    mocks.getLearner.mockResolvedValue(learner);
    mocks.getActor.mockReset().mockResolvedValueOnce(actor("owner")).mockResolvedValueOnce(actor("learner"));
    expect(await menuLabels()).toEqual(["Owner panel", "Settings", "Sign out"]);
    expect(await menuLabels()).toEqual(["Settings", "Sign out"]);
    expect(mocks.getActor).toHaveBeenCalledTimes(2);
  });

  it("still shows the account menu, without a panel entry, when the role cannot be read", async () => {
    mocks.getLearner.mockResolvedValue(learner);
    mocks.getActor.mockRejectedValue(new Error("database unavailable"));
    expect(await menuLabels()).toEqual(["Settings", "Sign out"]);
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

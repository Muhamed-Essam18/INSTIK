import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The invitation page: one calm message for every unusable link, and nothing changes until the invited account presses Accept.

const mocks = vi.hoisted(() => ({
  preview: vi.fn(),
  getActor: vi.fn(),
  accept: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("@/lib/invites/instance", () => ({ inviteService: () => ({ previewInvite: mocks.preview }) }));
vi.mock("@/lib/session", () => ({ getActor: mocks.getActor }));
vi.mock("@/lib/invites/actions", () => ({ acceptInvite: mocks.accept }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  useRouter: () => ({ replace: mocks.replace, refresh: () => {}, push: () => {} }),
}));

import { InviteScreen } from "@/components/screens/InviteScreen";

const token = "A".repeat(43);
const renderPage = async () => render(await InviteScreen({ params: Promise.resolve({ token }) }));
const actor = (role: "learner" | "creator" | "owner", email = "mona@example.com") => ({ id: "u1", email, name: "Mona", role });

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.preview.mockResolvedValue({ ok: true, name: "Mona Ali", email: "mona@example.com" });
  mocks.getActor.mockResolvedValue(actor("learner"));
});
afterEach(cleanup);

describe("an unusable link", () => {
  it("gives one calm message and no detail, whether signed in or not", async () => {
    mocks.preview.mockResolvedValue({ ok: false });
    for (const who of [null, actor("learner")]) {
      mocks.getActor.mockResolvedValue(who);
      cleanup();
      await renderPage();
      expect(screen.getByText("This invitation can't be used. Ask the Instik team for a new one.")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Accept" })).toBeNull();
    }
  });
});

describe("a valid link", () => {
  it("sends a signed-out visitor to sign in and back to the invitation", async () => {
    mocks.getActor.mockResolvedValue(null);
    await expect(renderPage()).rejects.toThrow(`REDIRECT:/sign-in?returnTo=${encodeURIComponent(`/invite/${token}`)}`);
  });

  it("explains that the address is wrong without naming the invited address", async () => {
    mocks.getActor.mockResolvedValue(actor("learner", "someone@else.com"));
    const { container } = await renderPage();
    expect(screen.getByText(/sent to a different email address/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Accept" })).toBeNull();
    expect(container.innerHTML).not.toContain("mona@example.com");
  });

  it("says nothing needs doing for an account that is already a creator or an owner", async () => {
    for (const role of ["creator", "owner"] as const) {
      mocks.getActor.mockResolvedValue(actor(role));
      cleanup();
      await renderPage();
      expect(screen.getByText("Nothing needs doing: this account already has access.")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Accept" })).toBeNull();
      expect(screen.getByRole("link").getAttribute("href")).toBe(role === "owner" ? "/owner" : "/creator");
    }
  });

  it("shows the invited name and an Accept button for the invited account, and accepting goes to the creator area", async () => {
    mocks.accept.mockResolvedValue({ ok: true });
    await renderPage();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Welcome, Mona Ali");
    expect(mocks.accept).not.toHaveBeenCalled(); // opening the page changes nothing
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/creator"));
    expect(mocks.accept).toHaveBeenCalledWith(token);
  });

  it("shows the refusal when accepting fails", async () => {
    mocks.accept.mockResolvedValue({ ok: false, message: "This invitation can't be used. Ask the Instik team for a new one." });
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/can't be used/);
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("matches the invited address without regard to case", async () => {
    mocks.getActor.mockResolvedValue(actor("learner", "Mona@Example.COM"));
    await renderPage();
    expect(screen.getByRole("button", { name: "Accept" })).toBeTruthy();
  });
});

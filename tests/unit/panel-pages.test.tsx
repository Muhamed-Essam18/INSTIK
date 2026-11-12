import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The creator and owner areas with the real role gates: only the right role gets the page, everyone else is turned away.

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findUnique: vi.fn(),
  listInvites: vi.fn(),
  ownerEmails: "boss@instik.test",
}));

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ db: () => ({ user: { findUnique: mocks.findUnique } }) }));
vi.mock("@/lib/env", () => ({ env: () => ({ OWNER_EMAILS: mocks.ownerEmails }) }));
vi.mock("@/lib/invites/instance", () => ({ inviteService: () => ({ listInvites: mocks.listInvites }) }));
vi.mock("@/lib/invites/actions", () => ({ createInvite: vi.fn(), revokeInvite: vi.fn(), acceptInvite: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
}));
vi.mock("react", async (importOriginal) => ({ ...(await importOriginal<typeof import("react")>()), cache: <T,>(fn: T) => fn }));

import { CreatorScreen } from "@/components/screens/CreatorScreen";
import { OwnerCreatorsScreen } from "@/components/screens/OwnerCreatorsScreen";
import { OwnerScreen } from "@/components/screens/OwnerScreen";

type Who = "signed-out" | "learner" | "creator" | "owner";
function as(who: Who) {
  if (who === "signed-out") return mocks.auth.mockResolvedValue(null);
  const email = who === "owner" ? "boss@instik.test" : `${who}@x.com`;
  mocks.auth.mockResolvedValue({ user: { id: "u1", email, name: "Sam", image: null } });
  mocks.findUnique.mockResolvedValue({ role: who === "creator" ? "CREATOR" : "LEARNER" });
}

beforeEach(() => {
  Object.values(mocks).forEach((m) => typeof m === "function" && m.mockReset());
  mocks.listInvites.mockResolvedValue([]);
});
afterEach(cleanup);

describe.each([
  ["the creator area", CreatorScreen, "creator", "/creator"],
  ["the owner area", OwnerScreen, "owner", "/owner"],
  ["the invite page for owners", OwnerCreatorsScreen, "owner", "/owner/creators"],
] as const)("%s", (_name, Screen, allowed, path) => {
  it("is empty and addressed to the right role", async () => {
    as(allowed);
    render(await Screen());
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/Hello, Sam|Creators/);
  });

  it("sends a signed-out visitor to sign in and back", async () => {
    as("signed-out");
    await expect(Screen()).rejects.toThrow(`REDIRECT:/sign-in?returnTo=${encodeURIComponent(path)}`);
  });

  it.each((["learner", "creator", "owner"] as const).filter((w) => w !== allowed))("turns away a %s with a not-found page", async (who) => {
    as(who);
    await expect(Screen()).rejects.toThrow("NOT_FOUND");
  });
});

describe("what the pages show", () => {
  it("shows nothing but an empty note on the creator and owner homes, and never reads videos or invitations", async () => {
    as("creator");
    render(await CreatorScreen());
    expect(screen.getByText(/Nothing here yet/)).toBeTruthy();
    cleanup();
    as("owner");
    render(await OwnerScreen());
    expect(screen.getByText(/Nothing here yet/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Creators and invitations" }).getAttribute("href")).toBe("/owner/creators");
    expect(mocks.listInvites).not.toHaveBeenCalled();
  });

  it("shows the invite form and the invitations to an owner", async () => {
    as("owner");
    const future = new Date("2026-11-18T10:00:00Z");
    mocks.listInvites.mockResolvedValue([
      { id: "i1", name: "Mona", email: "mona@example.com", state: "pending", createdAt: new Date("2026-11-11T10:00:00Z"), expiresAt: future },
      { id: "i2", name: "Old", email: "old@example.com", state: "used", createdAt: new Date("2026-11-01T10:00:00Z"), expiresAt: future },
    ]);
    const { container } = render(await OwnerCreatorsScreen());
    expect(screen.getByLabelText("Name")).toBeTruthy();
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send invitation" })).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Pending")).toBeTruthy();
    expect(screen.getByText("Used")).toBeTruthy();
    // Only a pending invitation can be revoked, and no link or token is ever shown.
    expect(screen.getAllByRole("button", { name: /Revoke the invitation/ })).toHaveLength(1);
    expect(container.innerHTML).not.toMatch(/\/invite\//);
  });
});

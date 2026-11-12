import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const order = vi.hoisted(() => [] as string[]);
const mocks = vi.hoisted(() => ({
  signOutAction: vi.fn(),
  clearDraft: vi.fn(),
  clearDeviceChoices: vi.fn(),
}));

vi.mock("@/lib/auth/actions", () => ({ signOutAction: mocks.signOutAction }));
vi.mock("@/lib/onboarding/draft-storage", () => ({ clearDraft: mocks.clearDraft }));
vi.mock("@/lib/player/device-import", () => ({ clearDeviceChoices: mocks.clearDeviceChoices }));

import { AccountButton } from "@/components/shell/AccountButton";

beforeEach(() => {
  order.length = 0;
  mocks.signOutAction.mockReset().mockImplementation(async () => void order.push("signOut"));
  mocks.clearDraft.mockReset().mockImplementation(() => void order.push("clearDraft"));
  mocks.clearDeviceChoices.mockReset().mockImplementation(() => void order.push("clearDeviceChoices"));
});
afterEach(cleanup);

const button = () => screen.getByRole("button", { name: "Your account" });
const open = () => fireEvent.click(button());

describe("AccountButton", () => {
  it("shows the initial and starts closed", () => {
    render(<AccountButton initial="A" />);
    expect(button().textContent).toBe("A");
    expect(button().getAttribute("aria-haspopup")).toBe("menu");
    expect(button().getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("opens a menu with exactly Settings and Sign out", () => {
    render(<AccountButton initial="A" />);
    open();
    expect(button().getAttribute("aria-expanded")).toBe("true");
    const items = screen.getAllByRole("menuitem");
    expect(items.map((i) => i.textContent)).toEqual(["Settings", "Sign out"]);
    expect(screen.getByRole("menuitem", { name: "Settings" }).getAttribute("href")).toBe("/settings");
  });

  it("puts the role's panel entries first, before Settings and Sign out", () => {
    render(<AccountButton initial="A" panels={[{ label: "Creator panel", href: "/creator" }]} />);
    open();
    const items = screen.getAllByRole("menuitem");
    expect(items.map((i) => i.textContent)).toEqual(["Creator panel", "Settings", "Sign out"]);
    expect(screen.getByRole("menuitem", { name: "Creator panel" }).getAttribute("href")).toBe("/creator");
  });

  it("focuses the first item when it opens and moves with the arrow keys, Home and End", () => {
    render(<AccountButton initial="A" />);
    open();
    const [settings, signOut] = screen.getAllByRole("menuitem");
    expect(document.activeElement).toBe(settings);
    fireEvent.keyDown(settings, { key: "ArrowDown" });
    expect(document.activeElement).toBe(signOut);
    fireEvent.keyDown(signOut, { key: "ArrowDown" });
    expect(document.activeElement).toBe(settings);
    fireEvent.keyDown(settings, { key: "ArrowUp" });
    expect(document.activeElement).toBe(signOut);
    fireEvent.keyDown(signOut, { key: "Home" });
    expect(document.activeElement).toBe(settings);
    fireEvent.keyDown(settings, { key: "End" });
    expect(document.activeElement).toBe(signOut);
  });

  it("closes on Escape and returns focus to the button", () => {
    render(<AccountButton initial="A" />);
    open();
    fireEvent.keyDown(screen.getAllByRole("menuitem")[0], { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(button());
  });

  it("closes on an outside click and when tabbing out", () => {
    render(
      <div>
        <AccountButton initial="A" />
        <p>elsewhere</p>
      </div>,
    );
    open();
    fireEvent.mouseDown(screen.getByText("elsewhere"));
    expect(screen.queryByRole("menu")).toBeNull();
    open();
    fireEvent.keyDown(screen.getAllByRole("menuitem")[0], { key: "Tab" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("gives every item at least 44px of height", () => {
    render(<AccountButton initial="A" />);
    open();
    for (const item of screen.getAllByRole("menuitem")) expect(item.className).toContain("min-h-11");
  });

  it("clears the draft and the device choices before signing out, in that order", async () => {
    render(<AccountButton initial="A" />);
    open();
    fireEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
    await waitFor(() => expect(order).toEqual(["clearDraft", "clearDeviceChoices", "signOut"]));
  });

  it("still signs out when clearing the device throws", async () => {
    mocks.clearDraft.mockImplementation(() => {
      throw new Error("storage blocked");
    });
    render(<AccountButton initial="A" />);
    open();
    fireEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
    await waitFor(() => expect(mocks.signOutAction).toHaveBeenCalled());
  });
});

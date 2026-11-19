import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { account, setupGrants } from "../../helpers/grants-memory";

// The owner's Access page (spec 11 User Story 5): a form, the grants now, and the history.

const mocks = vi.hoisted(() => ({ service: undefined as unknown, refresh: vi.fn(), grantAccess: vi.fn(), removeAccess: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/lib/session", () => ({ requireOwner: async () => ({ id: "boss", email: "boss@x.com", name: "Boss", role: "owner" }) }));
vi.mock("@/lib/grants/instance", () => ({ grantsService: () => mocks.service }));
vi.mock("@/lib/grants/actions", () => ({ grantAccess: mocks.grantAccess, removeAccess: mocks.removeAccess }));

import { OwnerAccessScreen } from "@/components/screens/OwnerAccessScreen";

const owner = { id: "boss", email: "boss@x.com", name: "Boss", role: "owner" } as const;

async function show(prepare?: (t: ReturnType<typeof setupGrants>) => Promise<void>) {
  const t = setupGrants({ accounts: [account("mona"), account("sami")] });
  await prepare?.(t);
  mocks.service = t.service;
  render(await OwnerAccessScreen());
  return t;
}

beforeEach(() => {
  mocks.refresh.mockClear();
  mocks.grantAccess.mockReset();
  mocks.removeAccess.mockReset();
});
afterEach(cleanup);

describe("the form", () => {
  it("has a labelled email, a reason, a note and a button, and sends what was typed", async () => {
    mocks.grantAccess.mockResolvedValue({ ok: true, message: "mona@example.com now has Full access." });
    await show();
    const form = screen.getByRole("form", { name: "Give Full access" });
    expect(within(form).getByLabelText("Email of the account")).toBeTruthy();
    expect((within(form).getByLabelText("Why") as HTMLSelectElement).options.length).toBe(4);
    expect(within(form).getByLabelText(/Note/)).toBeTruthy();

    fireEvent.change(within(form).getByLabelText("Email of the account"), { target: { value: "mona@example.com" } });
    fireEvent.change(within(form).getByLabelText("Why"), { target: { value: "GIFT" } });
    fireEvent.change(within(form).getByLabelText(/Note/), { target: { value: "For the workshop" } });
    fireEvent.click(within(form).getByRole("button", { name: "Give Full access" }));
    await waitFor(() => expect(mocks.grantAccess).toHaveBeenCalledWith({ email: "mona@example.com", reason: "GIFT", note: "For the workshop" }));
    expect(await screen.findByText("mona@example.com now has Full access.")).toBeTruthy();
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("shows the calm message when no account has that email", async () => {
    mocks.grantAccess.mockResolvedValue({ ok: false, message: "No account with that email yet. They need to sign in once first." });
    await show();
    fireEvent.click(screen.getByRole("button", { name: "Give Full access" }));
    expect((await screen.findByRole("alert")).textContent).toBe("No account with that email yet. They need to sign in once first.");
  });

  it("makes every control a 44px target", async () => {
    await show();
    const form = screen.getByRole("form", { name: "Give Full access" });
    for (const el of [...within(form).getAllByRole("button"), ...within(form).getAllByRole("textbox"), within(form).getByRole("combobox")]) expect(el.className).toContain("min-h-11");
  });
});

describe("the grants and the history", () => {
  it("shows nobody and no changes before anything has happened", async () => {
    await show();
    expect(screen.getByText("Nobody has Full access from you right now.")).toBeTruthy();
    expect(screen.getByText("No changes yet.")).toBeTruthy();
  });

  it("shows who has access with the reason and note, and every change with who and when", async () => {
    await show(async (t) => {
      await t.service.grantAccess(owner, { email: "mona@example.com", reason: "GIFT", note: "For the workshop" });
      t.clock.now = new Date("2026-11-20T10:00:00Z");
      await t.service.grantAccess(owner, { email: "sami@example.com", reason: "TESTING" });
      t.clock.now = new Date("2026-11-21T10:00:00Z");
      await t.service.removeAccess(owner, { email: "sami@example.com", note: "Done" });
    });
    const active = within(screen.getByRole("region", { name: "Full access from you" }));
    expect(active.getByText("mona@example.com")).toBeTruthy();
    expect(active.getByText(/Gift · since 18 November 2026/)).toBeTruthy();
    expect(active.getByText(/For the workshop/)).toBeTruthy();
    expect(active.queryByText("sami@example.com")).toBeNull();

    const history = within(screen.getByRole("region", { name: "Recent changes" }));
    const items = history.getAllByRole("listitem").map((li) => li.textContent);
    expect(items[0]).toMatch(/^Removed: sami@example.com.*Testing · 21 November 2026.*Done/);
    expect(items[1]).toMatch(/^Given: sami@example.com.*Testing · 20 November 2026/);
    expect(items[2]).toMatch(/^Given: mona@example.com.*Gift · 18 November 2026.*For the workshop/);
  });

  it("removes a grant after asking for an optional note", async () => {
    mocks.removeAccess.mockResolvedValue({ ok: true, message: "Full access from you was removed for mona@example.com." });
    await show(async (t) => void (await t.service.grantAccess(owner, { email: "mona@example.com", reason: "GIFT" })));
    fireEvent.click(screen.getByRole("button", { name: "Remove Full access for mona@example.com" }));
    const form = screen.getByRole("form", { name: "Remove Full access for mona@example.com" });
    fireEvent.change(within(form).getByLabelText(/Note/), { target: { value: "No longer needed" } });
    fireEvent.click(within(form).getByRole("button", { name: "Remove Full access" }));
    await waitFor(() => expect(mocks.removeAccess).toHaveBeenCalledWith({ email: "mona@example.com", note: "No longer needed" }));
  });

  it("says when the history has more than the latest 100 changes", async () => {
    await show(async (t) => {
      for (let i = 0; i < 101; i += 1) t.state.events.push({ id: `e${i}`, userId: "mona", kind: "GRANTED", reason: "OTHER", note: null, byId: "boss", at: new Date(Date.UTC(2026, 0, 1, 0, i)) });
    });
    expect(screen.getByText("Showing the latest 100 changes.")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Recent changes" })).getAllByRole("listitem")).toHaveLength(100);
  });
});

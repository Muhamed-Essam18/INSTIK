import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { creatorViews, owner, setupEarnings } from "../../helpers/earnings-memory";

// The owner's Earnings page (spec 11 User Story 2, FR-024; docs/design/OwnerEarnings.dc.html).

const mocks = vi.hoisted(() => ({
  service: undefined as unknown,
  refresh: vi.fn(),
  push: vi.fn(),
  saveRevenue: vi.fn(),
  closeMonth: vi.fn(),
  markPaid: vi.fn(),
  reversePayout: vi.fn(),
  addAdjustment: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh, push: mocks.push }) }));
vi.mock("@/lib/session", () => ({ requireOwner: async () => owner }));
vi.mock("@/lib/earnings/instance", () => ({ earningsService: () => mocks.service }));
vi.mock("@/lib/earnings/actions", () => ({
  saveRevenue: mocks.saveRevenue,
  closeMonth: mocks.closeMonth,
  markPaid: mocks.markPaid,
  reversePayout: mocks.reversePayout,
  addAdjustment: mocks.addAdjustment,
}));

import { OwnerEarningsScreen } from "@/components/screens/OwnerEarningsScreen";

const october = [creatorViews("omar", 3_680, 1, "Omar"), creatorViews("salma", 2_300, 2, "Salma"), creatorViews("nour", 1_840, 3, "Nour"), creatorViews("karim", 1_380, 4, "Karim")];

async function show(setup: Parameters<typeof setupEarnings>[0], month = "2026-10") {
  const t = setupEarnings(setup);
  mocks.service = t.service;
  render(await OwnerEarningsScreen({ month }));
  return t;
}

beforeEach(() => {
  mocks.refresh.mockClear();
  mocks.push.mockClear();
  mocks.saveRevenue.mockReset();
  mocks.closeMonth.mockReset();
  mocks.markPaid.mockReset();
  mocks.reversePayout.mockReset();
  mocks.addAdjustment.mockReset();
});
afterEach(cleanup);

describe("a month with revenue and counted views", () => {
  it("shows gross to net, the 80/20 split, the total views and four creator rows with shares and euros", async () => {
    await show({ now: "2026-10-20T10:00:00Z", revenue: { "2026-10": {} }, views: { "2026-10": october } });
    const statement = within(screen.getByRole("region", { name: /October 2026/ }));
    expect(statement.getByText("Estimated")).toBeTruthy();
    expect(statement.getByText("€3,000.00")).toBeTruthy();
    expect(statement.getByText("−€561.00")).toBeTruthy();
    expect(statement.getByText("−€96.00")).toBeTruthy();
    expect(statement.getByText("−€43.00")).toBeTruthy();
    expect(statement.getByText("€2,300.00")).toBeTruthy();
    expect(statement.getByText("€1,840.00")).toBeTruthy();
    expect(statement.getByText("€460.00")).toBeTruthy();
    expect(statement.getByText(/9,200 counted views in October/)).toBeTruthy();

    const rows = screen.getAllByRole("row").slice(1);
    expect(rows.map((r) => within(r).getAllByRole("cell").map((c) => c.textContent))).toEqual([
      ["3,680", "40.0%", "€736.00", "—"],
      ["2,300", "25.0%", "€460.00", "—"],
      ["1,840", "20.0%", "€368.00", "—"],
      ["1,380", "15.0%", "€276.00", "—"],
    ]);
  });

  it("explains how leftover cents are shared out", async () => {
    await show({ now: "2026-10-20T10:00:00Z", revenue: { "2026-10": {} }, views: { "2026-10": october } });
    expect(screen.getByText(/the extra cents go to the creators with the largest remainders/)).toBeTruthy();
  });
});

describe("a month with no revenue entered", () => {
  it("says so, shows counted views and no euro amounts", async () => {
    await show({ now: "2026-10-20T10:00:00Z", views: { "2026-10": october } });
    expect(screen.getByText("Revenue for this month hasn't been entered yet.")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/€\d/);
    expect(screen.getByText(/9,200 counted views/)).toBeTruthy();
    expect(screen.getAllByRole("row").slice(1)).toHaveLength(4);
  });
});

describe("a month where deductions equal the gross revenue", () => {
  it("shows net 0.00 with the explanation and nobody earning anything", async () => {
    await show({ now: "2026-10-20T10:00:00Z", revenue: { "2026-10": { grossCents: 10_000, vatCents: 8_000, feesCents: 1_500, refundsCents: 1_500 } }, views: { "2026-10": [creatorViews("a", 5, 1, "Ann")] } });
    expect(screen.getByText("Net revenue is €0.00 this month because VAT, fees and refunds are as much as the gross revenue. Nobody earns this month.")).toBeTruthy();
    const row = screen.getAllByRole("row")[1];
    expect(within(row).getAllByRole("cell")[2].textContent).toBe("€0.00");
  });
});

describe("a month with no counted views", () => {
  it("says nobody earns anything", async () => {
    await show({ now: "2026-10-20T10:00:00Z", revenue: { "2026-10": {} } });
    expect(screen.getByText("No counted views this month, so nobody earns anything.")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });
});

describe("the revenue form", () => {
  it("shows the saved figures as plain euros and posts the text with the version it loaded", async () => {
    mocks.saveRevenue.mockResolvedValue({ ok: true, version: 2 });
    await show({ now: "2026-10-20T10:00:00Z", revenue: { "2026-10": { version: 1 } } });
    const form = screen.getByRole("form", { name: "Revenue for this month" });
    expect((within(form).getByLabelText("Subscription revenue (gross)") as HTMLInputElement).value).toBe("3000.00");
    expect((within(form).getByLabelText("VAT collected") as HTMLInputElement).value).toBe("561.00");
    fireEvent.change(within(form).getByLabelText("Payment fees"), { target: { value: "100.50" } });
    fireEvent.click(within(form).getByRole("button", { name: "Save figures" }));
    await waitFor(() => expect(mocks.saveRevenue).toHaveBeenCalledTimes(1));
    expect(mocks.saveRevenue).toHaveBeenCalledWith({ month: "2026-10", expectedVersion: 1, gross: "3000.00", vat: "561.00", fees: "100.50", refunds: "43.00" });
    expect(await screen.findByText("Saved.")).toBeTruthy();
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("starts empty with version 0 when nothing has been entered", async () => {
    mocks.saveRevenue.mockResolvedValue({ ok: true, version: 1 });
    await show({ now: "2026-10-20T10:00:00Z" });
    const form = screen.getByRole("form", { name: "Revenue for this month" });
    expect((within(form).getByLabelText("Refunds") as HTMLInputElement).value).toBe("");
    for (const label of ["Subscription revenue (gross)", "VAT collected", "Payment fees", "Refunds"]) fireEvent.change(within(form).getByLabelText(label), { target: { value: "0" } });
    fireEvent.click(within(form).getByRole("button", { name: "Save figures" }));
    await waitFor(() => expect(mocks.saveRevenue).toHaveBeenCalledWith(expect.objectContaining({ expectedVersion: 0 })));
  });

  it("shows the reload message when another owner saved first", async () => {
    mocks.saveRevenue.mockResolvedValue({ ok: false, message: "Figures changed. Reload to see them." });
    await show({ now: "2026-10-20T10:00:00Z", revenue: { "2026-10": {} } });
    fireEvent.click(screen.getByRole("button", { name: "Save figures" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Figures changed. Reload to see them.");
  });

  it("makes every control a 44px target", async () => {
    await show({ now: "2026-10-20T10:00:00Z", revenue: { "2026-10": {} } });
    for (const el of [...screen.getAllByRole("button"), ...screen.getAllByRole("textbox"), screen.getByRole("combobox")]) expect(el.className).toContain("min-h-11");
  });
});

describe("the month picker", () => {
  it("lists the months with their status and opens the chosen one", async () => {
    await show({ now: "2026-11-10T10:00:00Z", revenue: { "2026-10": {} } });
    const select = screen.getByRole("combobox", { name: "Month" }) as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent)).toEqual(["November 2026 · open", "October 2026 · open"]);
    fireEvent.change(select, { target: { value: "2026-11" } });
    expect(mocks.push).toHaveBeenCalledWith("/owner/earnings?month=2026-11");
  });
});

describe("privacy and wording", () => {
  it("shows only creator names and counts: no email, no learner and no earnings of anyone but the creators listed", async () => {
    await show({ now: "2026-10-20T10:00:00Z", revenue: { "2026-10": {} }, views: { "2026-10": october } });
    expect(document.body.textContent).not.toMatch(/@/);
  });
});

const closedSetup = { now: "2026-11-05T09:00:00Z", revenue: { "2026-10": {} }, views: { "2026-10": october } };

async function showClosed(payFirst: string[] = []) {
  const t = setupEarnings(closedSetup);
  await t.service.closeMonth(owner, "2026-10");
  for (const creatorId of payFirst) await t.service.markPaid(owner, { month: "2026-10", creatorId, reference: "TR-" + creatorId });
  mocks.service = t.service;
  render(await OwnerEarningsScreen({ month: "2026-10" }));
  return t;
}

describe("closing a month", () => {
  it("offers Close for an ended month with revenue, asks a calm confirmation and closes once confirmed", async () => {
    mocks.closeMonth.mockResolvedValue({ ok: true, alreadyClosed: false });
    await show({ now: "2026-11-03T10:00:00Z", revenue: { "2026-10": {} }, views: { "2026-10": october } });
    fireEvent.click(screen.getByRole("button", { name: "Close October 2026" }));
    expect(screen.getByText("Close October 2026? This locks its numbers. Corrections go in as adjustments in the next open month.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close month" }));
    await waitFor(() => expect(mocks.closeMonth).toHaveBeenCalledWith({ month: "2026-10" }));
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("is disabled, with the reason beside it, before the month has ended", async () => {
    await show({ now: "2026-10-20T10:00:00Z", revenue: { "2026-10": {} } });
    const button = screen.getByRole("button", { name: "Close October 2026" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByText("You can close this month once it has ended.")).toBeTruthy();
  });

  it("is disabled until revenue has been entered", async () => {
    await show({ now: "2026-11-03T10:00:00Z" });
    expect((screen.getByRole("button", { name: "Close October 2026" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Enter this month's revenue first.")).toBeTruthy();
  });
});

describe("a closed month", () => {
  it("shows Final, no revenue form, the closed note, paid and unpaid creators and the history", async () => {
    await showClosed(["salma"]);

    expect(screen.getByText("Final")).toBeTruthy();
    expect(screen.queryByRole("form", { name: "Revenue for this month" })).toBeNull();
    expect(screen.getByText(/Closed on 5 November 2026/)).toBeTruthy();

    const rows = screen.getAllByRole("row").slice(1);
    expect(rows.map((r) => within(r).getByRole("rowheader").textContent)).toEqual(["Omar", "Salma", "Nour", "Karim"]);
    expect(within(rows[1]).getByText("Paid")).toBeTruthy();
    expect(within(rows[1]).getByText("Paid 5 Nov")).toBeTruthy();
    expect(within(rows[0]).getByText("Unpaid")).toBeTruthy();
    expect(within(rows[0]).getByRole("button", { name: "Mark Omar as paid" })).toBeTruthy();
    expect(within(rows[1]).queryByRole("button", { name: /Mark Salma as paid/ })).toBeNull();
    expect(screen.getAllByRole("button", { name: /^Mark .* as paid$/ })).toHaveLength(3);

    const history = within(screen.getByRole("region", { name: "Payment history" }));
    expect(history.getByText(/Paid: Salma, €460.00/)).toBeTruthy();
    expect(history.getByText(/TR-salma/)).toBeTruthy();
    expect(history.getByRole("button", { name: "Undo the payment to Salma" })).toBeTruthy();
  });

  it("marks a creator as paid with a reference, never an amount", async () => {
    mocks.markPaid.mockResolvedValue({ ok: true });
    await showClosed();
    fireEvent.click(screen.getByRole("button", { name: "Mark Nour as paid" }));
    const form = screen.getByRole("form", { name: "Mark Nour as paid" });
    expect(within(form).queryByLabelText(/amount/i)).toBeNull();
    fireEvent.change(within(form).getByLabelText(/Reference/), { target: { value: "TR-NOUR" } });
    fireEvent.click(within(form).getByRole("button", { name: "Save payment" }));
    await waitFor(() => expect(mocks.markPaid).toHaveBeenCalledWith({ month: "2026-10", creatorId: "nour", reference: "TR-NOUR" }));
  });

  it("undoes a payment with a reason", async () => {
    mocks.reversePayout.mockResolvedValue({ ok: true });
    await showClosed(["omar"]);
    fireEvent.click(screen.getByRole("button", { name: "Undo the payment to Omar" }));
    const form = screen.getByRole("form", { name: "Undo the payment to Omar" });
    fireEvent.change(within(form).getByLabelText(/Why/), { target: { value: "Wrong account" } });
    fireEvent.click(within(form).getByRole("button", { name: "Undo payment" }));
    await waitFor(() => expect(mocks.reversePayout).toHaveBeenCalledWith(expect.objectContaining({ creatorId: "omar", reason: "Wrong account" })));
  });

  it("makes every control a 44px target", async () => {
    await showClosed(["omar"]);
    for (const button of screen.getAllByRole("button")) expect(button.className).toContain("min-h-11");
  });
});

describe("adjustments", () => {
  it("lists the adjustments already in an open month and adds a signed one with a note", async () => {
    mocks.addAdjustment.mockResolvedValue({ ok: true });
    const t = setupEarnings({ now: "2026-11-10T10:00:00Z", revenue: { "2026-11": {} } });
    await t.service.addAdjustment(owner, { month: "2026-11", amountCents: -4_300, note: "Late refund for October" });
    mocks.service = t.service;
    render(await OwnerEarningsScreen({ month: "2026-11" }));

    const list = within(screen.getByRole("list", { name: "Adjustments in this month" }));
    expect(list.getByText("Late refund for October")).toBeTruthy();
    expect(list.getByText("−€43.00")).toBeTruthy();

    const form = screen.getByRole("form", { name: "Add an adjustment" });
    fireEvent.change(within(form).getByLabelText(/Amount in euros/), { target: { value: "-12.50" } });
    fireEvent.change(within(form).getByLabelText(/Note/), { target: { value: "Refund for September" } });
    fireEvent.click(within(form).getByRole("button", { name: "Add adjustment" }));
    await waitFor(() => expect(mocks.addAdjustment).toHaveBeenCalledWith({ month: "2026-11", amount: "-12.50", note: "Refund for September" }));
  });

  it("is not offered for a closed month", async () => {
    await showClosed();
    expect(screen.queryByRole("form", { name: "Add an adjustment" })).toBeNull();
  });
});

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupRequests } from "../../helpers/requests-memory";

// The owner's Requests page (spec 11 User Story 6): a form, and every request with Edit and Close for the open ones.

const mocks = vi.hoisted(() => ({ service: undefined as unknown, refresh: vi.fn(), createRequest: vi.fn(), editRequest: vi.fn(), closeRequest: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/lib/session", () => ({ requireOwner: async () => ({ id: "boss", email: "boss@x.com", name: "Boss", role: "owner" }) }));
vi.mock("@/lib/requests/instance", () => ({ requestsService: () => mocks.service }));
vi.mock("@/lib/requests/actions", () => ({ createRequest: mocks.createRequest, editRequest: mocks.editRequest, closeRequest: mocks.closeRequest }));

import { OwnerRequestsScreen } from "@/components/screens/OwnerRequestsScreen";

const owner = { id: "boss", email: "boss@x.com", name: "Boss", role: "owner" } as const;

async function show(prepare?: (t: ReturnType<typeof setupRequests>) => Promise<void>) {
  const t = setupRequests();
  await prepare?.(t);
  mocks.service = t.service;
  render(await OwnerRequestsScreen());
  return t;
}

beforeEach(() => {
  mocks.refresh.mockClear();
  mocks.createRequest.mockReset();
  mocks.editRequest.mockReset();
  mocks.closeRequest.mockReset();
});
afterEach(cleanup);

describe("the form", () => {
  it("has labelled stage, topic and text fields and sends what was chosen", async () => {
    mocks.createRequest.mockResolvedValue({ ok: true, message: "Request posted. Every creator can see it now." });
    await show();
    const form = screen.getByRole("form", { name: "Write a request" });
    expect((within(form).getByLabelText("Stage") as HTMLSelectElement).options).toHaveLength(5); // a prompt and four stages
    expect((within(form).getByLabelText("Topic") as HTMLSelectElement).options).toHaveLength(6); // a prompt and five topics
    fireEvent.change(within(form).getByLabelText("Stage"), { target: { value: "follow-it" } });
    fireEvent.change(within(form).getByLabelText("Topic"), { target: { value: "food" } });
    fireEvent.change(within(form).getByLabelText(/What would help learners/), { target: { value: "Cooking at home." } });
    fireEvent.click(within(form).getByRole("button", { name: "Post request" }));
    await waitFor(() => expect(mocks.createRequest).toHaveBeenCalledWith({ stage: "follow-it", topic: "food", text: "Cooking at home." }));
    expect(await screen.findByText("Request posted. Every creator can see it now.")).toBeTruthy();
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("limits the text to 200 characters and says so", async () => {
    await show();
    expect((screen.getByLabelText(/What would help learners/) as HTMLInputElement).maxLength).toBe(200);
    expect(screen.getByText(/up to 200 characters/)).toBeTruthy();
  });

  it("shows the plain message when a request is not accepted", async () => {
    mocks.createRequest.mockResolvedValue({ ok: false, message: "Write a sentence or two about the video you would like." });
    await show();
    fireEvent.click(screen.getByRole("button", { name: "Post request" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Write a sentence or two about the video you would like.");
  });

  it("makes every control a 44px target", async () => {
    await show();
    const form = screen.getByRole("form", { name: "Write a request" });
    for (const el of [...within(form).getAllByRole("button"), ...within(form).getAllByRole("combobox"), ...within(form).getAllByRole("textbox")]) expect(el.className).toContain("min-h-11");
  });
});

describe("the list", () => {
  it("says there are no requests yet", async () => {
    await show();
    expect(screen.getByText(/No requests yet/)).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows every request with its status, closed ones dimmed and without actions", async () => {
    await show(async (t) => {
      t.clock.now = new Date("2026-11-10T10:00:00Z");
      await t.service.createRequest(owner, { stage: "follow-it", topic: "food", text: "Cooking at home." });
      t.clock.now = new Date("2026-11-11T10:00:00Z");
      await t.service.createRequest(owner, { stage: "hear-it", topic: "family", text: "Introducing your family." });
      await t.service.closeRequest(owner, { id: t.state.rows[0].id });
    });
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows.map((r) => within(r).getAllByRole("cell").slice(0, 4).map((c) => c.textContent))).toEqual([
      ["Hear it", "Family", "Introducing your family.", "Open"],
      ["Follow it", "Food", "Cooking at home.", "Closed"],
    ]);
    expect(within(rows[0]).getByRole("button", { name: "Close the request: Introducing your family." })).toBeTruthy();
    expect(within(rows[1]).queryByRole("button")).toBeNull();
    expect(rows[1].className).toContain("opacity-60");
  });

  it("closes an open request", async () => {
    mocks.closeRequest.mockResolvedValue({ ok: true, message: "Request closed. Creators no longer see it." });
    const t = await show(async (s) => void (await s.service.createRequest(owner, { stage: "follow-it", topic: "food", text: "Cooking at home." })));
    fireEvent.click(screen.getByRole("button", { name: "Close the request: Cooking at home." }));
    await waitFor(() => expect(mocks.closeRequest).toHaveBeenCalledWith({ id: t.state.rows[0].id }));
  });

  it("edits an open request in place", async () => {
    mocks.editRequest.mockResolvedValue({ ok: true, message: "Request updated." });
    const t = await show(async (s) => void (await s.service.createRequest(owner, { stage: "follow-it", topic: "food", text: "Cooking at home." })));
    fireEvent.click(screen.getByRole("button", { name: "Edit the request: Cooking at home." }));
    const form = screen.getByRole("form", { name: "Edit request" });
    fireEvent.change(within(form).getByLabelText("Request"), { target: { value: "Street food." } });
    fireEvent.change(within(form).getByLabelText("Stage"), { target: { value: "hear-it" } });
    fireEvent.click(within(form).getByRole("button", { name: "Save request" }));
    await waitFor(() => expect(mocks.editRequest).toHaveBeenCalledWith({ id: t.state.rows[0].id, stage: "hear-it", topic: "food", text: "Street food." }));
  });
});

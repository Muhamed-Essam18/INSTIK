import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AddTimeDialog } from "@/components/roadmap/AddTimeDialog";
import { AddedTimeList, formatEntryDay } from "@/components/roadmap/AddedTimeList";
import { hoursStore } from "@/lib/hours/store";
import { router } from "../../helpers/next-navigation";

const actions = vi.hoisted(() => ({ add: vi.fn(), remove: vi.fn() }));
vi.mock("@/lib/hours/actions", () => ({ addManualTime: actions.add, removeManualTime: actions.remove }));
vi.mock("next/navigation", () => import("../../helpers/next-navigation"));

beforeEach(() => {
  actions.add.mockReset();
  actions.remove.mockReset();
  router.refresh.mockClear();
  hoursStore.reset();
});
afterEach(cleanup);

const openDialog = () => fireEvent.click(screen.getByRole("button", { name: "Add time outside Instik" }));
const fill = (minutes: string, day?: string) => {
  fireEvent.change(screen.getByLabelText("Minutes"), { target: { value: minutes } });
  if (day) fireEvent.change(screen.getByLabelText("Date"), { target: { value: day } });
};
const submit = () => fireEvent.click(screen.getByRole("button", { name: "Add time" }));

describe("AddTimeDialog", () => {
  it("adds time, updates the pill's total and refreshes the page", async () => {
    actions.add.mockResolvedValue({ ok: true, totalSeconds: 7200, stage: "HEAR_IT" });
    render(<AddTimeDialog languageCode="arz" today="2026-11-11" />);
    openDialog();
    fill("45", "2026-11-10");
    await act(async () => submit());
    expect(actions.add).toHaveBeenCalledWith(expect.objectContaining({ languageCode: "arz", minutes: 45, day: "2026-11-10" }));
    expect(hoursStore.getSnapshot().arz).toBe(7200);
    expect(router.refresh).toHaveBeenCalled();
  });

  it("says it will show as added by the learner", () => {
    render(<AddTimeDialog languageCode="arz" today="2026-11-11" />);
    openDialog();
    expect(screen.getByText("It will show as added by you.")).toBeTruthy();
  });

  it("defaults the date to today and limits it to today", () => {
    render(<AddTimeDialog languageCode="arz" today="2026-11-11" />);
    openDialog();
    const date = screen.getByLabelText("Date") as HTMLInputElement;
    expect(date.value).toBe("2026-11-11");
    expect(date.max).toBe("2026-11-11");
  });

  it.each([
    ["invalid-minutes", "Enter a whole number of minutes, from 1 to 600.", "Minutes"],
    ["invalid-date", "Pick today or an earlier date from the last year.", "Date"],
  ])("shows the %s message next to its field and links it", async (code, message, label) => {
    actions.add.mockResolvedValue({ ok: false, code });
    render(<AddTimeDialog languageCode="arz" today="2026-11-11" />);
    openDialog();
    fill("0");
    await act(async () => submit());
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(message);
    expect(screen.getByLabelText(label).getAttribute("aria-describedby")).toBe(alert.id);
    expect(screen.getByLabelText(label).getAttribute("aria-invalid")).toBe("true");
    expect(hoursStore.getSnapshot().arz).toBeUndefined();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("sends empty minutes as invalid, not as zero", async () => {
    actions.add.mockResolvedValue({ ok: false, code: "invalid-minutes" });
    render(<AddTimeDialog languageCode="arz" today="2026-11-11" />);
    openDialog();
    await act(async () => submit());
    expect(Number.isNaN(actions.add.mock.calls[0][0].minutes)).toBe(true);
  });

  it("shows a quiet note when saving fails", async () => {
    actions.add.mockRejectedValue(new Error("offline"));
    render(<AddTimeDialog languageCode="arz" today="2026-11-11" />);
    openDialog();
    fill("30");
    await act(async () => submit());
    expect((await screen.findByRole("alert")).textContent).toContain("Couldn't save that just now");
  });

  it("is labelled and keyboard friendly: named dialog, labelled fields, 44px buttons", () => {
    render(<AddTimeDialog languageCode="arz" today="2026-11-11" />);
    openDialog();
    const dialog = document.querySelector("dialog")!;
    expect(dialog.getAttribute("aria-labelledby")).toBeTruthy();
    expect(document.getElementById(dialog.getAttribute("aria-labelledby")!)?.textContent).toBe("Add time outside Instik");
    expect(screen.getByLabelText("Minutes")).toBeTruthy();
    expect(screen.getByLabelText("Date")).toBeTruthy();
    for (const name of ["Cancel", "Add time"]) {
      expect(screen.getByRole("button", { name }).className).toContain("min-h-11");
    }
  });

  it("closes with Cancel and returns focus to the opening button", () => {
    render(<AddTimeDialog languageCode="arz" today="2026-11-11" />);
    openDialog();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Add time outside Instik" }));
  });
});

describe("AddedTimeList", () => {
  const entries = [
    { id: "a", day: "2026-11-10", minutes: 45 },
    { id: "b", day: "2026-11-03", minutes: 30 },
  ];

  it("shows nothing without entries", () => {
    const { container } = render(<AddedTimeList languageCode="arz" entries={[]} />);
    expect(container.textContent).toBe("");
  });

  it("lists each entry with its date, minutes and the label Added by you", () => {
    render(<AddedTimeList languageCode="arz" entries={entries} />);
    expect(screen.getAllByText("Added by you")).toHaveLength(2);
    expect(screen.getByText(`${formatEntryDay("2026-11-10")} · 45 min`)).toBeTruthy();
  });

  it("names each remove button with the date and minutes", () => {
    render(<AddedTimeList languageCode="arz" entries={entries} />);
    expect(screen.getByRole("button", { name: `Remove 45 minutes added on ${formatEntryDay("2026-11-10")}` })).toBeTruthy();
    for (const button of screen.getAllByRole("button")) expect(button.className).toContain("min-h-11");
  });

  it("removes an entry, updates the total and refreshes", async () => {
    actions.remove.mockResolvedValue({ ok: true, totalSeconds: 600, languageCode: "arz" });
    render(<AddedTimeList languageCode="arz" entries={entries} />);
    await act(async () => fireEvent.click(screen.getAllByRole("button", { name: /^Remove/ })[0]));
    expect(actions.remove).toHaveBeenCalledWith({ id: "a" });
    await waitFor(() => expect(hoursStore.getSnapshot().arz).toBe(600));
    expect(router.refresh).toHaveBeenCalled();
  });

  it("says so quietly when a removal fails", async () => {
    actions.remove.mockResolvedValue({ ok: false, code: "not-found" });
    render(<AddedTimeList languageCode="arz" entries={entries} />);
    await act(async () => fireEvent.click(screen.getAllByRole("button", { name: /^Remove/ })[0]));
    expect((await screen.findByRole("status")).textContent).toContain("Couldn't remove that just now");
  });
});

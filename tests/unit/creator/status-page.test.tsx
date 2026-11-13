import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeleteDraft } from "@/components/creator/DeleteDraft";
import { HistoryList } from "@/components/creator/HistoryList";
import { VersionUpload } from "@/components/creator/VersionUpload";
import type { StatusHistoryEntry } from "@/lib/content/creator-reads";
import { dateTime, historyItems, historyLabel } from "@/lib/creator/list";

const nav = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => nav }));

const actions = vi.hoisted(() => ({ createUpload: vi.fn(), submitVideo: vi.fn(), deleteDraft: vi.fn() }));
vi.mock("@/lib/creator/actions", () => actions);

vi.mock("@mux/upchunk", () => ({ createUpload: vi.fn(() => ({ abort: vi.fn(), on: vi.fn() })) }));

beforeEach(() => {
  nav.push.mockReset();
  nav.refresh.mockReset();
  actions.createUpload.mockReset();
  actions.submitVideo.mockReset();
  actions.deleteDraft.mockReset();
});
afterEach(cleanup);

const entry = (extra: Partial<StatusHistoryEntry> & Pick<StatusHistoryEntry, "toStatus" | "createdAt">): StatusHistoryEntry => ({
  fromStatus: null,
  actorLabel: "someone",
  byYou: false,
  note: null,
  ...extra,
});

describe("the history", () => {
  const entries: StatusHistoryEntry[] = [
    entry({ fromStatus: "DRAFT", toStatus: "UPLOADING", byYou: true, createdAt: new Date("2026-11-09T18:30:00Z") }),
    entry({ fromStatus: "UPLOADING", toStatus: "PROCESSING", createdAt: new Date("2026-11-09T18:40:00Z") }),
    entry({ fromStatus: "PROCESSING", toStatus: "IN_REVIEW", byYou: true, createdAt: new Date("2026-11-09T18:44:00Z") }),
    entry({
      fromStatus: "IN_REVIEW",
      toStatus: "CHANGES_REQUESTED",
      actorLabel: "Mohamed",
      note: "The audio is quiet from 2:10 to 3:40 because of the street noise.",
      createdAt: new Date("2026-11-12T14:20:00Z"),
    }),
  ];

  it("lists every change newest first with when, who (You or Instik) and the note, in the creator's words", () => {
    const items = historyItems(entries);
    expect(items.map((i) => i.label)).toEqual(["Changes requested", "Submitted", "Processing", "Uploaded"]);
    expect(items.map((i) => i.by)).toEqual(["Instik", "You", "Instik", "You"]);
    expect(items[0]).toMatchObject({ when: "12 Nov, 14:20", note: "The audio is quiet from 2:10 to 3:40 because of the street noise." });
    expect(items[1].note).toBeNull();
    render(<HistoryList items={items} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getByText(/The audio is quiet/)).toBeTruthy();
    expect(screen.getAllByText(/· You/)).toHaveLength(2);
  });

  it("names the other moves plainly", () => {
    expect(historyLabel("PROCESSING", "DRAFT")).toBe("Back to draft");
    expect(historyLabel("UPLOADING", "DRAFT")).toBe("Back to draft");
    expect(historyLabel("IN_REVIEW", "APPROVED")).toBe("Approved and live");
    expect(historyLabel("IN_REVIEW", "REJECTED")).toBe("Rejected");
    expect(historyLabel("CHANGES_REQUESTED", "IN_REVIEW")).toBe("Submitted");
    expect(historyLabel(null, "DRAFT")).toBe("Draft started");
  });

  it("formats the time in UTC with a leading zero", () => {
    expect(dateTime(new Date("2026-11-09T09:05:00Z"))).toBe("9 Nov, 09:05");
  });

  it("says so when there is no history", () => {
    render(<HistoryList items={[]} />);
    expect(screen.getByText("Nothing has happened to this video yet.")).toBeTruthy();
  });
});

describe("VersionUpload", () => {
  const details = { title: "Metro", description: "A trip", proposedStage: "follow-it", topic: "daily-life" };
  const renderIt = (extra: Partial<Parameters<typeof VersionUpload>[0]> = {}) =>
    render(<VersionUpload videoId="v1" details={details} pendingLabel={null} failure={null} uploadsEnabled {...extra} />);
  const tickAll = () => screen.getAllByRole("checkbox").forEach((box) => fireEvent.click(box));

  it("shows where the new version is and why a failed one failed", () => {
    renderIt({ pendingLabel: "New version ready to submit", failure: "The new version didn't work. Please try again." });
    expect(screen.getByText("New version ready to submit")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe("The new version didn't work. Please try again.");
  });

  it("needs the checklist ticked again: submitting with it unticked shows the server's message and does not refresh", async () => {
    actions.submitVideo.mockResolvedValue({ ok: false, message: "A few things to finish first.", fields: { checklist: "Please tick every item in the list before you submit." } });
    renderIt();
    fireEvent.click(screen.getByRole("button", { name: "Submit for review" }));
    expect(await screen.findByText("Please tick every item in the list before you submit.")).toBeTruthy();
    expect(actions.submitVideo).toHaveBeenCalledWith({ videoId: "v1", details, checklist: [false, false, false, false, false] });
    expect(nav.refresh).not.toHaveBeenCalled();
  });

  it("submits the stored details with all five items ticked and refreshes the page", async () => {
    actions.submitVideo.mockResolvedValue({ ok: true, videoId: "v1", completed: true });
    renderIt();
    tickAll();
    fireEvent.click(screen.getByRole("button", { name: "Submit for review" }));
    await waitFor(() => expect(nav.refresh).toHaveBeenCalledTimes(1));
    expect(actions.submitVideo).toHaveBeenCalledWith({ videoId: "v1", details, checklist: [true, true, true, true, true] });
  });

  it("asks for a new-version link, never a first-upload link", async () => {
    actions.createUpload.mockResolvedValue({ ok: false, message: "This video can't be changed right now." });
    renderIt();
    const input = document.querySelector('input[type="file"]')!;
    const file = new File(["x"], "again.mp4", { type: "video/mp4" });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(actions.createUpload).toHaveBeenCalledWith({ videoId: "v1", kind: "newVersion" }));
    expect((await screen.findByRole("alert")).textContent).toBe("This video can't be changed right now.");
  });

  it("says uploads are not set up instead of showing a drop zone when Mux is missing", () => {
    renderIt({ uploadsEnabled: false });
    expect(screen.getByText(/Uploads aren't set up yet/)).toBeTruthy();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });
});

describe("DeleteDraft", () => {
  it("asks once in the page, then deletes and returns to My videos", async () => {
    actions.deleteDraft.mockResolvedValue({ ok: true });
    render(<DeleteDraft videoId="v1" />);
    expect(actions.deleteDraft).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Delete draft" }));
    expect(screen.getByText(/you can.t get it back/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Yes, delete it" }));
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith("/creator/videos"));
    expect(actions.deleteDraft).toHaveBeenCalledWith({ videoId: "v1" });
  });

  it("can be cancelled and deletes nothing", () => {
    render(<DeleteDraft videoId="v1" />);
    fireEvent.click(screen.getByRole("button", { name: "Delete draft" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep it" }));
    expect(screen.getByRole("button", { name: "Delete draft" })).toBeTruthy();
    expect(actions.deleteDraft).not.toHaveBeenCalled();
  });

  it("shows the plain message when the server says no", async () => {
    actions.deleteDraft.mockResolvedValue({ ok: false, message: "This video can't be changed right now." });
    render(<DeleteDraft videoId="v1" />);
    fireEvent.click(screen.getByRole("button", { name: "Delete draft" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, delete it" }));
    expect((await screen.findByRole("alert")).textContent).toBe("This video can't be changed right now.");
    expect(nav.push).not.toHaveBeenCalled();
  });
});

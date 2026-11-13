import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UploadForm } from "@/components/creator/UploadForm";

const nav = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => nav }));
const actions = vi.hoisted(() => ({ createUpload: vi.fn(), saveDraft: vi.fn(), submitVideo: vi.fn() }));
vi.mock("@/lib/creator/actions", () => actions);
const upchunk = vi.hoisted(() => {
  const handlers: Record<string, (e: { detail: unknown }) => void> = {};
  return {
    handlers,
    createUpload: vi.fn(() => ({ abort: vi.fn(), on: (name: string, fn: (e: { detail: unknown }) => void) => void (handlers[name] = fn) })),
  };
});
vi.mock("@mux/upchunk", () => ({ createUpload: upchunk.createUpload }));

beforeEach(() => {
  for (const fn of [nav.push, nav.refresh, ...Object.values(actions), upchunk.createUpload]) fn.mockClear();
  for (const fn of Object.values(actions)) fn.mockReset();
  for (const k of Object.keys(upchunk.handlers)) delete upchunk.handlers[k];
});
afterEach(cleanup);

const renderIt = (extra: Partial<Parameters<typeof UploadForm>[0]> = {}) =>
  render(<UploadForm fileStep="uploader" languageLabel="Egyptian Arabic" hostComplete uploadsEnabled {...extra} />);
const fill = () => {
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Visiting grandma on Friday" } });
  fireEvent.change(screen.getByLabelText("Stage"), { target: { value: "follow-it" } });
  fireEvent.change(screen.getByLabelText("Topic"), { target: { value: "family" } });
  fireEvent.change(screen.getByLabelText("Short description"), { target: { value: "We visit her." } });
};
const chooseFile = () =>
  fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [new File(["x"], "grandma.mp4", { type: "video/mp4" })] } });
const tickAll = () => screen.getAllByRole("checkbox").forEach((box) => fireEvent.click(box));
const submit = () => fireEvent.click(screen.getByRole("button", { name: "Submit for review" }));

describe("the upload form", () => {
  it("has the design's fields and the checklist, says Instik writes the transcript, and has no transcript field", () => {
    renderIt();
    for (const label of ["Title", "Stage", "Topic", "Language", "Short description"]) expect(screen.getByLabelText(label)).toBeTruthy();
    expect((screen.getByLabelText("Language") as HTMLInputElement).value).toBe("Egyptian Arabic");
    expect(screen.getAllByRole("checkbox")).toHaveLength(5);
    expect(screen.getByText(/You don't need a transcript/)).toBeTruthy();
    expect(screen.queryByLabelText(/transcript/i)).toBeNull();
    expect(screen.getByRole("button", { name: "Save draft" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Submit for review" })).toBeTruthy();
  });

  it("starts the upload as soon as a file is chosen, creating the draft with the details typed so far, and lets the details be typed meanwhile", async () => {
    actions.createUpload.mockResolvedValue({ ok: true, videoId: "v1", uploadUrl: "https://upload.example/1" });
    renderIt();
    fill();
    chooseFile();
    await waitFor(() => expect(upchunk.createUpload).toHaveBeenCalledTimes(1));
    expect(actions.createUpload).toHaveBeenCalledWith({
      kind: "first",
      details: { title: "Visiting grandma on Friday", description: "We visit her.", proposedStage: "follow-it", topic: "family" },
    });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Visiting grandma" } });
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Visiting grandma");
  });

  it("says the video is still uploading instead of submitting", async () => {
    actions.createUpload.mockResolvedValue({ ok: true, videoId: "v1", uploadUrl: "u" });
    renderIt();
    fill();
    chooseFile();
    await waitFor(() => expect(upchunk.createUpload).toHaveBeenCalled());
    tickAll();
    submit();
    expect(await screen.findByText(/still uploading/)).toBeTruthy();
    expect(actions.submitVideo).not.toHaveBeenCalled();
  });

  it("asks for a file first when there is none, without asking the server", () => {
    renderIt();
    fill();
    tickAll();
    submit();
    expect(screen.getByText("Add your video file first.")).toBeTruthy();
    expect(actions.submitVideo).not.toHaveBeenCalled();
  });

  it("submits once the upload is done, and goes to the video's page", async () => {
    actions.createUpload.mockResolvedValue({ ok: true, videoId: "v1", uploadUrl: "u" });
    actions.submitVideo.mockResolvedValue({ ok: true, videoId: "v1", completed: false });
    renderIt();
    fill();
    chooseFile();
    await waitFor(() => expect(upchunk.createUpload).toHaveBeenCalled());
    await waitFor(() => expect(upchunk.handlers.success).toBeTruthy());
    upchunk.handlers.success({ detail: undefined });
    tickAll();
    await waitFor(() => expect(screen.getByText(/Uploaded\. Processing now\./)).toBeTruthy());
    submit();
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith("/creator/videos/v1"));
    expect(actions.submitVideo).toHaveBeenCalledWith({
      videoId: "v1",
      details: { title: "Visiting grandma on Friday", description: "We visit her.", proposedStage: "follow-it", topic: "family" },
      checklist: [true, true, true, true, true],
    });
  });

  it("names what is missing from the server's answer, next to each field", async () => {
    actions.submitVideo.mockResolvedValue({
      ok: false,
      message: "A few things to finish first.",
      fields: { title: "Give your video a title.", checklist: "Please tick every item in the list before you submit." },
    });
    renderIt({ video: { id: "v1", title: "", description: null, proposedStage: null, topic: null }, fileStep: "in-flight" });
    submit();
    expect(await screen.findByText("Give your video a title.")).toBeTruthy();
    expect(screen.getByText("Please tick every item in the list before you submit.")).toBeTruthy();
    expect(screen.getByLabelText("Title").getAttribute("aria-invalid")).toBe("true");
  });

  it("saves a draft and goes to its page, and keeps the typed details when the upload fails", async () => {
    actions.saveDraft.mockResolvedValue({ ok: true, videoId: "v9" });
    renderIt();
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith("/creator/videos/v9"));
    expect(actions.saveDraft).toHaveBeenCalledWith({ details: { title: "Visiting grandma on Friday", description: "We visit her.", proposedStage: "follow-it", topic: "family" } });

    cleanup();
    actions.createUpload.mockResolvedValue({ ok: true, videoId: "v1", uploadUrl: "u" });
    renderIt();
    fill();
    chooseFile();
    await waitFor(() => expect(upchunk.handlers.error).toBeTruthy());
    upchunk.handlers.error({ detail: { message: "boom" } });
    expect((await screen.findByRole("alert")).textContent).toMatch(/Your details are safe/);
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Visiting grandma on Friday");
  });

  it("stays on the page and says so when a draft is saved while the upload is still going", async () => {
    actions.createUpload.mockResolvedValue({ ok: true, videoId: "v1", uploadUrl: "u" });
    actions.saveDraft.mockResolvedValue({ ok: true, videoId: "v1" });
    renderIt();
    fill();
    chooseFile();
    await waitFor(() => expect(upchunk.createUpload).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    expect(await screen.findByText("Draft saved. Your upload carries on.")).toBeTruthy();
    expect(nav.push).not.toHaveBeenCalled();
  });

  it("points to the host page when it is not complete, and shows no file step when the file is already on its way", () => {
    renderIt({ hostComplete: false, fileStep: "in-flight", fileNote: "Your video file is uploading or processing." });
    expect(screen.getByRole("link", { name: "Go to My host page" }).getAttribute("href")).toBe("/creator/host");
    expect(screen.getByText("Your video file is uploading or processing.")).toBeTruthy();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it("is honest when uploads are not set up: details and drafts only", () => {
    renderIt({ uploadsEnabled: false });
    expect(screen.getByText(/Uploads aren't set up yet/)).toBeTruthy();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });
});

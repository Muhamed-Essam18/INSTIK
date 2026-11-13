import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UploadProgress } from "@/components/creator/UploadProgress";
import { MAX_UPLOAD_BYTES } from "@/lib/creator/limits";

// A stand-in for UpChunk: tests push its events by hand.
const upchunk = vi.hoisted(() => {
  const handlers: Record<string, ((e: { detail: unknown }) => void)[]> = {};
  const abort = vi.fn();
  const createUpload = vi.fn((options: { endpoint: string; file: File }) => {
    void options;
    return {
      abort,
      on: (name: string, fn: (e: { detail: unknown }) => void) => {
        (handlers[name] ??= []).push(fn);
      },
    };
  });
  const emit = (name: string, detail?: unknown) => (handlers[name] ?? []).forEach((fn) => fn({ detail }));
  const reset = () => {
    for (const k of Object.keys(handlers)) delete handlers[k];
    abort.mockClear();
    createUpload.mockClear();
  };
  return { createUpload, emit, reset, abort };
});
vi.mock("@mux/upchunk", () => ({ createUpload: upchunk.createUpload }));

const video = (name = "visiting-grandma.mp4", size = 5_000_000, type = "video/mp4") => {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
};
const choose = (file: File) => fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [file] } });

beforeEach(() => upchunk.reset());
afterEach(cleanup);

describe("UploadProgress", () => {
  it("asks for the link and sends the file straight to it, showing a labelled bar that follows the percentage", async () => {
    const start = vi.fn(async () => ({ ok: true as const, uploadUrl: "https://upload.example/1" }));
    render(<UploadProgress start={start} />);
    expect(screen.getByText("Drop your video here")).toBeTruthy();
    choose(video());
    await waitFor(() => expect(upchunk.createUpload).toHaveBeenCalledTimes(1));
    expect(upchunk.createUpload.mock.calls[0][0].endpoint).toBe("https://upload.example/1");
    expect(start).toHaveBeenCalledTimes(1);

    const bar = screen.getByRole("progressbar", { name: "Upload progress" });
    expect(bar.getAttribute("aria-valuenow")).toBe("0");
    act(() => upchunk.emit("progress", 62.4));
    expect(bar.getAttribute("aria-valuenow")).toBe("62");
    expect(screen.getByText("Uploading · 62%")).toBeTruthy();
  });

  it("says so when the connection drops and carries on when it is back", async () => {
    render(<UploadProgress start={async () => ({ ok: true, uploadUrl: "u" })} />);
    choose(video());
    await waitFor(() => expect(upchunk.createUpload).toHaveBeenCalled());
    act(() => upchunk.emit("progress", 40));
    act(() => upchunk.emit("offline"));
    expect(screen.getByText("Waiting for your connection · 40%")).toBeTruthy();
    act(() => upchunk.emit("online"));
    expect(screen.getByText("Uploading · 40%")).toBeTruthy();
  });

  it("shows Uploaded and tells the parent when the whole file has gone", async () => {
    const onUploaded = vi.fn();
    render(<UploadProgress start={async () => ({ ok: true, uploadUrl: "u" })} onUploaded={onUploaded} />);
    choose(video());
    await waitFor(() => expect(upchunk.createUpload).toHaveBeenCalled());
    act(() => upchunk.emit("success"));
    expect(screen.getByText("Uploaded. Processing now.")).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("100");
    expect(onUploaded).toHaveBeenCalledTimes(1);
  });

  it("refuses a file of 4 GB plus one byte before asking for a link or sending anything", async () => {
    const start = vi.fn();
    render(<UploadProgress start={start} />);
    choose(video("big.mp4", MAX_UPLOAD_BYTES + 1));
    expect((await screen.findByRole("alert")).textContent).toMatch(/over 4 GB/);
    expect(start).not.toHaveBeenCalled();
    expect(upchunk.createUpload).not.toHaveBeenCalled();
  });

  it("accepts a file of exactly 4 GB", async () => {
    render(<UploadProgress start={async () => ({ ok: true, uploadUrl: "u" })} />);
    choose(video("big.mp4", MAX_UPLOAD_BYTES));
    await waitFor(() => expect(upchunk.createUpload).toHaveBeenCalledTimes(1));
  });

  it("refuses a file that is not an MP4 or MOV", async () => {
    const start = vi.fn();
    render(<UploadProgress start={start} />);
    choose(video("notes.pdf", 1000, "application/pdf"));
    expect((await screen.findByRole("alert")).textContent).toBe("Please choose an MP4 or MOV video.");
    expect(start).not.toHaveBeenCalled();
  });

  it("shows the server's plain message when the link cannot be made, and can try again", async () => {
    const start = vi.fn().mockResolvedValueOnce({ ok: false, message: "Uploads aren't set up yet. Please try again soon." }).mockResolvedValue({ ok: true, uploadUrl: "u" });
    render(<UploadProgress start={start} />);
    choose(video());
    expect((await screen.findByRole("alert")).textContent).toMatch(/aren't set up/);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(upchunk.createUpload).toHaveBeenCalledTimes(1));
    expect(start).toHaveBeenCalledTimes(2);
  });

  it("shows a failed upload with Try again, which asks for a new link for the same file", async () => {
    const start = vi.fn(async () => ({ ok: true as const, uploadUrl: "u" }));
    render(<UploadProgress start={start} />);
    choose(video());
    await waitFor(() => expect(upchunk.createUpload).toHaveBeenCalledTimes(1));
    act(() => upchunk.emit("error", { message: "boom" }));
    expect(screen.getByRole("alert").textContent).toMatch(/Your details are safe/);
    expect(screen.getByText("visiting-grandma.mp4", { exact: false })).toBeTruthy();
    upchunk.reset();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(upchunk.createUpload).toHaveBeenCalledTimes(1));
    expect(start).toHaveBeenCalledTimes(2);
  });

  it("stops an upload that is still running when the creator leaves the page", async () => {
    const { unmount } = render(<UploadProgress start={async () => ({ ok: true, uploadUrl: "u" })} />);
    choose(video());
    await waitFor(() => expect(upchunk.createUpload).toHaveBeenCalled());
    unmount();
    expect(upchunk.abort).toHaveBeenCalled();
  });

  it("does nothing while disabled", () => {
    const start = vi.fn();
    render(<UploadProgress start={start} disabled />);
    choose(video());
    expect(start).not.toHaveBeenCalled();
  });
});

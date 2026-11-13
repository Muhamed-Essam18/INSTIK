import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HostForm } from "@/components/creator/HostForm";
import { PHOTO_MAX_BYTES } from "@/lib/creator/host-rules";

const actions = vi.hoisted(() => ({ saveHost: vi.fn(), uploadHostPhoto: vi.fn() }));
vi.mock("@/lib/creator/actions", () => actions);

beforeEach(() => {
  actions.saveHost.mockReset();
  actions.uploadHostPhoto.mockReset();
});
afterEach(cleanup);

const host = { name: "Salma", nameArabic: "سَلمى", story: "I grew up in Alexandria.", topics: ["Food", "Family"], photo: null as string | null };
const renderIt = (extra: Partial<Parameters<typeof HostForm>[0]> = {}) =>
  render(<HostForm host={host} photosEnabled publicHref="/learn/arabic-egyptian/hosts/salma" {...extra} />);
const photoInput = () => document.querySelector('input[type="file"]')!;
const file = (size: number, type = "image/jpeg") => {
  const f = new File(["x"], "me.jpg", { type });
  Object.defineProperty(f, "size", { value: size });
  return f;
};

describe("HostForm", () => {
  it("shows the saved values and sets the Arabic name right-to-left in Arabic", () => {
    renderIt();
    expect((screen.getByLabelText("Your name") as HTMLInputElement).value).toBe("Salma");
    const arabic = screen.getByLabelText("Your name in Arabic") as HTMLInputElement;
    expect(arabic.value).toBe("سَلمى");
    expect(arabic.getAttribute("dir")).toBe("rtl");
    expect(arabic.getAttribute("lang")).toBe("arz");
    expect((screen.getByLabelText("Topics") as HTMLInputElement).value).toBe("Food, Family");
  });

  it("saves the names, story and topics, and links to the public page", async () => {
    actions.saveHost.mockResolvedValue({ ok: true });
    renderIt();
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Salma Hassan" } });
    fireEvent.change(screen.getByLabelText("Topics"), { target: { value: "Food, Family, Culture" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText(/Saved\./);
    expect(actions.saveHost).toHaveBeenCalledWith({
      name: "Salma Hassan",
      nameArabic: "سَلمى",
      story: "I grew up in Alexandria.",
      topics: ["Food", " Family", " Culture"],
    });
    expect(screen.getByRole("link", { name: "See your page as learners do" }).getAttribute("href")).toBe("/learn/arabic-egyptian/hosts/salma");
  });

  it("shows each field's message from the server and does not say it saved", async () => {
    actions.saveHost.mockResolvedValue({ ok: false, message: "A few things to finish first.", fields: { name: "Add your name in Latin letters.", story: "Write a few words about yourself." } });
    renderIt({ host: { ...host, name: "", story: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Add your name in Latin letters.")).toBeTruthy();
    expect(screen.getByText("Write a few words about yourself.")).toBeTruthy();
    expect(screen.getByLabelText("Your name").getAttribute("aria-invalid")).toBe("true");
    expect(screen.queryByText(/Saved\./)).toBeNull();
  });

  it("does not send a photo over 2 MB at all, and says so", async () => {
    renderIt();
    fireEvent.change(photoInput(), { target: { files: [file(PHOTO_MAX_BYTES + 1)] } });
    expect((await screen.findByRole("alert")).textContent).toBe("That photo is over 2 MB. Please choose a smaller one.");
    expect(actions.uploadHostPhoto).not.toHaveBeenCalled();
  });

  it("shows the new photo after a good upload and keeps the old one when the server refuses", async () => {
    actions.uploadHostPhoto.mockResolvedValueOnce({ ok: false, message: "Please choose a JPEG, PNG or WebP photo." });
    renderIt({ host: { ...host, photo: "https://blob.example/old.jpg" } });
    fireEvent.change(photoInput(), { target: { files: [file(1000, "application/pdf")] } });
    expect((await screen.findByRole("alert")).textContent).toBe("Please choose a JPEG, PNG or WebP photo.");
    expect((screen.getByRole("img") as HTMLImageElement).src).toBe("https://blob.example/old.jpg");

    actions.uploadHostPhoto.mockResolvedValueOnce({ ok: true, photo: "https://blob.example/new.jpg" });
    fireEvent.change(photoInput(), { target: { files: [file(1000)] } });
    await waitFor(() => expect((screen.getByRole("img") as HTMLImageElement).src).toBe("https://blob.example/new.jpg"));
  });

  it("is honest when photos are not set up", () => {
    renderIt({ photosEnabled: false });
    expect(screen.getByText("Photo upload isn't set up yet.")).toBeTruthy();
    expect((photoInput() as HTMLInputElement).disabled).toBe(true);
  });
});

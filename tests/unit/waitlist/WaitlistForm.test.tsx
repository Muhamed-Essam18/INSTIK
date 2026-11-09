import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const search = vi.hoisted(() => ({ value: "" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(search.value) }));

import { WaitlistForm } from "@/components/marketing/WaitlistForm";
import { waitlist } from "@/lib/marketing/copy";
import type { JoinWaitlistResult } from "@/lib/waitlist/actions";

const options = [
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "other", name: "Other" },
];

afterEach(() => {
  cleanup();
  search.value = "";
});

const setup = (result: JoinWaitlistResult = { ok: true }) => {
  const join = vi.fn<(input: { language: unknown; email: unknown; website?: unknown }) => Promise<JoinWaitlistResult>>(
    async () => result,
  );
  render(<WaitlistForm options={options} join={join} />);
  return join;
};
const fill = (language: string, email: string) => {
  fireEvent.change(screen.getByLabelText("Language"), { target: { value: language } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
};

describe("WaitlistForm", () => {
  it("preselects the language from the address", () => {
    search.value = "language=es";
    setup();
    expect((screen.getByLabelText("Language") as HTMLSelectElement).value).toBe("es");
  });
  it("ignores a language that is not offered", () => {
    search.value = "language=zz";
    setup();
    expect((screen.getByLabelText("Language") as HTMLSelectElement).value).toBe("");
  });
  it("shows the note and a link to the privacy page", () => {
    setup();
    expect(screen.getByText(/We'll only use this to tell you when your language is ready/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Privacy" }).getAttribute("href")).toBe("/privacy");
  });
  it("sends what was typed and shows the kind confirmation", async () => {
    const join = setup();
    fill("fr", "me@example.com");
    fireEvent.click(screen.getByRole("button", { name: "Join the waitlist" }));
    expect((await screen.findByRole("status")).textContent).toBe(waitlist.success);
    expect(join).toHaveBeenCalledWith({ language: "fr", email: "me@example.com", website: "" });
  });
  it.each(["invalid-email", "invalid-language", "too-many", "failed"] as const)(
    "shows the %s message and keeps what was typed",
    async (code) => {
      setup({ ok: false, code });
      fill("es", "oops");
      fireEvent.click(screen.getByRole("button", { name: "Join the waitlist" }));
      expect((await screen.findByRole("alert")).textContent).toBe(waitlist.errors[code]);
      expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("oops");
      expect((screen.getByLabelText("Language") as HTMLSelectElement).value).toBe("es");
    },
  );
  it("sends once for a double press", async () => {
    const join = setup();
    fill("es", "me@example.com");
    const button = screen.getByRole("button", { name: "Join the waitlist" });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
    expect(join).toHaveBeenCalledTimes(1);
  });
  it("keeps the trap field out of the keyboard order and away from assistive technology", () => {
    setup();
    const trap = document.querySelector('input[name="website"]') as HTMLInputElement;
    expect(trap.tabIndex).toBe(-1);
    expect(trap.closest('[aria-hidden="true"]')).not.toBeNull();
  });
});

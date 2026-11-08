import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionSettings } from "@/components/roadmap/SessionSettings";

const actions = vi.hoisted(() => ({ settings: vi.fn(), profile: vi.fn() }));
vi.mock("@/lib/hours/settings-actions", () => ({ saveSessionSettings: actions.settings }));
vi.mock("@/lib/learner/actions", () => ({ updateProfile: actions.profile }));

beforeEach(() => {
  actions.settings.mockReset().mockResolvedValue({ ok: true });
  actions.profile.mockReset().mockResolvedValue({ ok: true });
});
afterEach(cleanup);

const setup = (over = {}) =>
  render(<SessionSettings languageCode="arz" minutesPerDay={20} remindersOn={false} hourSound={false} {...over} />);

describe("SessionSettings", () => {
  it("starts with reminders off and the saved minutes", () => {
    setup();
    expect(screen.getByRole("button", { name: "Reminders" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "Sound when an hour is added" }).getAttribute("aria-pressed")).toBe("false");
    expect((screen.getByLabelText("Done for today after") as HTMLSelectElement).value).toBe("20");
  });

  it("offers 10, 20, 30 and 60 minutes and saves a change to the profile", async () => {
    setup();
    const select = screen.getByLabelText("Done for today after") as HTMLSelectElement;
    expect([...select.options].map((o) => o.value)).toEqual(["10", "20", "30", "60"]);
    await act(async () => fireEvent.change(select, { target: { value: "30" } }));
    expect(actions.profile).toHaveBeenCalledWith({ languageCode: "arz", minutesPerDay: 30 });
  });

  it("announces the state of each switch and saves it", async () => {
    setup();
    const sound = screen.getByRole("button", { name: "Sound when an hour is added" });
    await act(async () => fireEvent.click(sound));
    expect(sound.getAttribute("aria-pressed")).toBe("true");
    expect(actions.settings).toHaveBeenCalledWith({ hourSound: true });
    const reminders = screen.getByRole("button", { name: "Reminders" });
    await act(async () => fireEvent.click(reminders));
    expect(actions.settings).toHaveBeenCalledWith({ remindersOn: true });
  });

  it("says reminders are rare and off by default, and that sending is not part of this", () => {
    setup();
    expect(screen.getByText("Rare and friendly. Off by default.")).toBeTruthy();
    expect(screen.getByText("One soft chime")).toBeTruthy();
  });

  it("rolls back and says so quietly when a save fails", async () => {
    actions.settings.mockResolvedValue({ ok: false });
    setup();
    const sound = screen.getByRole("button", { name: "Sound when an hour is added" });
    await act(async () => fireEvent.click(sound));
    expect(sound.getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("status").textContent).toContain("Couldn't save that just now");
  });

  it("rolls back the minutes when saving them fails", async () => {
    actions.profile.mockRejectedValue(new Error("offline"));
    setup();
    const select = screen.getByLabelText("Done for today after") as HTMLSelectElement;
    await act(async () => fireEvent.change(select, { target: { value: "60" } }));
    expect(select.value).toBe("20");
  });

  it("makes every control at least 44px high", () => {
    setup();
    for (const button of screen.getAllByRole("button")) expect(button.className).toContain("h-11");
    expect((screen.getByLabelText("Done for today after") as HTMLSelectElement).className).toContain("min-h-11");
  });
});

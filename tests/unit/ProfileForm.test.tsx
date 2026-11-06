import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ updateProfile: vi.fn() }));
vi.mock("@/lib/learner/actions", () => ({ updateProfile: mocks.updateProfile }));

import { ProfileForm } from "@/components/settings/ProfileForm";

const profile = { languageCode: "arz", stage: "FOLLOW_IT", minutesPerDay: 30 } as const;

beforeEach(() => {
  mocks.updateProfile.mockReset();
});
afterEach(cleanup);

const stageGroup = () => screen.getByRole("radiogroup", { name: "Egyptian Arabic stage" });
const minutesGroup = () => screen.getByRole("radiogroup", { name: "Egyptian Arabic minutes per day" });

describe("ProfileForm", () => {
  it("shows the current stage and minutes as labelled radios using learner stage names", () => {
    render(<ProfileForm languageName="Egyptian Arabic" profile={profile} />);
    const stages = [...stageGroup().querySelectorAll('[role="radio"]')];
    expect(stages.map((s) => s.textContent)).toEqual(["Hear it", "Follow it", "Understand it", "Join in"]);
    expect(screen.getByRole("radio", { name: "Follow it" }).getAttribute("aria-checked")).toBe("true");
    const minutes = [...minutesGroup().querySelectorAll('[role="radio"]')];
    expect(minutes.map((s) => s.textContent)).toEqual(["10 min", "20 min", "30 min", "60 min"]);
    expect(screen.getByRole("radio", { name: "30 min" }).getAttribute("aria-checked")).toBe("true");
    expect(document.body.textContent).not.toMatch(/Superbeginner|Beginner|Intermediate|Advanced/);
  });

  it("saves the new values for this language only and says Saved", async () => {
    mocks.updateProfile.mockResolvedValue({ ok: true });
    render(<ProfileForm languageName="Egyptian Arabic" profile={profile} />);
    fireEvent.click(screen.getByRole("radio", { name: "Join in" }));
    fireEvent.click(screen.getByRole("radio", { name: "10 min" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByText("Saved.")).toBeTruthy());
    expect(mocks.updateProfile).toHaveBeenCalledWith({ languageCode: "arz", stage: "JOIN_IN", minutesPerDay: 10 });
  });

  it("shows a kind message and keeps the chosen values when saving fails", async () => {
    mocks.updateProfile.mockImplementation(async () => {
      throw new Error("down");
    });
    render(<ProfileForm languageName="Egyptian Arabic" profile={profile} />);
    fireEvent.click(screen.getByRole("radio", { name: "60 min" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/Your choices are still here/);
    expect(screen.getByRole("radio", { name: "60 min" }).getAttribute("aria-checked")).toBe("true");
  });

  it("clears the Saved note when something changes again", async () => {
    mocks.updateProfile.mockResolvedValue({ ok: true });
    render(<ProfileForm languageName="Egyptian Arabic" profile={profile} />);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Saved.");
    fireEvent.click(screen.getByRole("radio", { name: "20 min" }));
    expect(screen.queryByText("Saved.")).toBeNull();
  });
});

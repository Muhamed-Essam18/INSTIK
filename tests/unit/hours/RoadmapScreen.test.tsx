import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RoadmapScreen } from "@/components/screens/RoadmapScreen";
import { stageStates } from "@/lib/hours/stages";
import { roadmapView } from "../../helpers/hours-fixtures";

const mocks = vi.hoisted(() => ({ view: vi.fn() }));
vi.mock("@/lib/session", () => ({
  requireProfile: async (code: string) => ({
    learner: { id: "u1", email: "a@example.com", name: null, image: null },
    profile: { languageCode: code, stage: "FOLLOW_IT", minutesPerDay: 20 },
  }),
}));
vi.mock("@/lib/hours/queries", () => ({ getRoadmapView: mocks.view }));
vi.mock("@/lib/hours/actions", () => ({
  addManualTime: vi.fn(),
  removeManualTime: vi.fn(),
  syncTimeZone: async () => ({ ok: true, changed: false }),
}));
vi.mock("@/lib/hours/settings-actions", () => ({ saveSessionSettings: vi.fn() }));
vi.mock("@/lib/learner/actions", () => ({ updateProfile: vi.fn() }));
vi.mock("next/navigation", () => import("../../helpers/next-navigation"));

const params = Promise.resolve({ language: "arabic-egyptian" });
async function renderScreen(over = {}) {
  mocks.view.mockResolvedValue(roadmapView(over));
  const ui = await RoadmapScreen({ params });
  return render(ui);
}

beforeEach(() => mocks.view.mockReset());
afterEach(cleanup);

describe("Roadmap screen", () => {
  it("shows the total hours in the ring and a warm heading", async () => {
    await renderScreen();
    expect(screen.getByRole("img", { name: /12 hours 40 minutes counted/ })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("12 hours of Egyptian Arabic so far. Nice.");
    expect(screen.getByText("12h 40m")).toBeTruthy();
  });

  it("is kind at zero hours", async () => {
    await renderScreen({ totalSeconds: 0, watchedSeconds: 0, addedMinutes: 0, entries: [], progress: 0 });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Your first hour is waiting.");
    expect(screen.getByText("0h 0m")).toBeTruthy();
  });

  it.each(["HEAR_IT", "FOLLOW_IT", "UNDERSTAND_IT", "JOIN_IN"] as const)("shows Done, You are here, Next and Later for %s", async (stage) => {
    await renderScreen({ stage, states: stageStates(stage), nextStage: stage === "JOIN_IN" ? undefined : "JOIN_IN" });
    const section = screen.getByRole("region", { name: "Roadmap" });
    const cards = within(section).getAllByRole("listitem");
    expect(cards).toHaveLength(4);
    const labels = { done: "Done", here: "You are here", next: "Next", later: "Later" } as const;
    stageStates(stage).forEach(({ state }, i) => expect(cards[i].textContent).toContain(labels[state]));
    expect(cards.filter((c) => c.getAttribute("aria-current") === "step")).toHaveLength(1);
  });

  it("sets the progress bar from the stage progress", async () => {
    await renderScreen({ progress: 0.38 });
    expect(screen.getByRole("progressbar", { name: "Progress through Follow it" }).getAttribute("aria-valuenow")).toBe("38");
  });

  it("calls the hours to the next stage an estimate", async () => {
    await renderScreen({ moreHours: 87 });
    expect(screen.getByText("About 87 more hours to Understand it (an estimate)")).toBeTruthy();
  });

  it("shows no number when the language has no estimate", async () => {
    await renderScreen({ hasEstimates: false, moreHours: null, progress: 0 });
    expect(screen.queryByText(/more hours/)).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("never shows a negative or overdue number once past the estimate", async () => {
    await renderScreen({ moreHours: null, progress: 1 });
    expect(screen.queryByText(/more hours/)).toBeNull();
    expect(screen.getByText("You're past the estimate. Keep going at your own pace.")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/-\d|overdue|behind/i);
  });

  it("never shows internal level names", async () => {
    await renderScreen();
    expect(document.body.textContent).not.toMatch(/Superbeginner|Beginner|Intermediate|Advanced/);
  });

  it("separates watched time from time added by the learner", async () => {
    await renderScreen();
    expect(screen.getByText("10h 0m watched · 2h 40m added by you")).toBeTruthy();
    expect(screen.getAllByText("Added by you").length).toBeGreaterThan(0);
  });

  it("offers adding time and the session settings", async () => {
    await renderScreen();
    expect(screen.getByRole("button", { name: "Add time outside Instik" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Your sessions" })).toBeTruthy();
  });
});


import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DoneScreen } from "@/components/screens/DoneScreen";
import { doneView } from "../../helpers/hours-fixtures";

const mocks = vi.hoisted(() => ({ view: vi.fn() }));
vi.mock("@/lib/session", () => ({
  requireProfile: async (code: string) => ({
    learner: { id: "u1", email: "a@example.com", name: null, image: null },
    profile: { languageCode: code, stage: "FOLLOW_IT", minutesPerDay: 20 },
  }),
}));
vi.mock("@/lib/hours/queries", () => ({ getDoneView: mocks.view }));
vi.mock("@/lib/hours/actions", () => ({ syncTimeZone: async () => ({ ok: true, changed: false }) }));
vi.mock("next/navigation", () => import("../../helpers/next-navigation"));

async function renderScreen(over = {}) {
  mocks.view.mockResolvedValue(doneView(over));
  return render(await DoneScreen({ params: Promise.resolve({ language: "arabic-egyptian" }) }));
}

beforeEach(() => mocks.view.mockReset());
afterEach(cleanup);

describe("Done for today", () => {
  it("shows today's minutes, videos and total hours", async () => {
    await renderScreen();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("That's enough for today.");
    expect(screen.getByText("See you tomorrow.")).toBeTruthy();
    expect(screen.getByText("24 min")).toBeTruthy();
    expect(screen.getByText("watched today")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("videos")).toBeTruthy();
    expect(screen.getByText("13h 4m")).toBeTruthy();
    expect(screen.getByText("of Egyptian Arabic")).toBeTruthy();
  });

  it("uses the singular for one video", async () => {
    await renderScreen({ videosToday: 1 });
    expect(screen.getByText("video")).toBeTruthy();
  });

  it("shows this week, Monday to Sunday, with today marked", async () => {
    await renderScreen();
    const week = screen.getByRole("list", { name: "Days you watched this week" });
    const days = within(week).getAllByRole("listitem");
    expect(days).toHaveLength(7);
    expect(days[0].textContent).toContain("Mon");
    expect(days[2].textContent).toContain("Today");
    expect(days[2].textContent).toContain("today");
    expect(days[3].textContent).toContain("still to come");
  });

  it("has both actions with the right links", async () => {
    await renderScreen();
    expect(screen.getByRole("link", { name: "See your roadmap" }).getAttribute("href")).toBe("/learn/arabic-egyptian/roadmap");
    expect(screen.getByRole("link", { name: "I have a bit more time" }).getAttribute("href")).toBe("/learn/arabic-egyptian");
  });

  it("is kind, and has no shaming or streak words", async () => {
    await renderScreen();
    expect(screen.getByText("Missed a day? That's fine. Nothing is lost.")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/streak|you missed|lost your|behind|overdue/i);
  });
});

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardData } from "@/lib/earnings/dashboard-data";

// The creator dashboard as designed (spec 11 User Story 3; docs/design/CreatorDashboard.dc.html).

const mocks = vi.hoisted(() => ({ data: undefined as unknown, getDashboard: vi.fn() }));
vi.mock("@/lib/session", () => ({ requireCreator: async () => ({ id: "ann", email: "ann@x.com", name: "Ann Smith", role: "creator" }) }));
vi.mock("@/lib/earnings/instance", () => ({ earningsService: () => ({ getDashboard: mocks.getDashboard }) }));

import { CreatorScreen } from "@/components/screens/CreatorScreen";

const base: DashboardData = {
  creatorName: "Salma",
  languageCode: "arz",
  month: "2026-11",
  counts: { uploaded: 14, inReview: 2, approved: 10, changes: 1 },
  views: 1_240,
  watchSeconds: 186 * 3600,
  learners: 312,
  averageCompletion: 0.68,
  weeks: [
    { label: "Oct 13", count: 180, current: false },
    { label: "Oct 20", count: 240, current: false },
    { label: "Oct 27", count: 210, current: false },
    { label: "Nov 3", count: 300, current: false },
    { label: "Nov 10", count: 310, current: true },
  ],
  top: [
    { videoId: "v1", title: "At the café", stage: "follow-it", views: 540, watchSeconds: 61 * 3600, completion: 0.74, answers: { mostly: 70, some: 22, notYet: 8 } },
    { videoId: "v2", title: "My family", stage: "hear-it", views: 410, watchSeconds: 29 * 3600, completion: 0.81, answers: { mostly: 78, some: 18, notYet: 4 } },
  ],
  earnings: {
    estimateCents: 41_250,
    currency: "EUR",
    lastMonth: { month: "2026-10", state: "final", earningsCents: 46_000, currency: "EUR", paid: true, paidAt: new Date("2026-11-05T09:00:00Z") },
    nextPayoutDay: "2026-12-05",
  },
  requests: [
    { id: "r1", stage: "follow-it", topic: "food", text: "Cooking at home, ordering street food." },
    { id: "r2", stage: "hear-it", topic: "daily-life", text: "Short, very slow videos with objects on the table." },
  ],
};

async function show(over: Partial<DashboardData> = {}) {
  mocks.getDashboard.mockResolvedValue({ ...base, ...over });
  render(await CreatorScreen());
}

beforeEach(() => mocks.getDashboard.mockReset());
afterEach(cleanup);

// A tile's label is a span (the table header with the same words is a th).
const tile = (label: string) => screen.getByText(label, { selector: "span" }).parentElement as HTMLElement;

describe("the figures as designed", () => {
  it("greets the creator and shows the month and language", async () => {
    await show();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Welcome back, Salma");
    expect(screen.getByText("November 2026 · Egyptian Arabic")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Upload a video" }).getAttribute("href")).toBe("/creator/upload");
  });

  it("shows the four video counts", async () => {
    await show();
    expect(within(tile("Videos uploaded")).getByText("14")).toBeTruthy();
    expect(within(tile("In review")).getByText("2")).toBeTruthy();
    expect(within(tile("Approved")).getByText("10")).toBeTruthy();
    expect(within(tile("Changes requested")).getByText("1")).toBeTruthy();
    expect(within(tile("Changes requested")).getByRole("link", { name: "See the note" }).getAttribute("href")).toBe("/creator/videos?status=changes");
  });

  it("shows this month's counted views, watch hours, unique learners and average completion", async () => {
    await show();
    expect(within(tile("Counted views")).getByText("1,240")).toBeTruthy();
    expect(within(tile("Watch hours")).getByText("186h")).toBeTruthy();
    expect(within(tile("Unique learners")).getByText("312")).toBeTruthy();
    expect(within(tile("Average completion")).getByText("68%")).toBeTruthy();
    expect(within(tile("Average completion")).getByText("Across videos watched this month")).toBeTruthy();
  });

  it("draws five weekly bars, marks the week in progress and gives a text alternative with every number", async () => {
    await show();
    const chart = screen.getByRole("img", { name: /Counted views per week/ });
    const label = chart.getAttribute("aria-label")!;
    for (const part of ["week of Oct 13, 180", "week of Oct 20, 240", "week of Oct 27, 210", "week of Nov 3, 300", "week of Nov 10, 310 so far"]) expect(label).toContain(part);
    expect(within(chart).getAllByText(/^\d+$/)).toHaveLength(5);
    expect(screen.getByText("Counted views per week. This week so far is in coral.")).toBeTruthy();
  });

  it("shows the top videos with stage, counted views, watch hours, completion and the answers", async () => {
    await show();
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows.map((r) => [within(r).getByRole("rowheader").textContent, ...within(r).getAllByRole("cell").slice(0, 4).map((c) => c.textContent)])).toEqual([
      ["At the café", "Follow it", "540", "61h", "74%"],
      ["My family", "Hear it", "410", "29h", "81%"],
    ]);
    expect(screen.getByRole("img", { name: "فاهم؟ answers: mostly 70%, some of it 22%, not yet 8%" })).toBeTruthy();
    expect(screen.getByText(/Lots of "not yet" usually means the video is harder than its stage/)).toBeTruthy();
    expect(screen.getByText(/mostly understood/)).toBeTruthy();
  });

  it("lists the requests from Instik", async () => {
    await show();
    const section = within(screen.getByRole("region", { name: "What learners need next" }));
    expect(section.getByText("Requests from Instik")).toBeTruthy();
    expect(section.getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Follow it · FoodCooking at home, ordering street food.",
      "Hear it · Daily lifeShort, very slow videos with objects on the table.",
    ]);
  });
});

describe("earnings", () => {
  it("shows the estimate labelled estimated, last month final and paid, and the next payout", async () => {
    await show();
    const card = within(screen.getByRole("region", { name: "Earnings" }));
    expect(card.getByText("Earnings · November (estimated)")).toBeTruthy();
    expect(card.getByText("€412.50")).toBeTruthy();
    expect(card.getByText("October (final)")).toBeTruthy();
    expect(card.getByText("€460.00 · paid 5 Nov")).toBeTruthy();
    expect(card.getByText("5 December")).toBeTruthy();
    expect(card.getByText(/The estimate changes until the month closes/)).toBeTruthy();
  });

  it("says payment pending, calmly, when last month is final but not yet paid", async () => {
    await show({ earnings: { ...base.earnings, lastMonth: { month: "2026-10", state: "final", earningsCents: 46_000, currency: "EUR", paid: false, paidAt: null } } });
    expect(screen.getByText("€460.00 · payment pending")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/overdue|late|behind/i);
  });

  it("says the estimate is not available yet, not zero, when no revenue has been entered", async () => {
    await show({ earnings: { ...base.earnings, estimateCents: null, lastMonth: { month: "2026-10", state: "open" } } });
    const card = within(screen.getByRole("region", { name: "Earnings" }));
    expect(card.getByText("Not available yet")).toBeTruthy();
    expect(card.queryByText(/€0\.00/)).toBeNull();
    expect(card.getByText("Not final yet")).toBeTruthy();
  });

  it("shows a real zero when revenue exists and the creator has no counted views", async () => {
    await show({ earnings: { ...base.earnings, estimateCents: 0 } });
    expect(within(screen.getByRole("region", { name: "Earnings" })).getByText("€0.00")).toBeTruthy();
  });
});

describe("a creator with nothing yet", () => {
  const empty: Partial<DashboardData> = {
    counts: { uploaded: 0, inReview: 0, approved: 0, changes: 0 },
    views: 0,
    watchSeconds: 0,
    learners: 0,
    averageCompletion: null,
    weeks: base.weeks.map((w) => ({ ...w, count: 0 })),
    top: [],
    requests: [],
    earnings: { ...base.earnings, estimateCents: null, lastMonth: { month: "2026-10", state: "open" } },
  };

  it("shows zeros and calm empty states, never an error", async () => {
    await show(empty);
    expect(within(tile("Counted views")).getByText("0")).toBeTruthy();
    expect(within(tile("Watch hours")).getByText("0h")).toBeTruthy();
    expect(within(tile("Average completion")).getByText("—")).toBeTruthy();
    expect(screen.getByText("Nothing watched yet this month")).toBeTruthy();
    expect(screen.getByText(/Nothing here yet. Counted views will show up/)).toBeTruthy();
    expect(screen.getByText("No requests right now.")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("link", { name: "See the note" })).toBeNull();
  });

  it("greets a creator whose name is not known without a stray comma", async () => {
    mocks.getDashboard.mockResolvedValue({ ...base, ...empty, creatorName: "" });
    render(await CreatorScreen());
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Welcome back, Ann");
  });
});

describe("privacy and brand", () => {
  it("shows no email or learner identity, no ranking and no streak or shaming words", async () => {
    await show();
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/@/);
    expect(text).not.toMatch(/streak|rank|leaderboard|overdue|falling behind|you missed/i);
  });

  it("uses colour tokens only", async () => {
    await show();
    expect(document.body.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(/);
  });
});

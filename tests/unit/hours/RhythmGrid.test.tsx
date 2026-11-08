import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RhythmGrid } from "@/components/roadmap/RhythmGrid";
import { buildRhythm } from "@/lib/hours/rhythm";

afterEach(cleanup);

const today = "2026-11-11";

describe("RhythmGrid", () => {
  it("has the legend and the no-streaks line", () => {
    render(<RhythmGrid rhythm={buildRhythm({ today, watchedByDay: {}, addedDays: [] })} />);
    expect(screen.getByText("Watched")).toBeTruthy();
    expect(screen.getByText("Rest day")).toBeTruthy();
    expect(screen.getByText("No streaks. A rest day never costs you anything.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Your rhythm" })).toBeTruthy();
  });

  it("draws 56 days with watched, rest and future days told apart", () => {
    const rhythm = buildRhythm({ today, watchedByDay: { "2026-11-09": 600, "2026-11-10": 59 }, addedDays: ["2026-11-02"] });
    const { container } = render(<RhythmGrid rhythm={rhythm} />);
    const cells = [...container.querySelectorAll("[data-state]")];
    expect(cells).toHaveLength(56);
    expect(cells.filter((c) => c.getAttribute("data-state") === "watched")).toHaveLength(2);
    expect(cells.filter((c) => c.getAttribute("data-state") === "future")).toHaveLength(4);
  });

  it("has a text alternative for the calendar", () => {
    const rhythm = buildRhythm({ today, watchedByDay: { "2026-11-09": 600 }, addedDays: [] });
    render(<RhythmGrid rhythm={rhythm} />);
    expect(screen.getByRole("img", { name: "Calendar of days watched. Watched on 1 day in the last 8 weeks." })).toBeTruthy();
  });

  it("is kind when nothing is watched yet", () => {
    render(<RhythmGrid rhythm={buildRhythm({ today, watchedByDay: {}, addedDays: [] })} />);
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain("No days watched yet");
  });

  it("uses no streak, missed or lost wording beyond the 'No streaks' line", () => {
    const { container } = render(<RhythmGrid rhythm={buildRhythm({ today, watchedByDay: {}, addedDays: [] })} />);
    const text = (container.textContent ?? "").replace("No streaks.", "");
    expect(text).not.toMatch(/streak|missed|lost|broken/i);
  });
});

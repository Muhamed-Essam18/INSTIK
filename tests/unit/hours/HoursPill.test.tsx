import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HoursPill } from "@/components/shell/HoursPill";
import { hoursStore } from "@/lib/hours/store";
import { pathname } from "../../helpers/next-navigation";

vi.mock("next/navigation", () => import("../../helpers/next-navigation"));

const languages = [
  { slug: "arabic-egyptian", code: "arz" },
  { slug: "spanish", code: "es" },
];

beforeEach(() => {
  hoursStore.reset();
  pathname.value = "/learn/arabic-egyptian";
});
afterEach(cleanup);

describe("HoursPill", () => {
  it("shows zero hours for a seeded zero, with a spoken label", () => {
    render(<HoursPill defaultSlug="arabic-egyptian" languages={languages} initialTotals={{ arz: 0 }} />);
    const link = screen.getByRole("link", { name: "Hours: 0 hours 0 minutes" });
    expect(link.textContent).toContain("0h 0m");
    expect(link.getAttribute("href")).toBe("/learn/arabic-egyptian/roadmap");
  });

  it("shows the total for the language in the URL", () => {
    pathname.value = "/learn/spanish/watch/x";
    render(<HoursPill defaultSlug="arabic-egyptian" languages={languages} initialTotals={{ arz: 45_600, es: 3_660 }} />);
    expect(screen.getByRole("link").textContent).toContain("1h 1m");
    expect(screen.getByRole("link").getAttribute("href")).toBe("/learn/spanish/roadmap");
  });

  it("uses the default language outside /learn", () => {
    pathname.value = "/pricing";
    render(<HoursPill defaultSlug="arabic-egyptian" languages={languages} initialTotals={{ arz: 45_600 }} />);
    expect(screen.getByRole("link", { name: "Hours: 12 hours 40 minutes" }).textContent).toContain("12h 40m");
  });

  it("updates when a heartbeat writes a newer total", () => {
    render(<HoursPill defaultSlug="arabic-egyptian" languages={languages} initialTotals={{ arz: 3_600 }} />);
    expect(screen.getByRole("link").textContent).toContain("1h 0m");
    act(() => hoursStore.set("arz", 3_660));
    expect(screen.getByRole("link").textContent).toContain("1h 1m");
  });

  it("is neutral with no seed (signed out or loading)", () => {
    render(<HoursPill defaultSlug="arabic-egyptian" languages={languages} />);
    const link = screen.getByRole("link", { name: "Hours" });
    expect(link.textContent).toContain("—");
    expect(link.textContent).not.toMatch(/\dh/);
  });

  it("no longer says hours are not tracked", () => {
    render(<HoursPill defaultSlug="arabic-egyptian" languages={languages} initialTotals={{ arz: 10 }} />);
    expect(screen.queryByLabelText(/not tracked/i)).toBeNull();
  });
});

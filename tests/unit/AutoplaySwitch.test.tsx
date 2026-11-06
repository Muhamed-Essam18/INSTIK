import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AutoplaySwitch } from "@/components/watch/AutoplaySwitch";
import { AUTOPLAY_KEY, resetStoredMemory } from "@/lib/player/preferences";

beforeEach(() => {
  window.localStorage.clear();
  resetStoredMemory();
});
afterEach(cleanup);

const toggle = () => screen.getByRole("button", { name: /Autoplay next/ });

describe("AutoplaySwitch", () => {
  it("is off on first render and in the server HTML, even when on is stored", () => {
    window.localStorage.setItem(AUTOPLAY_KEY, "true");
    expect(renderToString(<AutoplaySwitch />)).toContain('aria-pressed="false"');
    window.localStorage.clear();
    render(<AutoplaySwitch />);
    expect(toggle().getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByText("Autoplay next")).toBeTruthy();
  });

  it("toggles and remembers the choice", async () => {
    render(<AutoplaySwitch />);
    await act(async () => fireEvent.click(toggle()));
    expect(toggle().getAttribute("aria-pressed")).toBe("true");
    expect(window.localStorage.getItem(AUTOPLAY_KEY)).toBe("true");
    await act(async () => fireEvent.click(toggle()));
    expect(toggle().getAttribute("aria-pressed")).toBe("false");
  });

  it("applies a stored on after mount", async () => {
    window.localStorage.setItem(AUTOPLAY_KEY, "true");
    render(<AutoplaySwitch />);
    expect(await screen.findByRole("button", { name: /Autoplay next/, pressed: true })).toBeTruthy();
  });

  it("stays off for corrupt storage", () => {
    window.localStorage.setItem(AUTOPLAY_KEY, "maybe");
    render(<AutoplaySwitch />);
    expect(toggle().getAttribute("aria-pressed")).toBe("false");
  });

  it("is teal when on and slate when off, and at least 44px high", async () => {
    const { container } = render(<AutoplaySwitch />);
    const track = () => container.querySelector("[data-track]") as HTMLElement;
    expect(track().className).toContain("bg-slate");
    await act(async () => fireEvent.click(toggle()));
    expect(track().className).toContain("bg-teal");
    expect(toggle().className).toContain("min-h-11");
  });
});

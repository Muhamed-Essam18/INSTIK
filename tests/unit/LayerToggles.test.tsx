import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LayerToggles } from "@/components/transcript/LayerToggles";
import { getLanguageBySlug } from "@/lib/languages";
import { DEFAULT_LAYERS } from "@/lib/player/preferences";

afterEach(cleanup);

const arabic = getLanguageBySlug("arabic-egyptian")!;
const spanish = getLanguageBySlug("spanish")!;

describe("LayerToggles", () => {
  it("renders the group with the four Arabic toggles and their pressed state", () => {
    render(<LayerToggles language={arabic} layers={DEFAULT_LAYERS} onChange={() => {}} />);
    const group = screen.getByRole("group", { name: "Show in transcript" });
    expect(group).toBeTruthy();
    const pressed = (name: string) => screen.getByRole("button", { name }).getAttribute("aria-pressed");
    expect(pressed("Arabic")).toBe("true");
    expect(pressed("Tashkeel")).toBe("true");
    expect(pressed("Transliteration")).toBe("true");
    expect(pressed("English")).toBe("false");
  });

  it("shows only the layers the language has", () => {
    render(<LayerToggles language={spanish} layers={DEFAULT_LAYERS} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Spanish" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "English" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Transliteration" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Tashkeel" })).toBeNull();
  });

  it("disables Tashkeel, with an explanation, while Arabic is off", () => {
    render(<LayerToggles language={arabic} layers={{ ...DEFAULT_LAYERS, script: false }} onChange={() => {}} />);
    const tashkeel = screen.getByRole("button", { name: "Tashkeel" }) as HTMLButtonElement;
    expect(tashkeel.disabled).toBe(true);
    expect(tashkeel.getAttribute("aria-describedby")).toBeTruthy();
    const description = document.getElementById(tashkeel.getAttribute("aria-describedby")!);
    expect(description?.textContent).toMatch(/Arabic/);
    expect((screen.getByRole("button", { name: "English" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("calls onChange with the new layers when a toggle is pressed", () => {
    const onChange = vi.fn();
    render(<LayerToggles language={arabic} layers={DEFAULT_LAYERS} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_LAYERS, english: true });
    fireEvent.click(screen.getByRole("button", { name: "Tashkeel" }));
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_LAYERS, tashkeel: false });
  });

  it("makes every toggle at least 44px high", () => {
    render(<LayerToggles language={arabic} layers={DEFAULT_LAYERS} onChange={() => {}} />);
    for (const button of screen.getAllByRole("button")) expect(button.className).toContain("min-h-11");
  });
});

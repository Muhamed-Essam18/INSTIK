import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlaybackProvider } from "@/components/player/PlaybackProvider";
import { UnderstandingCheck } from "@/components/watch/UnderstandingCheck";
import { getLanguageBySlug } from "@/lib/languages";
import { resetStoredMemory } from "@/lib/player/preferences";

vi.mock("next/navigation", () => import("../helpers/next-navigation"));

const language = getLanguageBySlug("arabic-egyptian")!;
const KEY = "instik:v1:arabic-egyptian:understood:at-the-cafe";

beforeEach(() => {
  window.localStorage.clear();
  resetStoredMemory();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const setup = (videoSlug = "at-the-cafe") =>
  render(
    <PlaybackProvider>
      <UnderstandingCheck languageSlug="arabic-egyptian" language={language} videoSlug={videoSlug} />
    </PlaybackProvider>,
  );

const answer = (name: string) => screen.getByRole("button", { name });
const pressed = (name: string) => answer(name).getAttribute("aria-pressed");

describe("UnderstandingCheck", () => {
  it("shows the Arabic word, the question and the no-score note", () => {
    setup();
    const arabic = screen.getByText("فاهم؟");
    expect(arabic.getAttribute("lang")).toBe("arz");
    expect(arabic.getAttribute("dir")).toBe("rtl");
    expect(screen.getByText("Did you follow this one?")).toBeTruthy();
    expect(screen.getByText("No score. It just helps us pick what's up next.")).toBeTruthy();
  });

  it("offers three answers in a labelled group with none pressed at first", () => {
    setup();
    expect(screen.getByRole("group", { name: "How much did you understand" })).toBeTruthy();
    for (const name of ["Mostly", "Some of it", "Not yet"]) expect(pressed(name)).toBe("false");
  });

  it("selects an answer and lets it be changed", async () => {
    setup();
    await act(async () => fireEvent.click(answer("Mostly")));
    expect(pressed("Mostly")).toBe("true");
    await act(async () => fireEvent.click(answer("Not yet")));
    expect(pressed("Not yet")).toBe("true");
    expect(pressed("Mostly")).toBe("false");
    expect(window.localStorage.getItem(KEY)).toBe('"not-yet"');
  });

  it("applies a stored answer for this video only", async () => {
    window.localStorage.setItem(KEY, '"some"');
    setup();
    expect(await screen.findByRole("button", { name: "Some of it", pressed: true })).toBeTruthy();
    cleanup();
    setup("my-family");
    expect(pressed("Some of it")).toBe("false");
  });

  it("ignores an invalid stored answer", () => {
    window.localStorage.setItem(KEY, '"perfect"');
    setup();
    for (const name of ["Mostly", "Some of it", "Not yet"]) expect(pressed(name)).toBe("false");
  });

  it("still works for the visit when localStorage throws", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    setup();
    await act(async () => fireEvent.click(answer("Mostly")));
    expect(pressed("Mostly")).toBe("true");
  });

  it("shows no score, total or streak", () => {
    const { container } = setup();
    expect(container.textContent).not.toMatch(/score:|total|streak|\d+\s*\/\s*\d+/i);
  });

  it("makes every answer at least 44px high", () => {
    setup();
    for (const name of ["Mostly", "Some of it", "Not yet"]) expect(answer(name).className).toContain("min-h-11");
  });
});

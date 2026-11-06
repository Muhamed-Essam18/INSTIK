import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WordCard } from "@/components/transcript/WordCard";
import type { TranscriptViewEntry } from "@/lib/content/transcript";
import { getLanguageBySlug } from "@/lib/languages";

const language = getLanguageBySlug("arabic-egyptian")!;
const entry: TranscriptViewEntry = { word: "سُخْنَة", transliteration: "sokhna", english: "hot" };

const audio = { play: vi.fn(() => Promise.resolve()), pause: vi.fn() };
const AudioStub = vi.fn(function () {
  return audio;
});

beforeEach(() => {
  audio.play.mockClear();
  audio.pause.mockClear();
  AudioStub.mockClear();
  (window as unknown as { Audio: unknown }).Audio = AudioStub;
});
afterEach(cleanup);

const setup = (e: TranscriptViewEntry = entry) => {
  const onClose = vi.fn();
  render(
    <div>
      <button data-word-button="">other word</button>
      <button>outside</button>
      <WordCard language={language} entry={e} onClose={onClose} />
    </div>,
  );
  return onClose;
};

describe("WordCard", () => {
  it("is a dialog labelled with the meaning, showing word, transliteration and meaning", () => {
    setup();
    const dialog = screen.getByRole("dialog", { name: "Word: hot" });
    expect(dialog).toBeTruthy();
    const word = screen.getByText("سُخْنَة");
    expect(word.getAttribute("dir")).toBe("rtl");
    expect(word.getAttribute("lang")).toBe("arz");
    expect(screen.getByText("sokhna")).toBeTruthy();
    expect(screen.getByText("hot")).toBeTruthy();
  });

  it("has no Hear it button without audio", () => {
    setup();
    expect(screen.queryByRole("button", { name: "Hear it" })).toBeNull();
  });

  it("plays the word's audio when Hear it is pressed", () => {
    setup({ ...entry, audio: "/audio/sokhna.mp3" });
    fireEvent.click(screen.getByRole("button", { name: "Hear it" }));
    expect(AudioStub).toHaveBeenCalledWith("/audio/sokhna.mp3");
    expect(audio.play).toHaveBeenCalledTimes(1);
  });

  it("keeps working if the audio fails to play", () => {
    audio.play.mockImplementationOnce(() => Promise.reject(new Error("blocked")));
    setup({ ...entry, audio: "/audio/sokhna.mp3" });
    expect(() => fireEvent.click(screen.getByRole("button", { name: "Hear it" }))).not.toThrow();
  });

  it("stops the audio when it closes", () => {
    setup({ ...entry, audio: "/audio/sokhna.mp3" });
    fireEvent.click(screen.getByRole("button", { name: "Hear it" }));
    cleanup();
    expect(audio.pause).toHaveBeenCalled();
  });

  it("closes on Escape and asks for focus to go back to the word", () => {
    const onClose = setup();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledWith(true);
  });

  it("closes on a pointer press outside, without taking focus back", () => {
    const onClose = setup();
    fireEvent.pointerDown(screen.getByRole("button", { name: "outside" }));
    expect(onClose).toHaveBeenCalledWith(false);
  });

  it("closes when focus moves outside", () => {
    const onClose = setup();
    fireEvent.focusIn(screen.getByRole("button", { name: "outside" }));
    expect(onClose).toHaveBeenCalledWith(false);
  });

  it("stays open for presses inside the card and on word buttons (those switch the card themselves)", () => {
    const onClose = setup({ ...entry, audio: "/a.mp3" });
    fireEvent.pointerDown(screen.getByRole("dialog"));
    fireEvent.pointerDown(screen.getByRole("button", { name: "other word" }));
    fireEvent.focusIn(screen.getByRole("button", { name: "Hear it" }));
    expect(onClose).not.toHaveBeenCalled();
  });
});

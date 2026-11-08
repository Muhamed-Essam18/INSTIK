import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlaybackProvider } from "@/components/player/PlaybackProvider";
import { VideoPlayer } from "@/components/player/VideoPlayer";
import { searchParams } from "../../helpers/next-navigation";

vi.mock("next/navigation", () => import("../../helpers/next-navigation"));
vi.mock("@mux/mux-player-react/lazy", () => ({ default: () => null }));

beforeEach(() => {
  HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
  HTMLMediaElement.prototype.pause = vi.fn();
});
afterEach(() => {
  cleanup();
  searchParams.value = new URLSearchParams();
});

/** Renders the sample-clip player and gives its <video> a plain, settable position and a duration. */
function setup(query: string, duration: number) {
  searchParams.value = new URLSearchParams(query);
  const { container } = render(
    <PlaybackProvider>
      <VideoPlayer videoSlug="at-the-cafe" playbackId="sample-clip" title="At the café" stageLabel="Follow it" libraryHref="/learn/arabic-egyptian" />
    </PlaybackProvider>,
  );
  const video = container.querySelector("video") as HTMLVideoElement;
  let current = 0;
  Object.defineProperty(video, "currentTime", { get: () => current, set: (v: number) => (current = v), configurable: true });
  Object.defineProperty(video, "duration", { get: () => duration, configurable: true });
  return video;
}

describe("VideoPlayer start position (?t=)", () => {
  it("starts at a valid position once the video knows its length", () => {
    const video = setup("t=134", 520);
    video.dispatchEvent(new Event("loadedmetadata"));
    expect(video.currentTime).toBe(134);
  });

  it("ignores a position beyond the duration", () => {
    const video = setup("t=900", 520);
    video.dispatchEvent(new Event("loadedmetadata"));
    expect(video.currentTime).toBe(0);
  });

  it("ignores odd values and plays from the start without one", () => {
    const odd = setup("t=abc", 520);
    odd.dispatchEvent(new Event("loadedmetadata"));
    expect(odd.currentTime).toBe(0);
    cleanup();
    const none = setup("", 520);
    none.dispatchEvent(new Event("loadedmetadata"));
    expect(none.currentTime).toBe(0);
  });
});

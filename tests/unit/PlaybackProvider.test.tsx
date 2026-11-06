import { act, cleanup, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlaybackProvider, usePlayback } from "@/components/player/PlaybackProvider";
import { UnderstandingCheck } from "@/components/watch/UnderstandingCheck";
import { getLanguageBySlug } from "@/lib/languages";
import { resetStoredMemory } from "@/lib/player/preferences";
import { FakeMedia } from "../helpers/fake-media";
import { router } from "../helpers/next-navigation";

vi.mock("@/lib/learner/preference-actions", () => ({ saveAnswer: async () => ({ ok: true }), saveLayers: async () => ({ ok: true }) }));
vi.mock("next/navigation", () => import("../helpers/next-navigation"));

const language = getLanguageBySlug("arabic-egyptian")!;

function Registrar({ media }: { media: FakeMedia }) {
  const { setMedia } = usePlayback();
  useEffect(() => {
    setMedia(media);
  }, [media, setMedia]);
  return null;
}

const setup = (withCheck = true) => {
  const media = new FakeMedia();
  render(
    <PlaybackProvider>
      <Registrar media={media} />
      {withCheck ? <UnderstandingCheck language={language} videoSlug="at-the-cafe" /> : null}
    </PlaybackProvider>,
  );
  return media;
};

let scrollIntoView: ReturnType<typeof vi.fn>;
beforeEach(() => {
  window.localStorage.clear();
  resetStoredMemory();
  scrollIntoView = vi.fn();
  Element.prototype.scrollIntoView = scrollIntoView as unknown as typeof Element.prototype.scrollIntoView;
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
  Object.defineProperty(document, "fullscreenElement", { value: null, configurable: true });
});
afterEach(cleanup);

describe("PlaybackProvider, end of video", () => {
  it("scrolls the check into view and focuses its first answer, selecting nothing", async () => {
    const media = setup();
    await act(async () => media.emit("ended"));
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.calls[0][0]).toMatchObject({ behavior: "smooth" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Mostly" }));
    for (const name of ["Mostly", "Some of it", "Not yet"]) {
      expect(screen.getByRole("button", { name }).getAttribute("aria-pressed")).toBe("false");
    }
  });

  it("scrolls instantly when the learner prefers reduced motion", async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    const media = setup();
    await act(async () => media.emit("ended"));
    expect(scrollIntoView.mock.calls[0][0]).toMatchObject({ behavior: "auto" });
  });

  it("leaves full screen first when the video ends in full screen", async () => {
    const exit = vi.fn(() => Promise.resolve());
    Object.defineProperty(document, "fullscreenElement", { value: document.body, configurable: true });
    document.exitFullscreen = exit;
    const media = setup();
    await act(async () => media.emit("ended"));
    expect(exit).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it("does nothing, and does not throw, when there is no check on the page", async () => {
    const media = setup(false);
    await act(async () => media.emit("ended"));
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});

describe("PlaybackProvider, Autoplay next", () => {
  const setupWithNext = (nextHref: string | null = "/learn/arabic-egyptian/watch/buying-bread-at-the-bakery") => {
    const media = new FakeMedia();
    render(
      <PlaybackProvider nextHref={nextHref ?? undefined} nextSlug={nextHref ? "buying-bread-at-the-bakery" : undefined}>
        <Registrar media={media} />
        <UnderstandingCheck language={language} videoSlug="at-the-cafe" />
      </PlaybackProvider>,
    );
    return media;
  };

  beforeEach(() => {
    router.push.mockClear();
    window.sessionStorage.clear();
  });

  it("with autoplay on, opens the next video and leaves the check alone", async () => {
    window.localStorage.setItem("instik:v1:autoplay", "true");
    const media = setupWithNext();
    await act(async () => media.emit("ended"));
    expect(router.push).toHaveBeenCalledWith("/learn/arabic-egyptian/watch/buying-bread-at-the-bakery");
    expect(window.sessionStorage.getItem("instik:v1:autoplay-next")).toBe("buying-bread-at-the-bakery");
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(document.activeElement).not.toBe(screen.getByRole("button", { name: "Mostly" }));
  });

  it("with autoplay off (the default), nothing navigates and the check is brought into view", async () => {
    const media = setupWithNext();
    await act(async () => media.emit("ended"));
    expect(router.push).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem("instik:v1:autoplay-next")).toBeNull();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("with autoplay on but nothing to play next, behaves as if autoplay were off", async () => {
    window.localStorage.setItem("instik:v1:autoplay", "true");
    const media = setupWithNext(null);
    await act(async () => media.emit("ended"));
    expect(router.push).not.toHaveBeenCalled();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Mostly" }));
  });

  it("treats a corrupt autoplay value as off", async () => {
    window.localStorage.setItem("instik:v1:autoplay", "yes please");
    const media = setupWithNext();
    await act(async () => media.emit("ended"));
    expect(router.push).not.toHaveBeenCalled();
  });
});

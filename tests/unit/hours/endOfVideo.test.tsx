import { act, cleanup, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlaybackProvider, usePlayback } from "@/components/player/PlaybackProvider";
import { UnderstandingCheck } from "@/components/watch/UnderstandingCheck";
import { getLanguageBySlug } from "@/lib/languages";
import { resetStoredMemory } from "@/lib/player/preferences";
import { FakeMedia } from "../../helpers/fake-media";
import { router } from "../../helpers/next-navigation";

vi.mock("@/lib/learner/preference-actions", () => ({ saveAnswer: async () => ({ ok: true }), saveLayers: async () => ({ ok: true }) }));
vi.mock("next/navigation", () => import("../../helpers/next-navigation"));

const language = getLanguageBySlug("arabic-egyptian")!;
const NEXT = "/learn/arabic-egyptian/watch/buying-bread-at-the-bakery";
const DONE = "/learn/arabic-egyptian/done";

/** Registers the media and the counter's "before ending" function, which the test controls. */
function Registrar({ media, before }: { media: FakeMedia; before: (() => Promise<{ showDone: boolean }>) | null }) {
  const { setMedia, registerBeforeEnd } = usePlayback();
  useEffect(() => {
    setMedia(media);
  }, [media, setMedia]);
  useEffect(() => {
    registerBeforeEnd(before);
    return () => registerBeforeEnd(null);
  }, [before, registerBeforeEnd]);
  return null;
}

function setup(before: (() => Promise<{ showDone: boolean }>) | null) {
  const media = new FakeMedia();
  render(
    <PlaybackProvider nextHref={NEXT} nextSlug="buying-bread-at-the-bakery" doneHref={DONE}>
      <Registrar media={media} before={before} />
      <UnderstandingCheck language={language} videoSlug="at-the-cafe" />
    </PlaybackProvider>,
  );
  return media;
}

/** A promise the test resolves or rejects by hand. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

let scrollIntoView: ReturnType<typeof vi.fn>;
beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  resetStoredMemory();
  router.push.mockClear();
  scrollIntoView = vi.fn();
  Element.prototype.scrollIntoView = scrollIntoView as unknown as typeof Element.prototype.scrollIntoView;
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
  Object.defineProperty(document, "fullscreenElement", { value: null, configurable: true });
});
afterEach(cleanup);

describe("end of video: one handler, in order", () => {
  it("waits for the flush and the server's answer before doing anything", async () => {
    const answer = deferred<{ showDone: boolean }>();
    window.localStorage.setItem("instik:v1:autoplay", "true");
    const media = setup(() => answer.promise);
    await act(async () => media.emit("ended"));
    // Nothing yet: no navigation, no autoplay, no check.
    expect(router.push).not.toHaveBeenCalled();
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem("instik:v1:autoplay-next")).toBeNull();
    await act(async () => answer.resolve({ showDone: false }));
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith(NEXT);
  });

  it("shows Done for today instead of the next video, even with Autoplay next on", async () => {
    window.localStorage.setItem("instik:v1:autoplay", "true");
    const media = setup(async () => ({ showDone: true }));
    await act(async () => media.emit("ended"));
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith(DONE);
    expect(window.sessionStorage.getItem("instik:v1:autoplay-next")).toBeNull();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("shows Done for today instead of drawing attention to the check", async () => {
    const media = setup(async () => ({ showDone: true }));
    await act(async () => media.emit("ended"));
    expect(router.push).toHaveBeenCalledWith(DONE);
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(document.activeElement).not.toBe(screen.getByRole("button", { name: "Mostly" }));
  });

  it("keeps the usual behaviour (the check) when the goal is not reached and autoplay is off", async () => {
    const media = setup(async () => ({ showDone: false }));
    await act(async () => media.emit("ended"));
    expect(router.push).not.toHaveBeenCalled();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Mostly" }));
  });

  it("falls back to the usual behaviour when the flush or the server call fails", async () => {
    window.localStorage.setItem("instik:v1:autoplay", "true");
    const media = setup(() => Promise.reject(new Error("offline")));
    await act(async () => media.emit("ended"));
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith(NEXT);
  });

  it("does the same without a registered counter", async () => {
    const media = setup(null);
    await act(async () => media.emit("ended"));
    expect(router.push).not.toHaveBeenCalled();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("never navigates before the video ends", async () => {
    const before = vi.fn(async () => ({ showDone: true }));
    const media = setup(before);
    await act(async () => media.emit("timeupdate"));
    await act(async () => media.emit("pause"));
    expect(before).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });
});

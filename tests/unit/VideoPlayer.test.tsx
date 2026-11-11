import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { CSSProperties } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlaybackProvider } from "@/components/player/PlaybackProvider";
import { VideoPlayer } from "@/components/player/VideoPlayer";

vi.mock("next/navigation", () => import("../helpers/next-navigation"));

const mux = vi.hoisted(() => ({ props: null as Record<string, unknown> | null, media: null as unknown }));

vi.mock("@mux/mux-player-react/lazy", async () => {
  const { forwardRef: forward } = await import("react");
  const { FakeMedia: Fake } = await import("../helpers/fake-media");
  return {
    default: forward(function MuxStub(props: Record<string, unknown>, ref: unknown) {
      mux.props = props;
      mux.media ??= new Fake();
      (ref as (element: unknown) => void)(mux.media);
      return <div data-testid="mux-stub" />;
    }),
  };
});

beforeEach(() => {
  HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
  HTMLMediaElement.prototype.pause = vi.fn();
  mux.props = null;
  mux.media = null;
});
afterEach(cleanup);

const renderPlayer = (playbackId?: string) =>
  render(
    <PlaybackProvider>
      <VideoPlayer videoSlug="at-the-cafe" playbackId={playbackId} title="At the café" stageLabel="Follow it" libraryHref="/learn/arabic-egyptian" />
    </PlaybackProvider>,
  );

describe("VideoPlayer, sample clip", () => {
  it("plays the sample clip without autoplay or native controls, and marks it Sample", () => {
    const { container } = renderPlayer("sample-playback-id-at-the-cafe");
    const video = container.querySelector("video")!;
    expect(video.getAttribute("src")).toBe("/sample/sample-clip.mp4");
    expect(video.autoplay).toBe(false);
    expect(video.hasAttribute("controls")).toBe(false);
    expect(screen.getByText("Sample")).toBeTruthy();
    expect(screen.getByText("Follow it")).toBeTruthy();
  });

  it("shows the big Play button before playback starts", () => {
    renderPlayer("sample-playback-id-at-the-cafe");
    expect(screen.getAllByRole("button", { name: "Play" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("slider", { name: "Seek" })).toBeTruthy();
  });

  it("shows a kind message and a link back to the Library when the media fails", () => {
    const { container } = renderPlayer("sample-playback-id-at-the-cafe");
    fireEvent.error(container.querySelector("video")!);
    expect(screen.getByText(/didn.t load/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to the Library" }).getAttribute("href")).toBe("/learn/arabic-egyptian");
    expect(screen.queryByRole("slider")).toBeNull();
  });
});

describe("VideoPlayer, no playback id", () => {
  it("shows the friendly placeholder with no controls", () => {
    for (const id of [undefined, "", "  "]) {
      const { container, unmount } = renderPlayer(id);
      expect(screen.getByText("This video is on its way.")).toBeTruthy();
      expect(container.querySelector("video")).toBeNull();
      expect(screen.queryByRole("button")).toBeNull();
      expect(screen.queryByRole("slider")).toBeNull();
      expect(screen.getByText("Follow it")).toBeTruthy();
      unmount();
    }
  });
});

describe("VideoPlayer, Mux", () => {
  it("renders nothing for Mux on the server", () => {
    const html = renderToString(
      <PlaybackProvider>
        <VideoPlayer videoSlug="at-the-cafe" playbackId="a1B2c3D4" title="At the café" stageLabel="Follow it" libraryHref="/x" />
      </PlaybackProvider>,
    );
    expect(html).not.toContain("mux-player");
    expect(html).not.toContain("mux-stub");
  });

  it("passes the playback id, hides Mux's own controls, registers the element and shows our controls", () => {
    renderPlayer("a1B2c3D4");
    expect(screen.getByTestId("mux-stub")).toBeTruthy();
    expect(mux.props).toMatchObject({ playbackId: "a1B2c3D4", streamType: "on-demand", playsInline: true, nohotkeys: true });
    expect((mux.props!.style as CSSProperties & Record<string, string>)["--controls"]).toBe("none");
    expect(screen.getByRole("slider", { name: "Seek" })).toBeTruthy();
  });

  it("shows the error message when Mux reports an error", () => {
    renderPlayer("a1B2c3D4");
    act(() => (mux.props!.onError as () => void)());
    expect(screen.getByText(/didn.t load/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to the Library" })).toBeTruthy();
  });
});


describe("VideoPlayer, signed playback", () => {
  const tokens = { playback: "tok-v", thumbnail: "tok-t", storyboard: "tok-s" };
  const renderSigned = (withTokens: boolean) =>
    render(
      <PlaybackProvider>
        <VideoPlayer
          videoSlug="at-the-cafe"
          playbackId="a1B2c3D4"
          title="At the café"
          stageLabel="Follow it"
          libraryHref="/x"
          playbackTokens={withTokens ? tokens : undefined}
        />
      </PlaybackProvider>,
    );

  it("passes the tokens to the player when it has them", () => {
    renderSigned(true);
    expect(mux.props).toMatchObject({ tokens });
  });

  it("passes none for a public video", () => {
    renderSigned(false);
    expect(mux.props!.tokens).toBeUndefined();
  });

  it("asks a learner to reload when a signed video stops loading, for example after a long pause", () => {
    renderSigned(true);
    act(() => (mux.props!.onError as () => void)());
    expect(screen.getByText("Reload the page to keep watching.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reload" })).toBeTruthy();
    expect(screen.queryByText(/didn.t load/)).toBeNull();
  });

  it("keeps the usual message for a public video that fails", () => {
    renderSigned(false);
    act(() => (mux.props!.onError as () => void)());
    expect(screen.getByText(/didn.t load/)).toBeTruthy();
    expect(screen.queryByText("Reload the page to keep watching.")).toBeNull();
  });
});


describe("VideoPlayer, started by Autoplay next", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("plays once after mount when the previous video asked for this one, and clears the request", () => {
    window.sessionStorage.setItem("instik:v1:autoplay-next", "at-the-cafe");
    renderPlayer("sample-playback-id-at-the-cafe");
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem("instik:v1:autoplay-next")).toBeNull();
  });

  it("ignores, and clears, a request that names another video", () => {
    window.sessionStorage.setItem("instik:v1:autoplay-next", "my-family");
    renderPlayer("sample-playback-id-at-the-cafe");
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem("instik:v1:autoplay-next")).toBeNull();
  });

  it("does not play when nothing asked, and swallows a refused play", () => {
    renderPlayer("sample-playback-id-at-the-cafe");
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    cleanup();
    HTMLMediaElement.prototype.play = vi.fn(() => Promise.reject(new Error("NotAllowedError")));
    window.sessionStorage.setItem("instik:v1:autoplay-next", "at-the-cafe");
    expect(() => renderPlayer("sample-playback-id-at-the-cafe")).not.toThrow();
    expect(screen.getAllByRole("button", { name: "Play" }).length).toBeGreaterThan(0);
  });
});

describe("VideoPlayer, leaving the page", () => {
  it("pauses the video when the player goes away (unmounted, or hidden by the router)", () => {
    const { unmount } = renderPlayer("sample-playback-id-at-the-cafe");
    expect(HTMLMediaElement.prototype.pause).not.toHaveBeenCalled();
    unmount();
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
  });

  it("pauses a Mux player the same way", () => {
    const { unmount } = renderPlayer("a1B2c3D4");
    const media = mux.media as { pause: ReturnType<typeof vi.fn> };
    unmount();
    expect(media.pause).toHaveBeenCalled();
  });
});

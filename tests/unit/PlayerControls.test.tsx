import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PlayerControls } from "@/components/player/PlayerControls";
import { FakeMedia } from "../helpers/fake-media";

afterEach(() => {
  cleanup();
  Object.defineProperty(document, "fullscreenEnabled", { value: false, configurable: true });
});

function setup(media = new FakeMedia()) {
  const container = document.createElement("div");
  render(<PlayerControls media={media} container={container} />);
  return { media, container };
}

describe("PlayerControls", () => {
  it("flips Play and Pause with the media state and calls the media", async () => {
    const { media } = setup();
    const play = screen.getAllByRole("button", { name: "Play" })[0];
    await act(async () => fireEvent.click(play));
    expect(media.play).toHaveBeenCalled();
    const pause = screen.getByRole("button", { name: "Pause" });
    await act(async () => fireEvent.click(pause));
    expect(media.pause).toHaveBeenCalled();
    expect(screen.getAllByRole("button", { name: "Play" }).length).toBeGreaterThan(0);
  });

  it("shows the big Play button only before playback has started", async () => {
    const { media } = setup();
    expect(screen.getAllByRole("button", { name: "Play" })).toHaveLength(2);
    await act(async () => {
      media.paused = false;
      media.tick(1);
    });
    expect(screen.queryAllByRole("button", { name: "Play" })).toHaveLength(0);
    await act(async () => {
      media.paused = true;
      media.emit("pause");
    });
    expect(screen.getAllByRole("button", { name: "Play" })).toHaveLength(1);
  });

  it("goes back 5 seconds and never before the start", async () => {
    const media = new FakeMedia();
    media.currentTime = 70;
    setup(media);
    const back = screen.getByRole("button", { name: "Back 5 seconds" });
    await act(async () => fireEvent.click(back));
    expect(media.currentTime).toBe(65);
    media.currentTime = 3;
    await act(async () => fireEvent.click(back));
    expect(media.currentTime).toBe(0);
  });

  it("shows the current speed and cycles 1×, 0.9×, 0.75×", async () => {
    const { media } = setup();
    const speed = () => screen.getByRole("button", { name: /Playback speed/ });
    expect(speed().textContent).toBe("1×");
    for (const [label, rate] of [
      ["0.9×", 0.9],
      ["0.75×", 0.75],
      ["1×", 1],
    ] as const) {
      await act(async () => {
        fireEvent.click(speed());
        media.emit("ratechange");
      });
      expect(media.playbackRate).toBe(rate);
      expect(speed().textContent).toBe(label);
    }
  });

  it("has a labelled seek slider with a text value, and dragging seeks", async () => {
    const media = new FakeMedia();
    media.currentTime = 134;
    setup(media);
    const slider = screen.getByRole("slider", { name: "Seek" });
    expect(slider.getAttribute("aria-valuetext")).toBe("2:14 of 8:40");
    await act(async () => fireEvent.change(slider, { target: { value: "200" } }));
    expect(media.currentTime).toBe(200);
  });

  it("shows the clock as m:ss / m:ss", () => {
    const media = new FakeMedia();
    media.currentTime = 134;
    setup(media);
    expect(screen.getByText("2:14 / 8:40")).toBeTruthy();
  });

  it("hides the full screen button when the device cannot, shows it when it can", () => {
    setup();
    expect(screen.queryByRole("button", { name: /full screen/i })).toBeNull();
    cleanup();
    Object.defineProperty(document, "fullscreenEnabled", { value: true, configurable: true });
    setup();
    expect(screen.getByRole("button", { name: "Full screen" })).toBeTruthy();
  });

  it("asks the wrapper for full screen", async () => {
    Object.defineProperty(document, "fullscreenEnabled", { value: true, configurable: true });
    const { container } = setup();
    let asked = false;
    container.requestFullscreen = () => {
      asked = true;
      return Promise.resolve();
    };
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Full screen" })));
    expect(asked).toBe(true);
  });

  it("does not throw or leave an unhandled rejection when the browser refuses full screen", async () => {
    Object.defineProperty(document, "fullscreenEnabled", { value: true, configurable: true });
    const { container } = setup();
    const rejections: unknown[] = [];
    const onRejection = (event: PromiseRejectionEvent) => rejections.push(event.reason);
    window.addEventListener("unhandledrejection", onRejection);
    container.requestFullscreen = () => Promise.reject(new Error("not granted"));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Full screen" })));
    await new Promise((resolve) => setTimeout(resolve, 20));
    window.removeEventListener("unhandledrejection", onRejection);
    expect(rejections).toEqual([]);
    expect(screen.getByRole("button", { name: "Full screen" })).toBeTruthy();
  });

  it("gives every control an accessible name", () => {
    Object.defineProperty(document, "fullscreenEnabled", { value: true, configurable: true });
    setup();
    for (const control of [...screen.getAllByRole("button"), screen.getByRole("slider")]) {
      expect(control.getAttribute("aria-label") ?? control.textContent).toBeTruthy();
    }
  });
});

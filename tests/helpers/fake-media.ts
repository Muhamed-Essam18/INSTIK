import { vi } from "vitest";
import type { PlayableMedia } from "@/components/player/PlaybackProvider";

/** A stand-in for a media element: settable time, rate and pause state, plus event emitting. */
export class FakeMedia implements PlayableMedia {
  currentTime = 0;
  duration = 520;
  paused = true;
  playbackRate = 1;
  play = vi.fn(() => {
    this.paused = false;
    this.emit("play");
    return Promise.resolve();
  });
  pause = vi.fn(() => {
    this.paused = true;
    this.emit("pause");
  });
  private target = new EventTarget();

  addEventListener(type: string, listener: EventListener) {
    this.target.addEventListener(type, listener);
  }
  removeEventListener(type: string, listener: EventListener) {
    this.target.removeEventListener(type, listener);
  }
  emit(type: string) {
    this.target.dispatchEvent(new Event(type));
  }
  /** Moves playback to `time` and fires the events a real element fires. */
  tick(time: number) {
    this.currentTime = time;
    this.emit("timeupdate");
  }
  seek(time: number) {
    this.currentTime = time;
    this.emit("seeking");
    this.emit("seeked");
    this.emit("timeupdate");
  }
}

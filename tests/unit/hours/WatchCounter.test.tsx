import { act, cleanup, render } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlaybackProvider, usePlayback } from "@/components/player/PlaybackProvider";
import { WatchCounter } from "@/components/player/WatchCounter";
import { playChime } from "@/lib/hours/chime";
import { hoursStore } from "@/lib/hours/store";
import { FakeMedia } from "../../helpers/fake-media";

const record = vi.fn();
const finish = vi.fn();
vi.mock("@/lib/hours/actions", () => ({
  recordHeartbeat: (input: unknown) => record(input),
  endOfVideo: (input: unknown) => finish(input),
}));
vi.mock("@/lib/hours/chime", () => ({ playChime: vi.fn() }));
vi.mock("next/navigation", () => import("../../helpers/next-navigation"));

function Registrar({ media }: { media: FakeMedia }) {
  const { setMedia } = usePlayback();
  useEffect(() => {
    setMedia(media);
  }, [media, setMedia]);
  return null;
}

let media: FakeMedia;
const ok = (totalSeconds = 100) => ({ ok: true, accepted: 15, totalSeconds, todaySeconds: 0, stage: "HEAR_IT", chime: false });

function setup() {
  media = new FakeMedia();
  render(
    <PlaybackProvider>
      <Registrar media={media} />
      <WatchCounter languageCode="arz" videoSlug="at-the-cafe" />
    </PlaybackProvider>,
  );
}

/** Plays `seconds` of video in quarter-second steps, firing timeupdate each step. */
async function play(seconds: number) {
  for (let i = 0; i < seconds * 4; i++) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
      media.tick(media.currentTime + 0.25);
    });
  }
}
const startPlaying = async () => {
  media.paused = false;
  await act(async () => media.emit("playing"));
};
const sentSeconds = () => record.mock.calls.reduce((n, [input]) => n + (input as { seconds: number }).seconds, 0);
const setVisibility = (state: "visible" | "hidden") => {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout", "performance", "Date"] });
  record.mockReset().mockResolvedValue(ok());
  finish.mockReset().mockResolvedValue({ ok: true, showDone: false });
  hoursStore.reset();
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("WatchCounter", () => {
  it("sends about 30 counted seconds in two sends after 30 seconds of playing", async () => {
    setup();
    await startPlaying();
    await play(30);
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(record.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(sentSeconds()).toBeGreaterThanOrEqual(28);
    expect(sentSeconds()).toBeLessThanOrEqual(30);
    const first = record.mock.calls[0][0] as Record<string, unknown>;
    expect(first).toMatchObject({ languageCode: "arz", videoSlug: "at-the-cafe" });
    expect(typeof first.timeZone).toBe("string");
    expect(first.spanSeconds as number).toBeLessThanOrEqual(20);
  });

  it("sends the remainder when playback pauses", async () => {
    setup();
    await startPlaying();
    await play(6);
    expect(record).not.toHaveBeenCalled();
    media.paused = true;
    await act(async () => media.emit("pause"));
    expect(record).toHaveBeenCalledTimes(1);
    expect((record.mock.calls[0][0] as { seconds: number }).seconds).toBeGreaterThanOrEqual(5);
  });

  it("stops counting while the tab is hidden", async () => {
    setup();
    await startPlaying();
    await play(5);
    await act(async () => setVisibility("hidden"));
    const afterHide = sentSeconds();
    await play(30);
    await act(async () => vi.advanceTimersByTimeAsync(16_000));
    expect(sentSeconds()).toBe(afterHide);
  });

  it("writes the newest total into the pill's store", async () => {
    setup();
    record.mockResolvedValue(ok(4242));
    await startPlaying();
    await play(16);
    expect(hoursStore.getSnapshot().arz).toBe(4242);
  });

  it("plays the chime once when the server says an hour was added, and never otherwise", async () => {
    setup();
    vi.mocked(playChime).mockClear();
    record.mockResolvedValueOnce({ ...ok(), chime: true }).mockResolvedValue(ok());
    await startPlaying();
    await play(32);
    expect(playChime).toHaveBeenCalledTimes(1);
  });

  it("keeps a failed interval and its order, then retries when back online", async () => {
    setup();
    record.mockRejectedValueOnce(new Error("offline"));
    await startPlaying();
    await play(15);
    expect(record).toHaveBeenCalledTimes(1);
    await play(15);
    // The second beat retried the first interval first, then sent the new one.
    expect(record.mock.calls.length).toBeGreaterThanOrEqual(3);
    const ends = record.mock.calls.map(([i]) => (i as { endedAgoSeconds: number }).endedAgoSeconds);
    expect(ends[1]).toBeGreaterThan(ends[2]); // the older interval is retried before the newer one
    expect(sentSeconds()).toBeGreaterThanOrEqual(29);
  });

  it("retries on the browser's online event", async () => {
    setup();
    record.mockRejectedValueOnce(new Error("offline"));
    await startPlaying();
    await play(15);
    expect(record).toHaveBeenCalledTimes(1);
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    expect(record).toHaveBeenCalledTimes(2);
  });

  it("drops only the interval the server rejects", async () => {
    setup();
    record.mockResolvedValueOnce({ ok: false, code: "rejected" });
    await startPlaying();
    await play(15);
    await play(15);
    expect(record.mock.calls.length).toBeGreaterThanOrEqual(2);
    // The rejected interval is not sent again.
    const first = record.mock.calls[0][0] as { seconds: number };
    const resends = record.mock.calls.filter(([i]) => (i as { seconds: number }).seconds === first.seconds && (i as { endedAgoSeconds: number }).endedAgoSeconds > 20);
    expect(resends.length).toBe(0);
  });

  it("queues no more than 300 counted seconds across 20 offline minutes", async () => {
    setup();
    record.mockRejectedValue(new Error("offline"));
    await startPlaying();
    for (let i = 0; i < 20; i++) await play(60);
    record.mockReset().mockResolvedValue(ok());
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(sentSeconds()).toBeLessThanOrEqual(300);
    expect(sentSeconds()).toBeGreaterThan(250);
  });
});

"use client";

import { useEffect } from "react";
import { usePlayback } from "@/components/player/PlaybackProvider";
import { endOfVideo, recordHeartbeat } from "@/lib/hours/actions";
import { playChime } from "@/lib/hours/chime";
import {
  initialCounter,
  reduceCounter,
  takeIntervals,
  type CounterEvent,
  type CounterState,
} from "@/lib/hours/counter";
import { ack, emptyQueue, enqueue, peek, toPayload, type Queue } from "@/lib/hours/queue";
import { hoursStore } from "@/lib/hours/store";

/** How often counted time is sent while watching. */
export const HEARTBEAT_MS = 15_000;

const MEDIA_EVENTS = ["playing", "pause", "waiting", "ended", "timeupdate", "seeking", "ratechange"] as const;

type Options = { languageCode: string; videoSlug: string };

/**
 * Counts honest watch time for one video: only while it is playing and the tab is visible. Counted time is kept
 * as timed intervals in memory and sent oldest first (every 15 seconds, and at pause, hidden, end and on
 * reconnect). The server decides how much of each interval to accept. Never blocks playback.
 */
export function useWatchCounter({ languageCode, videoSlug }: Options): void {
  const { media, registerBeforeEnd } = usePlayback();

  useEffect(() => {
    if (!media) return;
    const element = media;
    let state: CounterState = initialCounter();
    let queue: Queue = emptyQueue();
    let draining: Promise<void> | null = null;
    let disposed = false;

    const timeZone = () => {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
      } catch {
        return "UTC";
      }
    };
    const now = () => performance.now();
    const feed = (event: CounterEvent) => {
      state = reduceCounter(state, event);
    };
    const position = () => (Number.isFinite(media.currentTime) ? media.currentTime : 0);

    async function drainNow() {
      for (;;) {
        const item = peek(queue);
        if (!item) return;
        let result;
        try {
          result = await recordHeartbeat({
            languageCode,
            videoSlug,
            ...toPayload(item, now()),
            position: position(),
            duration: Number.isFinite(element.duration) ? element.duration : 0,
            timeZone: timeZone(),
          });
        } catch {
          return; // offline or a server error: keep the interval and its order, try again later
        }
        // An answer of any kind means the server has seen this interval; a refusal drops just that one.
        queue = ack(queue, item.id);
        if (result.ok) {
          hoursStore.set(languageCode, result.totalSeconds);
          if (result.chime && !disposed) playChime();
        }
      }
    }

    /** Sends whatever is waiting, one interval at a time, never two sends at once. */
    function drain(): Promise<void> {
      if (!draining) {
        draining = drainNow().finally(() => {
          draining = null;
        });
      }
      return draining;
    }

    function flush(): Promise<void> {
      const taken = takeIntervals(state);
      state = taken.state;
      queue = enqueue(queue, taken.intervals);
      return drain();
    }

    const rate = () => (media as unknown as { playbackRate?: number }).playbackRate ?? 1;

    const onMedia = (type: (typeof MEDIA_EVENTS)[number]) => () => {
      const wall = now();
      const pos = position();
      if (type === "ratechange") feed({ type, rate: rate(), wall, position: pos });
      else feed({ type, wall, position: pos });
      if (type === "pause" || type === "waiting" || type === "ended") void flush();
    };

    const handlers = MEDIA_EVENTS.map((type) => [type, onMedia(type) as EventListener] as const);
    for (const [type, handler] of handlers) media.addEventListener(type, handler);

    const onVisibility = () => {
      const visible = document.visibilityState !== "hidden";
      feed({ type: "visibility", visible, wall: now(), position: position() });
      if (!visible) void flush();
    };
    const onPageHide = () => void flush();
    const onOnline = () => void drain();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("online", onOnline);

    // The page may already be hidden, or the video already playing, when this mounts.
    if (document.visibilityState === "hidden") feed({ type: "visibility", visible: false, wall: now(), position: position() });
    if (rate() !== 1) feed({ type: "ratechange", rate: rate(), wall: now(), position: position() });
    if (!media.paused) feed({ type: "playing", wall: now(), position: position() });

    const timer = window.setInterval(() => void flush(), HEARTBEAT_MS);

    // At the end of the video: close the counter, send what is left, then ask whether Done for today follows.
    registerBeforeEnd(async () => {
      feed({ type: "ended", wall: now(), position: position() });
      await flush();
      const result = await endOfVideo({ languageCode, videoSlug });
      return { showDone: result.ok && result.showDone };
    });

    return () => {
      disposed = true;
      window.clearInterval(timer);
      for (const [type, handler] of handlers) media.removeEventListener(type, handler);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("online", onOnline);
      registerBeforeEnd(null);
      void flush(); // the last counted time, if the page is still able to send it
    };
  }, [media, languageCode, videoSlug, registerBeforeEnd]);
}

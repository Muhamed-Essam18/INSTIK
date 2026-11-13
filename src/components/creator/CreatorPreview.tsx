"use client";

import MuxPlayer from "@mux/mux-player-react/lazy";
import { useHydrated } from "@/hooks/useStoredValue";

type Tokens = { playback: string; thumbnail: string; storyboard: string };

/** The creator's own preview of their video. Until the file has been processed there is only a calm note. */
export function CreatorPreview({ playbackId, tokens, title }: { playbackId: string | null; tokens?: Tokens; title: string }) {
  const hydrated = useHydrated();
  return (
    <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg bg-ink text-cream">
      {playbackId && hydrated ? (
        <MuxPlayer
          playbackId={playbackId}
          tokens={tokens}
          streamType="on-demand"
          playsInline
          metadata={{ video_title: title }}
          className="absolute inset-0 size-full"
        />
      ) : (
        <p className="m-0 max-w-sm px-space-4 text-center text-body text-cream">
          {playbackId ? "Loading your preview…" : "Your preview will appear here once your video has been processed."}
        </p>
      )}
    </div>
  );
}

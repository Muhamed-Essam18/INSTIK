import "server-only";
import { createSign } from "node:crypto";
import { env } from "@/lib/env";
import { resolveSource } from "@/lib/player/source";

// Signed playback for full-access videos (Mux). Free videos keep a public playback id and need no token.
// Only ever called from the watch page after the access check has passed, so a locked learner can never get one.

export type PlaybackTokens = { playback: string; thumbnail: string; storyboard: string };

const MIN_LIFETIME_SECONDS = 3600;

const b64url = (input: Buffer | string) => Buffer.from(input).toString("base64url");

/** Mux checks the token on each request, not only at the start, so it must outlast the video with room to pause. */
export function tokenLifetimeSeconds(durationSeconds: number): number {
  return Math.max(MIN_LIFETIME_SECONDS, 2 * durationSeconds);
}

function sign(payload: Record<string, unknown>, keyId: string, privateKeyPem: string): string {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT", kid: keyId }));
  const body = b64url(JSON.stringify(payload));
  const signature = createSign("RSA-SHA256").update(`${header}.${body}`).sign(privateKeyPem);
  return `${header}.${body}.${b64url(signature)}`;
}

/** Signs the three tokens with the given key. Exported for tests; the app calls `signPlaybackTokens`. */
export function signTokens(
  playbackId: string,
  durationSeconds: number,
  keyId: string,
  privateKeyBase64: string,
  now: Date,
): PlaybackTokens {
  const pem = Buffer.from(privateKeyBase64, "base64").toString("utf8");
  const exp = Math.floor(now.getTime() / 1000) + tokenLifetimeSeconds(durationSeconds);
  const make = (aud: "v" | "t" | "s") => sign({ sub: playbackId, aud, exp }, keyId, pem);
  return { playback: make("v"), thumbnail: make("t"), storyboard: make("s") };
}

/**
 * Tokens for a full-access Mux video, or null: free videos, videos with no playback id, the development sample clip,
 * and a missing signing key all return null (the key is a launch setting; without it a signed video cannot play).
 */
export function signPlaybackTokens(
  video: { playbackId?: string; access: string; durationSeconds: number },
  now: Date = new Date(),
): PlaybackTokens | null {
  if (video.access === "free") return null;
  const source = resolveSource(video.playbackId);
  if (source.kind !== "mux") return null;
  const { MUX_SIGNING_KEY_ID: keyId, MUX_SIGNING_PRIVATE_KEY: key } = env();
  if (!keyId || !key) return null;
  return signTokens(source.playbackId, video.durationSeconds, keyId, key, now);
}

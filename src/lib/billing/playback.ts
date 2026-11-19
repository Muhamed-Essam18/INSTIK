import "server-only";
import { createSign } from "node:crypto";
import { env } from "@/lib/env";
import { resolveSource } from "@/lib/player/source";

// Signed playback (Mux) for every video that has a Mux playback id, free or full access.
// Only ever called from the watch page and the review screens after the access check has passed, so a locked learner can never get one.

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

export type TokenOutcome =
  | { status: "tokens"; tokens: PlaybackTokens }
  /** Nothing to sign: the development sample clip, or a video with no playback id yet. */
  | { status: "not-needed" }
  /** A Mux video that cannot be played because no token could be made. The page shows a calm notice, never a broken player. */
  | { status: "unavailable"; reason: "no-signing-key" | "signing-failed" };

/**
 * Tokens for a Mux video, free or full access. Mux checks the playback id's own policy, not our access label: uploads are
 * created with signed playback, so a free video needs a token too (a public playback id simply ignores it). Who may watch
 * is decided before this is called, so a locked learner never reaches it.
 *
 * A failure is logged by reason and error name only, never the key, a token or a message that could contain either.
 */
export function issuePlaybackTokens(
  video: { playbackId?: string; durationSeconds: number },
  now: Date = new Date(),
  context: { videoSlug?: string } = {},
): TokenOutcome {
  const source = resolveSource(video.playbackId);
  if (source.kind !== "mux") return { status: "not-needed" };
  const { MUX_SIGNING_KEY_ID: keyId, MUX_SIGNING_PRIVATE_KEY: key } = env();
  if (!keyId || !key) {
    console.error("[playback] no token issued", { reason: "no-signing-key", video: context.videoSlug });
    return { status: "unavailable", reason: "no-signing-key" };
  }
  try {
    return { status: "tokens", tokens: signTokens(source.playbackId, video.durationSeconds, keyId, key, now) };
  } catch (error) {
    console.error("[playback] no token issued", {
      reason: "signing-failed",
      video: context.videoSlug,
      error: error instanceof Error ? error.name : "unknown",
      code: (error as { code?: unknown })?.code,
    });
    return { status: "unavailable", reason: "signing-failed" };
  }
}

/** Tokens for a Mux video, or null when none are needed or none could be made. Prefer `issuePlaybackTokens`, which says which. */
export function signPlaybackTokens(
  video: { playbackId?: string; durationSeconds: number },
  now: Date = new Date(),
  context: { videoSlug?: string } = {},
): PlaybackTokens | null {
  const outcome = issuePlaybackTokens(video, now, context);
  return outcome.status === "tokens" ? outcome.tokens : null;
}

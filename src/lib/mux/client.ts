import "server-only";
import Mux from "@mux/mux-node";
import { env } from "@/lib/env";

// The Mux API client, made on first use from the settings. Null when uploads are not set up (the three Mux settings are
// optional), so nothing fails at build time and the upload page can say so calmly.

let cached: Mux | null | undefined;

export function muxClient(): Mux | null {
  if (cached !== undefined) return cached;
  const { MUX_TOKEN_ID: tokenId, MUX_TOKEN_SECRET: tokenSecret, MUX_WEBHOOK_SECRET: webhookSecret } = env();
  cached = tokenId && tokenSecret && webhookSecret ? new Mux({ tokenId, tokenSecret, webhookSecret }) : null;
  return cached;
}

export const uploadsEnabled = (): boolean => muxClient() !== null;

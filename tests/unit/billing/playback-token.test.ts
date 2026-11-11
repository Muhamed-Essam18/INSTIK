import { generateKeyPairSync, createVerify } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ env: vi.fn() }));
vi.mock("@/lib/env", () => ({ env: mocks.env }));

import { signPlaybackTokens, signTokens, tokenLifetimeSeconds } from "@/lib/billing/playback";

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const privateB64 = Buffer.from(pem).toString("base64");
const now = new Date("2026-11-09T12:00:00Z");
const nowSeconds = Math.floor(now.getTime() / 1000);

const decode = (token: string) => {
  const [h, p] = token.split(".");
  return { header: JSON.parse(Buffer.from(h, "base64url").toString()), payload: JSON.parse(Buffer.from(p, "base64url").toString()) };
};
const verifies = (token: string) => {
  const [h, p, s] = token.split(".");
  return createVerify("RSA-SHA256").update(`${h}.${p}`).verify(publicKey, Buffer.from(s, "base64url"));
};

beforeEach(() => {
  mocks.env.mockReset();
  mocks.env.mockReturnValue({ MUX_SIGNING_KEY_ID: "kid-1", MUX_SIGNING_PRIVATE_KEY: privateB64 });
});

describe("signTokens", () => {
  it("makes three RS256 tokens that verify with the public key", () => {
    const tokens = signTokens("pb123", 500, "kid-1", privateB64, now);
    for (const token of Object.values(tokens)) expect(verifies(token)).toBe(true);
  });

  it("sets kid, subject, audience and expiry", () => {
    const tokens = signTokens("pb123", 500, "kid-1", privateB64, now);
    expect(decode(tokens.playback)).toEqual({
      header: { alg: "RS256", typ: "JWT", kid: "kid-1" },
      payload: { sub: "pb123", aud: "v", exp: nowSeconds + 3600 },
    });
    expect(decode(tokens.thumbnail).payload.aud).toBe("t");
    expect(decode(tokens.storyboard).payload.aud).toBe("s");
  });

  it("lasts an hour for a short video and twice the length for a long one", () => {
    expect(tokenLifetimeSeconds(500)).toBe(3600);
    expect(tokenLifetimeSeconds(3000)).toBe(6000);
    expect(decode(signTokens("pb", 3000, "k", privateB64, now).playback).payload.exp).toBe(nowSeconds + 6000);
  });
});

describe("signPlaybackTokens", () => {
  const full = { playbackId: "pb123", access: "full", durationSeconds: 500 };

  it("signs a full-access Mux video", () => {
    const tokens = signPlaybackTokens(full, now);
    expect(tokens && verifies(tokens.playback)).toBe(true);
  });

  it("returns null for a free video", () => {
    expect(signPlaybackTokens({ ...full, access: "free" }, now)).toBeNull();
  });

  it("returns null for the sample clip and for no playback id", () => {
    expect(signPlaybackTokens({ ...full, playbackId: "sample-clip" }, now)).toBeNull();
    expect(signPlaybackTokens({ ...full, playbackId: undefined }, now)).toBeNull();
  });

  it("returns null when the signing settings are missing", () => {
    mocks.env.mockReturnValue({});
    expect(signPlaybackTokens(full, now)).toBeNull();
  });

  it("never puts a token or the key in an error message", () => {
    mocks.env.mockReturnValue({ MUX_SIGNING_KEY_ID: "kid-1", MUX_SIGNING_PRIVATE_KEY: Buffer.from("not a key").toString("base64") });
    let message = "";
    try {
      signPlaybackTokens(full, now);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).not.toContain("not a key");
  });
});

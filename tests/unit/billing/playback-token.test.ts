import { generateKeyPairSync, createVerify } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ env: vi.fn() }));
vi.mock("@/lib/env", () => ({ env: mocks.env }));

import { issuePlaybackTokens, signPlaybackTokens, signTokens, tokenLifetimeSeconds } from "@/lib/billing/playback";

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

const logged = vi.spyOn(console, "error").mockImplementation(() => {});

beforeEach(() => {
  logged.mockClear();
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

describe("issuePlaybackTokens", () => {
  const video = { playbackId: "pb123", durationSeconds: 500 };

  it("signs a Mux video whatever its access label: a free upload has a signed playback id too", () => {
    const outcome = issuePlaybackTokens(video, now);
    expect(outcome.status).toBe("tokens");
    if (outcome.status === "tokens") expect(verifies(outcome.tokens.playback)).toBe(true);
    // The access label is not an input: the caller has already decided who may watch, and a locked learner never gets here.
    expect(issuePlaybackTokens({ ...video, access: "free" } as typeof video, now).status).toBe("tokens");
    expect(issuePlaybackTokens({ ...video, access: "full" } as typeof video, now).status).toBe("tokens");
  });

  it("needs nothing for the sample clip or a video with no playback id", () => {
    expect(issuePlaybackTokens({ ...video, playbackId: "sample-clip" }, now)).toEqual({ status: "not-needed" });
    expect(issuePlaybackTokens({ ...video, playbackId: undefined }, now)).toEqual({ status: "not-needed" });
    expect(logged).not.toHaveBeenCalled();
  });

  it("says unavailable, and logs the reason and the video, when the signing settings are missing", () => {
    mocks.env.mockReturnValue({});
    expect(issuePlaybackTokens(video, now, { videoSlug: "video-upload-test-3" })).toEqual({ status: "unavailable", reason: "no-signing-key" });
    expect(logged).toHaveBeenCalledWith("[playback] no token issued", { reason: "no-signing-key", video: "video-upload-test-3" });
  });

  it("says unavailable instead of throwing when the key cannot sign, and logs only the error name", () => {
    const badKey = Buffer.from("not a key").toString("base64");
    mocks.env.mockReturnValue({ MUX_SIGNING_KEY_ID: "kid-1", MUX_SIGNING_PRIVATE_KEY: badKey });
    expect(issuePlaybackTokens(video, now, { videoSlug: "v" })).toEqual({ status: "unavailable", reason: "signing-failed" });
    expect(logged).toHaveBeenCalledTimes(1);
    const text = JSON.stringify(logged.mock.calls);
    expect(text).toContain("signing-failed");
    for (const secret of [badKey, "not a key", "kid-1", "pb123"]) expect(text).not.toContain(secret);
  });
});

describe("signPlaybackTokens", () => {
  const video = { playbackId: "pb123", durationSeconds: 500 };

  it("returns the tokens, or null when none are needed or none could be made", () => {
    const tokens = signPlaybackTokens(video, now);
    expect(tokens && verifies(tokens.playback)).toBe(true);
    expect(signPlaybackTokens({ ...video, playbackId: "sample-clip" }, now)).toBeNull();
    mocks.env.mockReturnValue({});
    expect(signPlaybackTokens(video, now)).toBeNull();
  });
});

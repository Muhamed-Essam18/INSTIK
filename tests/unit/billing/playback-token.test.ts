import { generateKeyPairSync, createVerify } from "node:crypto";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ env: vi.fn() }));
vi.mock("@/lib/env", () => ({ env: mocks.env }));

import { signPlaybackTokens, signPreviewTokens, signTokens, tokenLifetimeSeconds } from "@/lib/billing/playback";

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

describe("signPreviewTokens (owner review and a creator's own video)", () => {
  it("signs all three tokens for the video's own playback id, whatever the access", () => {
    const tokens = signPreviewTokens({ playbackId: "pb123", durationSeconds: 500 }, now)!;
    expect(decode(tokens.playback).payload).toMatchObject({ sub: "pb123", aud: "v" });
    expect(decode(tokens.thumbnail).payload).toMatchObject({ sub: "pb123", aud: "t" });
    expect(decode(tokens.storyboard).payload).toMatchObject({ sub: "pb123", aud: "s" });
    for (const token of Object.values(tokens)) expect(verifies(token)).toBe(true);
  });

  it("gives a token where the learner rule gives none (a free-access video)", () => {
    expect(signPlaybackTokens({ playbackId: "pb123", access: "free", durationSeconds: 500 }, now)).toBeNull();
    expect(signPreviewTokens({ playbackId: "pb123", durationSeconds: 500 }, now)).not.toBeNull();
  });

  it("returns null for no playback id, the sample clip or missing signing settings", () => {
    expect(signPreviewTokens({ playbackId: null }, now)).toBeNull();
    expect(signPreviewTokens({ playbackId: "sample-clip" }, now)).toBeNull();
    mocks.env.mockReturnValue({});
    expect(signPreviewTokens({ playbackId: "pb123" }, now)).toBeNull();
  });
});

describe("who may call which signer", () => {
  const read = (file: string) => readFileSync(file, "utf8");
  const users = (name: string) =>
    ["src/components/screens/OwnerReviewScreen.tsx", "src/app/(creator)/creator/videos/[id]/page.tsx", "src/components/screens/WatchScreen.tsx"].filter((f) => read(f).includes(name));

  it("only the owner review screen and a creator's own video page use the preview signer", () => {
    expect(users("signPreviewTokens")).toEqual(["src/components/screens/OwnerReviewScreen.tsx", "src/app/(creator)/creator/videos/[id]/page.tsx"]);
  });

  it("the learner watch page keeps the subscription rule and never the preview signer", () => {
    expect(users("signPlaybackTokens")).toEqual(["src/components/screens/WatchScreen.tsx"]);
  });

  it("the review screen requires an owner and the creator page requires the creator before signing", () => {
    expect(read("src/components/screens/OwnerReviewScreen.tsx")).toMatch(/requireOwner[\s\S]*signPreviewTokens/);
    expect(read("src/app/(creator)/creator/videos/[id]/page.tsx")).toMatch(/requireCreator[\s\S]*getOwnPlayback[\s\S]*signPreviewTokens/);
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

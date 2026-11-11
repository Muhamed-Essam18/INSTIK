import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env";

const valid = {
  DATABASE_URL: "postgresql://user:secret@host/db?sslmode=require",
  DIRECT_URL: "postgres://user:secret@direct-host/db",
  AUTH_SECRET: "x".repeat(32),
  AUTH_GOOGLE_ID: "google-id",
  AUTH_GOOGLE_SECRET: "google-secret",
  AUTH_RESEND_KEY: "re_123",
  EMAIL_FROM: "Instik <hello@example.com>",
  IP_HASH_SALT: "s".repeat(16),
};

const message = (fn: () => unknown): string => {
  try {
    fn();
  } catch (error) {
    return (error as Error).message;
  }
  return "";
};

describe("billing environment", () => {
  it("parses with no Stripe or Mux settings", () => {
    expect(parseEnv(valid).STRIPE_SECRET_KEY).toBeUndefined();
  });

  it("accepts a test-mode key", () => {
    expect(parseEnv({ ...valid, STRIPE_SECRET_KEY: "sk_test_abc" }).STRIPE_SECRET_KEY).toBe("sk_test_abc");
  });

  it("refuses a live key without BILLING_LIVE, naming the variable and not the key", () => {
    const text = message(() => parseEnv({ ...valid, STRIPE_SECRET_KEY: "sk_live_supersecret" }));
    expect(text).toContain("STRIPE_SECRET_KEY");
    expect(text).not.toContain("supersecret");
  });

  it("accepts a live key with BILLING_LIVE=true", () => {
    expect(parseEnv({ ...valid, STRIPE_SECRET_KEY: "sk_live_abc", BILLING_LIVE: "true" }).BILLING_LIVE).toBe("true");
  });

  it("treats an empty string as unset", () => {
    expect(parseEnv({ ...valid, STRIPE_SECRET_KEY: "", BILLING_LIVE: "" }).STRIPE_SECRET_KEY).toBeUndefined();
  });

  it("needs both Mux signing settings or neither, and names the missing one", () => {
    expect(message(() => parseEnv({ ...valid, MUX_SIGNING_KEY_ID: "kid" }))).toContain("MUX_SIGNING_PRIVATE_KEY");
    expect(message(() => parseEnv({ ...valid, MUX_SIGNING_PRIVATE_KEY: "pem" }))).toContain("MUX_SIGNING_KEY_ID");
    expect(parseEnv({ ...valid, MUX_SIGNING_KEY_ID: "kid", MUX_SIGNING_PRIVATE_KEY: "pem" }).MUX_SIGNING_KEY_ID).toBe("kid");
  });
});

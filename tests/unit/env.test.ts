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

describe("parseEnv", () => {
  it("parses a complete environment", () => {
    expect(parseEnv(valid).AUTH_GOOGLE_ID).toBe("google-id");
  });

  it("treats AUTH_URL as optional", () => {
    expect(parseEnv(valid).AUTH_URL).toBeUndefined();
    expect(parseEnv({ ...valid, AUTH_URL: "https://instik.example" }).AUTH_URL).toBe("https://instik.example");
  });

  it("names every missing variable and never prints a value", () => {
    const { DATABASE_URL: _a, AUTH_RESEND_KEY: _b, ...rest } = valid;
    void _a;
    void _b;
    let message = "";
    try {
      parseEnv({ ...rest, AUTH_SECRET: "too-short-secret-value" });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toBe(
      "Missing or invalid environment variables: DATABASE_URL, AUTH_SECRET, AUTH_RESEND_KEY (see .env.example)",
    );
    expect(message).not.toContain("too-short-secret-value");
  });

  it("requires postgres connection strings", () => {
    expect(() => parseEnv({ ...valid, DATABASE_URL: "mysql://host/db" })).toThrow(/DATABASE_URL/);
    expect(() => parseEnv({ ...valid, DIRECT_URL: "http://host" })).toThrow(/DIRECT_URL/);
  });

  it("requires AUTH_SECRET of at least 32 characters and IP_HASH_SALT of at least 16", () => {
    expect(() => parseEnv({ ...valid, AUTH_SECRET: "x".repeat(31) })).toThrow(/AUTH_SECRET/);
    expect(() => parseEnv({ ...valid, IP_HASH_SALT: "s".repeat(15) })).toThrow(/IP_HASH_SALT/);
  });

  it("treats empty strings as missing", () => {
    expect(() => parseEnv({ ...valid, AUTH_GOOGLE_ID: "" })).toThrow(/AUTH_GOOGLE_ID/);
  });
});

import { describe, expect, it } from "vitest";
import {
  emailsMatch,
  expiryFrom,
  hashToken,
  inviteInputSchema,
  inviteState,
  newToken,
  slugFromName,
} from "@/lib/invites/rules";

const base = { usedAt: null, revokedAt: null, expiresAt: new Date("2026-11-18T10:00:00Z") };

describe("tokens", () => {
  it("are 32 random bytes in base64url and never repeat", () => {
    const a = newToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newToken()).not.toBe(a);
  });

  it("are stored only as a SHA-256 hash that is not the token", () => {
    const token = newToken();
    const hash = hashToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toBe(token);
    expect(hashToken(token)).toBe(hash);
    expect(hashToken(newToken())).not.toBe(hash);
  });
});

describe("expiry", () => {
  it("is exactly 7 days after creation", () => {
    const created = new Date("2026-11-11T10:00:00Z");
    expect(expiryFrom(created).toISOString()).toBe("2026-11-18T10:00:00.000Z");
  });
});

describe("inviteState", () => {
  const expires = base.expiresAt;

  it("is pending until the expiry time and expired from it on (7 days and one millisecond)", () => {
    expect(inviteState(base, new Date(expires.getTime() - 1))).toBe("pending");
    expect(inviteState(base, expires)).toBe("expired");
    expect(inviteState(base, new Date(expires.getTime() + 1))).toBe("expired");
  });

  it("prefers used over revoked over expired", () => {
    const later = new Date(expires.getTime() + 1000);
    const at = new Date("2026-11-12T00:00:00Z");
    expect(inviteState({ ...base, usedAt: at, revokedAt: at }, later)).toBe("used");
    expect(inviteState({ ...base, revokedAt: at }, later)).toBe("revoked");
    expect(inviteState({ ...base, revokedAt: at }, new Date("2026-11-12T01:00:00Z"))).toBe("revoked");
  });
});

describe("emailsMatch", () => {
  it("ignores case and surrounding spaces", () => {
    expect(emailsMatch(" Sam@Example.com ", "sam@example.com")).toBe(true);
    expect(emailsMatch("sam@example.com", "other@example.com")).toBe(false);
  });
});

describe("inviteInputSchema", () => {
  it("trims the name and lower-cases the email", () => {
    expect(inviteInputSchema.parse({ name: "  Mona Ali ", email: " Mona@Example.COM " })).toEqual({
      name: "Mona Ali",
      email: "mona@example.com",
    });
  });

  it("refuses an empty or too long name and a bad email", () => {
    expect(inviteInputSchema.safeParse({ name: "   ", email: "a@b.co" }).success).toBe(false);
    expect(inviteInputSchema.safeParse({ name: "x".repeat(121), email: "a@b.co" }).success).toBe(false);
    expect(inviteInputSchema.safeParse({ name: "x".repeat(120), email: "a@b.co" }).success).toBe(true);
    expect(inviteInputSchema.safeParse({ name: "Mona", email: "not-an-email" }).success).toBe(false);
    expect(inviteInputSchema.safeParse({ name: "Mona", email: `${"a".repeat(250)}@b.co` }).success).toBe(false);
  });
});

describe("slugFromName", () => {
  const none = new Set<string>();

  it("makes a lower-case slug without accents", () => {
    expect(slugFromName("Mona El-Sayed", none)).toBe("mona-el-sayed");
    expect(slugFromName("José Núñez", none)).toBe("jose-nunez");
  });

  it("adds a number when the slug is taken", () => {
    expect(slugFromName("Omar", new Set(["omar"]))).toBe("omar-2");
    expect(slugFromName("Omar", new Set(["omar", "omar-2"]))).toBe("omar-3");
  });

  it("falls back to a safe slug for Arabic, empty or symbol-only names", () => {
    expect(slugFromName("منى", none)).toBe("creator");
    expect(slugFromName("   ", none)).toBe("creator");
    expect(slugFromName("!!!", none)).toBe("creator");
    expect(slugFromName("منى", new Set(["creator"]))).toBe("creator-2");
  });

  it("always matches the host slug rule", () => {
    for (const name of ["A", "a b c", "x".repeat(200), "Dr. Who?", "--a--"]) {
      expect(slugFromName(name, none)).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });
});

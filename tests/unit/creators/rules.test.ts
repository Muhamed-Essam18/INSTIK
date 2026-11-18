import { describe, expect, it } from "vitest";
import { buildRows, creatorStatus, type CreatorData, type InviteData } from "@/lib/creators/rules";

const now = new Date("2026-11-13T10:00:00Z");
const day = 86_400_000;

const creator = (extra: Partial<CreatorData> & Pick<CreatorData, "id">): CreatorData => ({
  email: `${extra.id}@x.com`,
  name: extra.id,
  pausedAt: null,
  counts: { live: 0, inReview: 0, changes: 0 },
  ...extra,
});
const invite = (extra: Partial<InviteData> & Pick<InviteData, "id" | "email">): InviteData => ({
  name: extra.email.split("@")[0],
  createdAt: new Date(now.getTime() - 2 * day),
  expiresAt: new Date(now.getTime() + 5 * day),
  usedAt: null,
  revokedAt: null,
  ...extra,
});

describe("creatorStatus", () => {
  it("is Paused over Active", () => {
    expect(creatorStatus({ pausedAt: null })).toBe("Active");
    expect(creatorStatus({ pausedAt: new Date() })).toBe("Paused");
  });
});

describe("buildRows", () => {
  it("lists creators by name with their counts and status", () => {
    const rows = buildRows(
      [
        creator({ id: "zed", name: "Zed", counts: { live: 3, inReview: 1, changes: 2 } }),
        creator({ id: "amy", name: "Amy", pausedAt: new Date("2026-11-01") }),
      ],
      [],
      now,
    );
    expect(rows.map((r) => [r.name, r.status])).toEqual([
      ["Amy", "Paused"],
      ["Zed", "Active"],
    ]);
    expect(rows[1]).toMatchObject({ kind: "creator", live: 3, inReview: 1, changes: 2, expired: false });
  });

  it("adds Invited only for someone with no creator account, newest first", () => {
    const rows = buildRows(
      [creator({ id: "amy", email: "amy@x.com" })],
      [
        invite({ id: "i1", email: "old@x.com", createdAt: new Date(now.getTime() - 3 * day) }),
        invite({ id: "i2", email: "new@x.com", createdAt: new Date(now.getTime() - 1 * day) }),
        // Amy already has an account, so her accepted invitation is not a row of its own.
        invite({ id: "i3", email: "amy@x.com", usedAt: new Date(now.getTime() - day) }),
      ],
      now,
    );
    expect(rows.map((r) => [r.id, r.status])).toEqual([
      ["amy", "Active"],
      ["i2", "Invited"],
      ["i1", "Invited"],
    ]);
  });

  it("shows an expired invitation as Invited with an Expired mark", () => {
    const rows = buildRows([], [invite({ id: "i1", email: "a@x.com", expiresAt: new Date(now.getTime() - 1000) })], now);
    expect(rows[0]).toMatchObject({ status: "Invited", expired: true });
    expect(buildRows([], [invite({ id: "i2", email: "b@x.com" })], now)[0].expired).toBe(false);
  });

  it("leaves out used and revoked invitations, and judges an address by its newest invitation", () => {
    const rows = buildRows(
      [],
      [
        invite({ id: "used", email: "u@x.com", usedAt: now }),
        invite({ id: "revoked", email: "r@x.com", revokedAt: now }),
        // Revoked earlier, resent later: only the newer, pending one counts.
        invite({ id: "old", email: "m@x.com", revokedAt: now, createdAt: new Date(now.getTime() - 3 * day) }),
        invite({ id: "new", email: "m@x.com", createdAt: new Date(now.getTime() - 1 * day) }),
        // Pending earlier, revoked later: gone.
        invite({ id: "p", email: "q@x.com", createdAt: new Date(now.getTime() - 3 * day) }),
        invite({ id: "q", email: "q@x.com", revokedAt: now, createdAt: new Date(now.getTime() - 1 * day) }),
      ],
      now,
    );
    expect(rows.map((r) => r.id)).toEqual(["new"]);
  });

  it("matches emails without regard to case", () => {
    const rows = buildRows([creator({ id: "amy", email: "Amy@X.com" })], [invite({ id: "i1", email: "amy@x.com" })], now);
    expect(rows.map((r) => r.kind)).toEqual(["creator"]);
  });
});

import { inviteState } from "@/lib/invites/rules";

// The owner's view of creators (spec 10): who is active, invited or paused, and the counts beside them. Pure: no database.

export type CreatorStatus = "Active" | "Invited" | "Paused";

export type CreatorData = {
  /** The creator's account id. */
  id: string;
  email: string;
  name: string;
  pausedAt: Date | null;
  counts: { live: number; inReview: number; changes: number };
};

export type InviteData = {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
};

export type CreatorRow = {
  /** The account id for a creator; the invitation id for someone invited who has not joined. */
  id: string;
  kind: "creator" | "invitee";
  name: string;
  email: string;
  status: CreatorStatus;
  /** An invitation that ran out: still shown as Invited, with a mark, and can be resent. */
  expired: boolean;
  live: number;
  inReview: number;
  changes: number;
};

/** Paused over Active; Invited only when there is no creator account yet. */
export const creatorStatus = (creator: { pausedAt: Date | null }): "Active" | "Paused" => (creator.pausedAt ? "Paused" : "Active");

/**
 * The Creators table: every creator (with the counts of their live, in-review and changes-requested videos, which exclude deleted ones)
 * followed by everyone whose newest invitation is still pending or has expired and who has no creator account.
 */
export function buildRows(creators: readonly CreatorData[], invites: readonly InviteData[], now: Date): CreatorRow[] {
  const accounts = creators
    .map<CreatorRow>((c) => ({
      id: c.id,
      kind: "creator",
      name: c.name,
      email: c.email,
      status: creatorStatus(c),
      expired: false,
      live: c.counts.live,
      inReview: c.counts.inReview,
      changes: c.counts.changes,
    }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.email.localeCompare(b.email));

  const have = new Set(creators.map((c) => c.email.trim().toLowerCase()));
  const newest = new Map<string, InviteData>();
  for (const invite of invites) {
    const key = invite.email.trim().toLowerCase();
    const seen = newest.get(key);
    if (!seen || invite.createdAt.getTime() > seen.createdAt.getTime()) newest.set(key, invite);
  }
  const invitees = [...newest.values()]
    .filter((i) => !have.has(i.email.trim().toLowerCase()))
    .map((i) => ({ invite: i, state: inviteState(i, now) }))
    .filter(({ state }) => state === "pending" || state === "expired")
    .sort((a, b) => b.invite.createdAt.getTime() - a.invite.createdAt.getTime())
    .map<CreatorRow>(({ invite, state }) => ({
      id: invite.id,
      kind: "invitee",
      name: invite.name,
      email: invite.email,
      status: "Invited",
      expired: state === "expired",
      live: 0,
      inReview: 0,
      changes: 0,
    }));

  return [...accounts, ...invitees];
}

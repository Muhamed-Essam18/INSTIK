import type { Actor } from "@/lib/roles/actor";
import { ForbiddenError } from "@/lib/roles/forbidden";
import { startOfMonth } from "@/lib/review/rules";
import { buildRows, creatorStatus, type CreatorData, type CreatorRow, type CreatorStatus, type InviteData } from "./rules";

// The owner's creator management (spec 10): the Creators table, pausing and resuming a creator, and one creator's content counts.
// The database (`CreatorsStore`) is passed in, so the rules are tested without it. Every function checks the owner role first.
// Counts are of content only: there are no counted views or earnings here.

export type CreatorProfile = {
  id: string;
  /** The role the account has; only creators are managed here. */
  role: "LEARNER" | "CREATOR";
  email: string;
  name: string;
  pausedAt: Date | null;
  joinedAt: Date;
};

export type StatusCounts = { live: number; inReview: number; changes: number; rejected: number; drafts: number };

export interface CreatorsTx {
  /** Locks the account row and returns it. Null when there is no such account. */
  lockUser(userId: string): Promise<{ id: string; role: "LEARNER" | "CREATOR"; email: string; pausedAt: Date | null } | null>;
  setPaused(userId: string, pausedAt: Date | null): Promise<void>;
  appendPauseEvent(event: { userId: string; kind: "PAUSED" | "RESUMED"; actorId: string; actorLabel: string }): Promise<void>;
}

export interface CreatorsStore {
  transaction<T>(work: (tx: CreatorsTx) => Promise<T>): Promise<T>;
  /** Creators in this language, with their host name and counts (soft-deleted videos excluded). */
  creators(languageCode: string): Promise<CreatorData[]>;
  /** Every invitation sent, newest first. */
  invites(): Promise<InviteData[]>;
  profile(creatorId: string): Promise<CreatorProfile | null>;
  counts(creatorId: string): Promise<StatusCounts>;
  approvedSince(creatorId: string, since: Date): Promise<number>;
  lastUploadAt(creatorId: string): Promise<Date | null>;
}

export type Deps = {
  store: CreatorsStore;
  /** The owner list, already parsed: an owner is never paused. */
  ownerEmails: readonly string[];
  defaultLanguageCode: string;
  now?: () => Date;
};

export type CreatorStats = {
  id: string;
  name: string;
  email: string;
  status: Exclude<CreatorStatus, "Invited">;
  counts: StatusCounts;
  approvedThisMonth: number;
  joinedAt: Date;
  lastUploadAt: Date | null;
};

export type PauseResult = { ok: true; changed: boolean } | { ok: false; reason: "not-a-creator" };

const labelOf = (actor: Actor) => actor.name?.trim() || actor.email.trim() || "unknown";

export function createCreatorsService(deps: Deps) {
  const now = () => (deps.now ? deps.now() : new Date());
  const owner = (actor: Actor | null | undefined): Actor => {
    if (!actor || actor.role !== "owner") throw new ForbiddenError();
    return actor;
  };
  const isOwnerEmail = (email: string) => deps.ownerEmails.includes(email.trim().toLowerCase());

  async function listCreators(actor: Actor | null | undefined): Promise<CreatorRow[]> {
    owner(actor);
    const [creators, invites] = await Promise.all([deps.store.creators(deps.defaultLanguageCode), deps.store.invites()]);
    return buildRows(creators, invites, now());
  }

  async function getCreatorStats(actor: Actor | null | undefined, creatorId: string): Promise<CreatorStats | null> {
    owner(actor);
    const profile = await deps.store.profile(creatorId);
    if (!profile || profile.role !== "CREATOR") return null;
    const [counts, approvedThisMonth, lastUploadAt] = await Promise.all([
      deps.store.counts(creatorId),
      deps.store.approvedSince(creatorId, startOfMonth(now())),
      deps.store.lastUploadAt(creatorId),
    ]);
    return {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      status: creatorStatus(profile),
      counts,
      approvedThisMonth,
      joinedAt: profile.joinedAt,
      lastUploadAt,
    };
  }

  /** Pauses or resumes. Idempotent: asking for the state the creator is already in changes nothing and records nothing. */
  async function setPause(actor: Actor | null | undefined, creatorId: string, paused: boolean): Promise<PauseResult> {
    const who = owner(actor);
    return deps.store.transaction(async (tx) => {
      const user = await tx.lockUser(creatorId);
      // Only a creator can be paused: not a learner, and never an owner.
      if (!user || user.role !== "CREATOR" || isOwnerEmail(user.email)) return { ok: false, reason: "not-a-creator" } as const;
      if ((user.pausedAt !== null) === paused) return { ok: true, changed: false } as const;
      await tx.setPaused(user.id, paused ? now() : null);
      await tx.appendPauseEvent({ userId: user.id, kind: paused ? "PAUSED" : "RESUMED", actorId: who.id, actorLabel: labelOf(who) });
      return { ok: true, changed: true } as const;
    });
  }

  return {
    listCreators,
    getCreatorStats,
    pauseCreator: (actor: Actor | null | undefined, creatorId: string) => setPause(actor, creatorId, true),
    resumeCreator: (actor: Actor | null | undefined, creatorId: string) => setPause(actor, creatorId, false),
  };
}

export type CreatorsService = ReturnType<typeof createCreatorsService>;

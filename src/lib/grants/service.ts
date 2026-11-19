import type { Actor } from "@/lib/roles/actor";
import { ForbiddenError } from "@/lib/roles/forbidden";

// Manual full access (spec 11 User Story 5): an owner gives or removes Full access for any existing account by hand (testing, creators, gifts).
// The account then has Full access through the one access rule (`hasFullAccess`), like a paying learner, and its watching counts toward
// counted views. Every grant and removal is recorded with who, when, why and a note; records are never edited or deleted.
// The database (`GrantsStore`) is passed in, so the rules are tested without it. Every function checks the owner role first.

export type GrantReason = "TESTING" | "CREATOR" | "GIFT" | "OTHER";
export const GRANT_REASONS: readonly GrantReason[] = ["TESTING", "CREATOR", "GIFT", "OTHER"];
export const MAX_NOTE = 200;
const HISTORY = 100;

export type GrantAccount = { id: string; email: string; name: string | null; manualAccessAt: Date | null };

export type GrantEventRecord = {
  id: string;
  userId: string;
  email: string;
  accountName: string | null;
  kind: "GRANTED" | "REMOVED";
  reason: GrantReason;
  note: string | null;
  byName: string | null;
  at: Date;
};

export type ActiveGrant = { userId: string; email: string; name: string | null; since: Date; reason: GrantReason | null; note: string | null; byName: string | null };

export interface GrantsTx {
  /** Locks the account row (found by lower-cased email) and returns it; null when there is no such account. */
  lockAccount(email: string): Promise<GrantAccount | null>;
  /** The reason of the account's most recent grant, so a removal can repeat it. */
  latestGrantReason(userId: string): Promise<GrantReason | null>;
  /** Sets or clears `User.manualAccessAt`. It never touches the account's subscription. */
  setManualAccess(userId: string, at: Date | null): Promise<void>;
  appendEvent(event: { userId: string; kind: "GRANTED" | "REMOVED"; reason: GrantReason; note: string | null; byId: string; at: Date }): Promise<void>;
}

export interface GrantsStore {
  transaction<T>(work: (tx: GrantsTx) => Promise<T>): Promise<T>;
  active(): Promise<ActiveGrant[]>;
  /** The most recent events, newest first, at most `limit`, with the account's email and the owner's name. */
  events(limit: number): Promise<GrantEventRecord[]>;
}

export type Deps = { store: GrantsStore; now?: () => Date };

export type GrantRefusal = "email" | "reason" | "note-too-long" | "no-account" | "already-granted";
export type RemoveRefusal = "email" | "note-too-long" | "no-account" | "no-grant";
export type GrantResult = { ok: true; email: string } | { ok: false; reason: GrantRefusal };
export type RemoveResult = { ok: true; email: string } | { ok: false; reason: RemoveRefusal };
export type GrantsView = { active: ActiveGrant[]; events: GrantEventRecord[]; truncated: boolean };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normalise = (email: string) => email.trim().toLowerCase();

const owner = (actor: Actor | null | undefined): Actor => {
  if (!actor || actor.role !== "owner") throw new ForbiddenError();
  return actor;
};

export function createGrantsService(deps: Deps) {
  const now = () => (deps.now ? deps.now() : new Date());
  const cleanNote = (note: string | undefined): { ok: true; value: string | null } | { ok: false } => {
    const value = (note ?? "").trim();
    if (value.length > MAX_NOTE) return { ok: false };
    return { ok: true, value: value === "" ? null : value };
  };

  /** Gives an existing account Full access by hand. Refused for an unknown email, an account that already has a grant, or a bad reason or note. */
  async function grantAccess(actor: Actor | null | undefined, input: { email: string; reason: string; note?: string }): Promise<GrantResult> {
    const who = owner(actor);
    const email = normalise(input.email);
    if (!EMAIL.test(email)) return { ok: false, reason: "email" };
    if (!(GRANT_REASONS as readonly string[]).includes(input.reason)) return { ok: false, reason: "reason" };
    const note = cleanNote(input.note);
    if (!note.ok) return { ok: false, reason: "note-too-long" };

    return deps.store.transaction(async (tx): Promise<GrantResult> => {
      const account = await tx.lockAccount(email);
      if (!account) return { ok: false, reason: "no-account" };
      if (account.manualAccessAt !== null) return { ok: false, reason: "already-granted" };
      const at = now();
      await tx.setManualAccess(account.id, at);
      await tx.appendEvent({ userId: account.id, kind: "GRANTED", reason: input.reason as GrantReason, note: note.value, byId: who.id, at });
      return { ok: true, email };
    });
  }

  /** Removes a grant an owner made. The account's own paid subscription, if it has one, is never touched. */
  async function removeAccess(actor: Actor | null | undefined, input: { email: string; note?: string }): Promise<RemoveResult> {
    const who = owner(actor);
    const email = normalise(input.email);
    if (!EMAIL.test(email)) return { ok: false, reason: "email" };
    const note = cleanNote(input.note);
    if (!note.ok) return { ok: false, reason: "note-too-long" };

    return deps.store.transaction(async (tx): Promise<RemoveResult> => {
      const account = await tx.lockAccount(email);
      if (!account) return { ok: false, reason: "no-account" };
      if (account.manualAccessAt === null) return { ok: false, reason: "no-grant" };
      const reason = (await tx.latestGrantReason(account.id)) ?? "OTHER";
      await tx.setManualAccess(account.id, null);
      await tx.appendEvent({ userId: account.id, kind: "REMOVED", reason, note: note.value, byId: who.id, at: now() });
      return { ok: true, email };
    });
  }

  /** The accounts that have a grant now, then the most recent events (at most 100), so the page can show who did what and when. */
  async function listGrants(actor: Actor | null | undefined): Promise<GrantsView> {
    owner(actor);
    const [active, events] = await Promise.all([deps.store.active(), deps.store.events(HISTORY + 1)]);
    return { active, events: events.slice(0, HISTORY), truncated: events.length > HISTORY };
  }

  return { grantAccess, removeAccess, listGrants };
}

export type GrantsService = ReturnType<typeof createGrantsService>;

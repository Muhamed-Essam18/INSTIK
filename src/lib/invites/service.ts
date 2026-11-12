// Creator invitations: create, revoke, accept and list. The rules live in rules.ts; this file decides who may do what and
// puts the steps in order. It never touches the database or the mail service directly: both are passed in, so tests need neither.

import type { Actor } from "../roles/actor";
import { ForbiddenError } from "../roles/forbidden";
import {
  INVITES_PER_HOUR,
  emailsMatch,
  expiryFrom,
  hashToken,
  inviteInputSchema,
  inviteState,
  newToken,
  slugFromName,
  type InviteState,
} from "./rules";

export type InviteRecord = {
  id: string;
  name: string;
  email: string;
  tokenHash: string;
  invitedById: string;
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
  usedById: string | null;
  revokedAt: Date | null;
};

/** The steps of one transaction. Whatever the callback does is kept only if it returns; a throw undoes all of it. */
export interface InviteTx {
  /** Revokes every pending invitation for this email (a newer one replaces them). */
  revokePendingForEmail(email: string, now: Date): Promise<void>;
  createInvite(invite: Omit<InviteRecord, "id" | "usedAt" | "usedById" | "revokedAt">): Promise<InviteRecord>;
  /** Revokes the invitation only if it is still pending. */
  revokeIfPending(inviteId: string, now: Date): Promise<"revoked" | "not-pending" | "not-found">;
  findByTokenHash(tokenHash: string): Promise<InviteRecord | null>;
  /** Marks the invitation used, only if it is still unused, unrevoked and unexpired. False when someone else got there first. */
  claim(inviteId: string, userId: string, now: Date): Promise<boolean>;
  getUser(userId: string): Promise<{ id: string; email: string; role: "LEARNER" | "CREATOR" } | null>;
  /** Sets the creator role, only for a learner. False when the account is not a learner. */
  makeCreator(userId: string): Promise<boolean>;
  hostSlugsTaken(languageCode: string): Promise<ReadonlySet<string>>;
  nextHostOrder(languageCode: string): Promise<number>;
  createHost(host: { languageCode: string; slug: string; name: string; userId: string; order: number }): Promise<void>;
}

export interface InviteStore {
  transaction<T>(work: (tx: InviteTx) => Promise<T>): Promise<T>;
  list(): Promise<InviteRecord[]>;
  countCreatedSince(invitedById: string, since: Date): Promise<number>;
  /** The role of the account with this email, or null when there is none. */
  roleOfEmail(email: string): Promise<"LEARNER" | "CREATOR" | null>;
}

export type InviteMessage = { to: string; name: string; link: string; expiresAt: Date };
export type Mailer = (message: InviteMessage) => Promise<void>;

export type InviteDeps = {
  store: InviteStore;
  mailer: Mailer;
  /** The owner list, already parsed. */
  ownerEmails: readonly string[];
  /** Builds the absolute link for a token. */
  linkFor: (token: string) => string;
  /** The language a new creator profile is created in for now. */
  defaultLanguageCode: string;
  now?: () => Date;
  makeToken?: () => string;
};

export { ForbiddenError };

export type CreateResult =
  | { ok: true }
  | { ok: false; reason: "forbidden" }
  | { ok: false; reason: "invalid"; field: "name" | "email"; message: string }
  | { ok: false; reason: "already-on-team" | "already-creator"; field: "email" }
  | { ok: false; reason: "too-many" }
  | { ok: false; reason: "send-failed" };

export type RevokeResult = { ok: true } | { ok: false; reason: "forbidden" | "not-pending" | "not-found" };

export type AcceptResult = { ok: true } | { ok: false; reason: "invalid" | "wrong-email" | "already-privileged" };

export type ListedInvite = Pick<InviteRecord, "id" | "name" | "email" | "createdAt" | "expiresAt"> & { state: InviteState };

/** Thrown inside a transaction to undo it and report why. */
class Abort extends Error {
  constructor(readonly reason: "invalid" | "wrong-email" | "already-privileged") {
    super(reason);
  }
}

const HOUR_MS = 60 * 60 * 1000;

export function createInviteService(deps: InviteDeps) {
  const now = () => (deps.now ?? (() => new Date()))();
  const makeToken = deps.makeToken ?? newToken;
  const isOwnerEmail = (email: string) => deps.ownerEmails.includes(email.trim().toLowerCase());

  async function createInvite(input: { actor: Actor; name: string; email: string }): Promise<CreateResult> {
    if (input.actor.role !== "owner") return { ok: false, reason: "forbidden" };

    const parsed = inviteInputSchema.safeParse({ name: input.name, email: input.email });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue.path[0] === "name" ? "name" : "email";
      return { ok: false, reason: "invalid", field, message: field === "name" ? issue.message : "Enter a valid email address" };
    }
    const { name, email } = parsed.data;

    // An existing owner or creator is blocked before anything is created or sent (FR-031).
    if (isOwnerEmail(email)) return { ok: false, reason: "already-on-team", field: "email" };
    if ((await deps.store.roleOfEmail(email)) === "CREATOR") return { ok: false, reason: "already-creator", field: "email" };

    const createdAt = now();
    if ((await deps.store.countCreatedSince(input.actor.id, new Date(createdAt.getTime() - HOUR_MS))) >= INVITES_PER_HOUR) {
      return { ok: false, reason: "too-many" };
    }

    const token = makeToken();
    const expiresAt = expiryFrom(createdAt);
    // One transaction: the earlier pending invitations for this address stop working as the new one starts.
    const invite = await deps.store.transaction(async (tx) => {
      await tx.revokePendingForEmail(email, createdAt);
      return tx.createInvite({ name, email, tokenHash: hashToken(token), invitedById: input.actor.id, createdAt, expiresAt });
    });

    try {
      await deps.mailer({ to: email, name, link: deps.linkFor(token), expiresAt });
    } catch {
      // No pending invitation is left behind that nobody received.
      await deps.store.transaction((tx) => tx.revokeIfPending(invite.id, now()));
      return { ok: false, reason: "send-failed" };
    }
    return { ok: true };
  }

  async function revokeInvite(input: { actor: Actor; inviteId: string }): Promise<RevokeResult> {
    if (input.actor.role !== "owner") return { ok: false, reason: "forbidden" };
    const result = await deps.store.transaction((tx) => tx.revokeIfPending(input.inviteId, now()));
    return result === "revoked" ? { ok: true } : { ok: false, reason: result };
  }

  async function listInvites(input: { actor: Actor }): Promise<ListedInvite[]> {
    if (input.actor.role !== "owner") throw new ForbiddenError();
    const at = now();
    return (await deps.store.list())
      .map((i) => ({ id: i.id, name: i.name, email: i.email, createdAt: i.createdAt, expiresAt: i.expiresAt, state: inviteState(i, at) }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /** What the invite page needs before it shows the Accept button; changes nothing. */
  async function previewInvite(token: string): Promise<{ ok: true; name: string; email: string } | { ok: false }> {
    const found = await deps.store.transaction((tx) => tx.findByTokenHash(hashToken(token)));
    if (!found || inviteState(found, now()) !== "pending") return { ok: false };
    return { ok: true, name: found.name, email: found.email };
  }

  async function acceptInvite(input: { account: { id: string; email: string }; token: string }): Promise<AcceptResult> {
    const at = now();
    try {
      await deps.store.transaction(async (tx) => {
        const invite = await tx.findByTokenHash(hashToken(input.token));
        // Unknown, used, expired, revoked and superseded all look the same, and nothing changes.
        if (!invite || inviteState(invite, at) !== "pending") throw new Abort("invalid");
        // The invitation belongs to the address it was sent to.
        if (!emailsMatch(invite.email, input.account.email)) throw new Abort("wrong-email");
        const user = await tx.getUser(input.account.id);
        if (!user) throw new Abort("invalid");
        if (user.role === "CREATOR" || isOwnerEmail(user.email)) throw new Abort("already-privileged");

        // The claim is conditional, so of two people opening the same link at once only one gets past it.
        if (!(await tx.claim(invite.id, user.id, at))) throw new Abort("invalid");
        if (!(await tx.makeCreator(user.id))) throw new Abort("already-privileged");

        const taken = await tx.hostSlugsTaken(deps.defaultLanguageCode);
        await tx.createHost({
          languageCode: deps.defaultLanguageCode,
          slug: slugFromName(invite.name, taken),
          name: invite.name,
          userId: user.id,
          order: await tx.nextHostOrder(deps.defaultLanguageCode),
        });
      });
      return { ok: true };
    } catch (error) {
      if (error instanceof Abort) return { ok: false, reason: error.reason };
      throw error;
    }
  }

  return { createInvite, revokeInvite, listInvites, previewInvite, acceptInvite };
}

export type InviteService = ReturnType<typeof createInviteService>;

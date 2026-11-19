import { stageSlugs, topicSlugs } from "@/lib/content/taxonomy";
import { hasRole, type Actor } from "@/lib/roles/actor";
import { ForbiddenError } from "@/lib/roles/forbidden";

// Content requests (spec 11 User Story 6): short notes from the owners about the video learners need next (a stage, a topic and a sentence or two),
// shown to every creator on their dashboard while open. Owners write, edit and close them; creators and owners read the open ones, newest first, at
// most 20 (the list ends); learners never see them. The database (`RequestsStore`) is passed in, so the rules are tested without it.

export const MAX_TEXT = 200;
export const OPEN_LIST_LIMIT = 20;
export const ALL_LIST_LIMIT = 100;

export type RequestRecord = {
  id: string;
  stage: string;
  topic: string;
  text: string;
  status: "OPEN" | "CLOSED";
  createdAt: Date;
  closedAt: Date | null;
};

export interface RequestsStore {
  insert(row: { stage: string; topic: string; text: string; createdById: string; at: Date }): Promise<void>;
  /** Changes an OPEN request. Returns false when there is no such open request. */
  update(id: string, data: { stage: string; topic: string; text: string; at: Date }): Promise<"updated" | "not-found" | "closed">;
  close(id: string, at: Date): Promise<"closed" | "not-found" | "already-closed">;
  /** Open requests, newest first, at most `limit`. */
  listOpen(limit: number): Promise<RequestRecord[]>;
  /** Every request, open and closed, newest first, at most `limit`. */
  listAll(limit: number): Promise<RequestRecord[]>;
}

export type Deps = { store: RequestsStore; now?: () => Date };

export type RequestInput = { stage: string; topic: string; text: string };
export type RequestRefusal = "stage" | "topic" | "empty" | "too-long" | "not-found" | "closed";
export type RequestResult = { ok: true } | { ok: false; reason: RequestRefusal };

const owner = (actor: Actor | null | undefined): Actor => {
  if (!actor || actor.role !== "owner") throw new ForbiddenError();
  return actor;
};

function check(input: RequestInput): { ok: true; value: RequestInput } | { ok: false; reason: RequestRefusal } {
  if (!(stageSlugs as readonly string[]).includes(input.stage)) return { ok: false, reason: "stage" };
  if (!(topicSlugs as readonly string[]).includes(input.topic)) return { ok: false, reason: "topic" };
  const text = input.text.trim();
  if (text.length === 0) return { ok: false, reason: "empty" };
  if (text.length > MAX_TEXT) return { ok: false, reason: "too-long" };
  return { ok: true, value: { stage: input.stage, topic: input.topic, text } };
}

export function createRequestsService(deps: Deps) {
  const now = () => (deps.now ? deps.now() : new Date());

  async function createRequest(actor: Actor | null | undefined, input: RequestInput): Promise<RequestResult> {
    const who = owner(actor);
    const valid = check(input);
    if (!valid.ok) return valid;
    await deps.store.insert({ ...valid.value, createdById: who.id, at: now() });
    return { ok: true };
  }

  /** Edits an open request. A closed one stays as it was. */
  async function editRequest(actor: Actor | null | undefined, input: RequestInput & { id: string }): Promise<RequestResult> {
    owner(actor);
    const valid = check(input);
    if (!valid.ok) return valid;
    const result = await deps.store.update(input.id, { ...valid.value, at: now() });
    return result === "updated" ? { ok: true } : { ok: false, reason: result };
  }

  /** Closes a request: it disappears from every creator's dashboard and stays in the owner's list. */
  async function closeRequest(actor: Actor | null | undefined, input: { id: string }): Promise<RequestResult> {
    owner(actor);
    const result = await deps.store.close(input.id, now());
    return result === "closed" ? { ok: true } : { ok: false, reason: result === "already-closed" ? "closed" : "not-found" };
  }

  /** The open requests, newest first, at most 20. For creators (paused or not) and owners; a learner and nobody are refused. */
  async function listOpenRequests(actor: Actor | null | undefined): Promise<RequestRecord[]> {
    if (!actor || !(hasRole(actor, "creator") || hasRole(actor, "owner"))) throw new ForbiddenError();
    return deps.store.listOpen(OPEN_LIST_LIMIT);
  }

  /** Every request, open and closed, newest first, at most 100. Owners only. */
  async function listAllRequests(actor: Actor | null | undefined): Promise<RequestRecord[]> {
    owner(actor);
    return deps.store.listAll(ALL_LIST_LIMIT);
  }

  return { createRequest, editRequest, closeRequest, listOpenRequests, listAllRequests };
}

export type RequestsService = ReturnType<typeof createRequestsService>;

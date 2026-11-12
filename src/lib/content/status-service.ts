import type { Actor } from "@/lib/roles/actor";
import { automaticNote, checkTransition, type ActorKind, type VideoStatusName } from "./status";
import { prismaStatusStore } from "./status-store";

// Changes a video's status and records it (spec FR-018 to FR-021, FR-030). The rules are in status.ts; this decides who
// is acting, whether they may see the video, and writes the new status and its history entry together or not at all.
// The content import never calls this: it has its own store path and is the only exception to the status rules.

/** Whoever makes the change: a signed-in creator or owner, or the system (the video host's notifications, in a later spec). */
export type StatusActor = Actor | { kind: "system"; label: string };

export type StatusEventInput = {
  videoId: string;
  fromStatus: VideoStatusName;
  toStatus: VideoStatusName;
  actorId: string | null;
  actorLabel: string;
  note: string | null;
};

export interface StatusTx {
  getVideo(videoId: string): Promise<{ id: string; status: VideoStatusName; hostUserId: string | null } | null>;
  /** Sets the new status only if the video is still in `from`. False when someone else changed it first. */
  setStatus(videoId: string, from: VideoStatusName, to: VideoStatusName): Promise<boolean>;
  /** Adds a history entry. There is deliberately no way to change or remove one. */
  appendEvent(event: StatusEventInput): Promise<void>;
}

export interface StatusStore {
  transaction<T>(work: (tx: StatusTx) => Promise<T>): Promise<T>;
}

export type ChangeResult =
  | { ok: true }
  | { ok: false; reason: "not-allowed" | "note-required" | "note-too-long" | "not-found" | "forbidden" };

class Abort extends Error {
  constructor(readonly result: Extract<ChangeResult, { ok: false }>) {
    super(result.reason);
  }
}

const kindOf = (actor: StatusActor): ActorKind | null =>
  "kind" in actor ? "system" : actor.role === "owner" ? "owner" : actor.role === "creator" ? "creator" : null;

const labelOf = (actor: StatusActor): string => {
  if ("kind" in actor) return actor.label.trim() || "system";
  return actor.name?.trim() || actor.email.trim() || "unknown";
};

export function createStatusService(deps: { store: StatusStore }) {
  async function changeStatus(input: {
    videoId: string;
    to: VideoStatusName;
    actor: StatusActor;
    note?: string | null;
  }): Promise<ChangeResult> {
    const kind = kindOf(input.actor);
    if (!kind) return { ok: false, reason: "forbidden" }; // a learner never changes a status

    try {
      await deps.store.transaction(async (tx) => {
        const video = await tx.getVideo(input.videoId);
        if (!video) throw new Abort({ ok: false, reason: "not-found" });
        // A creator only ever reaches their own videos; another creator's looks exactly like a missing one.
        if (kind === "creator" && (!("id" in input.actor) || video.hostUserId !== input.actor.id)) {
          throw new Abort({ ok: false, reason: "not-found" });
        }

        // A failed processing is always recorded with the automatic note, whatever the caller passed: the creator is told
        // the same plain thing every time.
        const note = (kind === "system" ? automaticNote(video.status, input.to) : null) ?? (input.note?.trim() || null);
        const check = checkTransition({ from: video.status, to: input.to, by: kind, note });
        if (!check.ok) throw new Abort({ ok: false, reason: check.reason });

        if (!(await tx.setStatus(video.id, video.status, input.to))) throw new Abort({ ok: false, reason: "not-allowed" });
        await tx.appendEvent({
          videoId: video.id,
          fromStatus: video.status,
          toStatus: input.to,
          actorId: "id" in input.actor ? input.actor.id : null,
          actorLabel: labelOf(input.actor),
          note,
        });
      });
      return { ok: true };
    } catch (error) {
      if (error instanceof Abort) return error.result;
      throw error;
    }
  }

  return { changeStatus };
}

/** The status change wired to the database. */
export const changeStatus = (input: Parameters<ReturnType<typeof createStatusService>["changeStatus"]>[0]) =>
  createStatusService({ store: prismaStatusStore }).changeStatus(input);

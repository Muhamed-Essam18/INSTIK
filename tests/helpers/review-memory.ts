import { vi } from "vitest";
import type { VideoStatusName } from "@/lib/content/status";
import type { StatusEventInput } from "@/lib/content/status-service";
import type { Actor } from "@/lib/roles/actor";
import type { GlossaryRow } from "@/lib/review/glossary";
import type { Checks } from "@/lib/review/rules";
import { createReviewService, type HistoryEntry, type QueueRowData, type ReviewStore, type ReviewTx, type ReviewVideo } from "@/lib/review/service";
import type { SegmentRecord } from "@/lib/review/segments";

// An in-memory stand-in for the review store so the review service's rules run with no database and no mailer. A transaction
// rolls back everything it did if it throws, and a lock serialises two callers, as the real row lock does.

export const owner: Actor = { id: "boss", email: "boss@x.com", name: "Boss", role: "owner" };
export const creatorActor: Actor = { id: "ann", email: "ann@x.com", name: "Ann", role: "creator" };
export const learnerActor: Actor = { id: "lea", email: "lea@x.com", name: null, role: "learner" };

export type Vid = ReviewVideo & { deleted: boolean; hostUserId: string };
export type Ev = StatusEventInput & { id: string; createdAt: Date };
export type EmailRow = { eventId: string; toEmail: string; outcome: "SENT" | "FAILED"; failure: string | null };

export const ticked: Checks = { stageFits: true, audio: true, realPeople: true, safe: true, transcript: true };

export const video = (extra: Partial<Vid> & Pick<Vid, "id">): Vid => ({
  languageCode: "arz",
  slug: `video-${extra.id}`,
  title: `Video ${extra.id}`,
  topic: "daily-life",
  status: "IN_REVIEW",
  stage: null,
  proposedStage: "hear-it",
  access: "FULL",
  durationSeconds: 120,
  playbackId: "pb",
  checks: { stageFits: false, audio: false, realPeople: false, safe: false, transcript: false },
  creatorName: "Salma",
  creatorEmail: "salma@x.com",
  deleted: false,
  hostUserId: "ann",
  ...extra,
});

export const segment = (extra: Partial<SegmentRecord> & Pick<SegmentRecord, "id" | "start" | "end">): SegmentRecord => ({
  position: 1,
  script: "كلام",
  transliteration: "",
  english: "",
  revision: 0,
  ...extra,
});

export type ReviewSetup = ReturnType<typeof setupReview>;

export function setupReview(
  initial: { videos?: Vid[]; segments?: Record<string, SegmentRecord[]>; events?: Ev[]; glossary?: GlossaryRow[] } = {},
  options: { mailerFails?: boolean; clock?: { now: Date }; creatorEmailMissing?: boolean } = {},
) {
  const state = {
    videos: new Map((initial.videos ?? []).map((v) => [v.id, v])),
    segments: new Map<string, SegmentRecord[]>(Object.entries(initial.segments ?? {})),
    events: [...(initial.events ?? [])],
    glossary: [...(initial.glossary ?? [])],
    emails: [] as EmailRow[],
  };
  const clock = options.clock ?? { now: new Date("2026-11-13T12:00:00Z") };
  let counter = 0;
  const nextId = (prefix: string) => `${prefix}-${++counter}`;

  const clone = () => ({
    videos: new Map([...state.videos].map(([k, v]) => [k, { ...v, checks: { ...v.checks } }])),
    segments: new Map([...state.segments].map(([k, v]) => [k, v.map((s) => ({ ...s }))])),
    events: state.events.map((e) => ({ ...e })),
    glossary: state.glossary.map((g) => ({ ...g })),
  });

  const segs = (videoId: string) => state.segments.get(videoId) ?? [];
  const visible = (v: Vid | undefined) => (v && !v.deleted ? v : null);
  const strip = (v: Vid): ReviewVideo => {
    const { deleted: _d, hostUserId: _h, ...rest } = v;
    void _d;
    void _h;
    return { ...rest, checks: { ...rest.checks }, creatorEmail: options.creatorEmailMissing ? null : rest.creatorEmail };
  };

  const tx: ReviewTx = {
    lockVideo: async (id) => {
      const v = visible(state.videos.get(id));
      return v ? strip(v) : null;
    },
    listSegments: async (id) => segs(id).map((s) => ({ ...s })),
    setChecks: async (id, checks) => void (state.videos.get(id)!.checks = { ...checks }),
    setClassification: async (id, { stage, access }) => void Object.assign(state.videos.get(id)!, { stage, access }),
    insertSegment: async (id, input, position) => {
      const row: SegmentRecord = { id: nextId("seg"), position, revision: 0, ...input };
      state.segments.set(id, [...segs(id), row]);
      return { ...row };
    },
    insertSegments: async (id, rows) => {
      const list = segs(id);
      for (const { input, position } of rows) {
        if (list.some((s) => s.position === position)) throw new Error("unique violation on (videoId, position)");
        list.push({ id: nextId("seg"), position, revision: 0, ...input });
      }
      state.segments.set(id, list);
    },
    updateSegment: async (id, segmentId, input, revision) => {
      const row = segs(id).find((s) => s.id === segmentId)!;
      Object.assign(row, input, { revision });
    },
    deleteSegment: async (id, segmentId) => void state.segments.set(id, segs(id).filter((s) => s.id !== segmentId)),
    deleteAllSegments: async (id) => void state.segments.set(id, []),
    setPositions: async (id, changes) => {
      const list = segs(id);
      for (const c of changes) list.find((s) => s.id === c.id)!.position = c.position;
      const seen = new Set<number>();
      for (const s of list) {
        if (seen.has(s.position)) throw new Error("unique violation on (videoId, position)");
        seen.add(s.position);
      }
    },
    setStatus: async (id, from, to, final) => {
      const v = state.videos.get(id);
      if (!v || v.status !== from) return false;
      v.status = to;
      if (final) Object.assign(v, final);
      return true;
    },
    appendEvent: async (e) => {
      const row: Ev = { ...e, id: nextId("ev"), createdAt: new Date(clock.now) };
      state.events.push(row);
      return { id: row.id };
    },
    glossary: async () => state.glossary.map((g) => ({ ...g })),
    insertGlossary: async (_lang, row) => {
      const entry: GlossaryRow = { id: nextId("g"), ...row };
      state.glossary.push(entry);
      return { ...entry };
    },
    updateGlossary: async (_lang, id, value) => {
      const entry = state.glossary.find((g) => g.id === id);
      if (!entry) return false;
      Object.assign(entry, value);
      return true;
    },
  };

  // A lock: one transaction at a time, in the order they ask.
  let tail: Promise<unknown> = Promise.resolve();
  const emailFailures = new Set<string>();

  const newest = (videoId: string, status: VideoStatusName) =>
    state.events.filter((e) => e.videoId === videoId && e.toStatus === status).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]?.createdAt;

  const store: ReviewStore = {
    transaction: (work) => {
      const run = tail.then(async () => {
        const backup = clone();
        try {
          return await work(tx);
        } catch (error) {
          state.videos = backup.videos;
          state.segments = backup.segments;
          state.events = backup.events;
          state.glossary = backup.glossary;
          throw error;
        }
      });
      tail = run.catch(() => undefined);
      return run;
    },
    queue: async ({ since }) => {
      const row = (v: Vid, status: VideoStatusName): QueueRowData => ({
        id: v.id,
        title: v.title,
        creatorName: v.creatorName,
        stage: v.stage,
        proposedStage: v.proposedStage,
        durationSeconds: v.durationSeconds,
        segmentCount: segs(v.id).length,
        since: newest(v.id, status) ?? new Date(0),
      });
      const live = [...state.videos.values()].filter((v) => !v.deleted);
      const approvedIds = new Set(live.map((v) => v.id));
      return {
        inReview: live.filter((v) => v.status === "IN_REVIEW").map((v) => row(v, "IN_REVIEW")),
        waiting: live.filter((v) => v.status === "CHANGES_REQUESTED").map((v) => row(v, "CHANGES_REQUESTED")),
        approvedSince: state.events.filter((e) => e.toStatus === "APPROVED" && approvedIds.has(e.videoId) && e.createdAt >= since).length,
      };
    },
    detail: async (id) => {
      const v = visible(state.videos.get(id));
      if (!v || (v.status !== "IN_REVIEW" && v.status !== "CHANGES_REQUESTED")) return null;
      const history: HistoryEntry[] = state.events
        .filter((e) => e.videoId === id)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((e) => ({
          id: e.id,
          toStatus: e.toStatus,
          actorLabel: e.actorLabel,
          note: e.note,
          createdAt: e.createdAt,
          emailFailed: state.emails.some((m) => m.eventId === e.id && m.outcome === "FAILED"),
        }));
      return { video: strip(v), segments: segs(id).map((s) => ({ ...s })), history, submittedAt: newest(id, "IN_REVIEW") ?? null };
    },
    glossary: async () => tx.glossary("arz"),
    recordEmail: async (row) => {
      if (emailFailures.has(row.eventId) || state.emails.some((m) => m.eventId === row.eventId)) throw new Error("unique violation on eventId");
      state.emails.push(row);
    },
  };

  const sent: { to: string }[] = [];
  const mailer = vi.fn(async (message: { to: string }) => {
    if (options.mailerFails) throw new Error("The email service answered 500.");
    sent.push(message);
  });

  const service = createReviewService({
    store,
    mailer: mailer as never,
    siteOrigin: () => "https://instik.test",
    now: () => clock.now,
  });

  const ev = (e: Partial<Ev> & Pick<Ev, "videoId" | "toStatus">): Ev => ({
    id: nextId("ev"),
    fromStatus: "PROCESSING",
    actorId: null,
    actorLabel: "system",
    note: null,
    createdAt: new Date(clock.now),
    ...e,
  });

  return { state, store, service, mailer, sent, clock, ev, tx };
}

export const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

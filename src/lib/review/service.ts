import { NOTE_MAX, checkTransition, type VideoStatusName } from "@/lib/content/status";
import type { StatusEventInput } from "@/lib/content/status-service";
import { parseVtt } from "@/lib/content/vtt";
import { stageSlugs } from "@/lib/content/taxonomy";
import { creatorVideoPath, creatorVideosPath } from "@/lib/routes";
import { ForbiddenError } from "@/lib/roles/forbidden";
import type { Actor } from "@/lib/roles/actor";
import type { Segment } from "@/lib/content/transcript";
import { outcomeOf, shortFailure, type DecisionMessage } from "./email";
import {
  GLOSSARY_MEANING_MAX,
  GLOSSARY_WORD_MAX,
  findExisting,
  markLinked,
  newEntryKey,
  type GlossaryRow,
} from "./glossary";
import { approveProblems, checkKeys, daysWaiting, queueBadge, startOfMonth, type ApproveProblem, type CheckKey, type Checks } from "./rules";
import {
  SEGMENTS_MAX,
  VTT_MAX_BYTES,
  cuesToSegments,
  mergeImport,
  orderSegments,
  overlapsAny,
  renumber,
  validateSegment,
  type ImportMode,
  type SegmentInput,
  type SegmentProblem,
  type SegmentRecord,
} from "./segments";

// The owner's review service (spec 10): the queue, opening a video, saving the checklist, classification and transcript, the
// glossary, and the three decisions. All the rules are here; the database (`ReviewStore`) and the mailer are passed in, so it is
// tested without either. Every function checks the owner role first. Every write runs in one transaction that locks the video row,
// re-reads its status, and only touches a video that is In review.

export type ReviewVideo = {
  id: string;
  languageCode: string;
  slug: string;
  title: string;
  topic: string | null;
  status: VideoStatusName;
  /** The final stage (owner's), or null until set. */
  stage: string | null;
  proposedStage: string | null;
  access: "FREE" | "FULL";
  durationSeconds: number | null;
  playbackId: string | null;
  checks: Checks;
  creatorName: string;
  creatorEmail: string | null;
};

export type HistoryEntry = {
  id: string;
  toStatus: VideoStatusName;
  actorLabel: string;
  note: string | null;
  createdAt: Date;
  /** True when the decision email for this entry failed to send. */
  emailFailed: boolean;
};

export type QueueRowData = {
  id: string;
  title: string;
  creatorName: string;
  stage: string | null;
  proposedStage: string | null;
  durationSeconds: number | null;
  segmentCount: number;
  /** The newest IN_REVIEW history entry for a video in review, or the newest CHANGES_REQUESTED entry for one waiting on the creator. */
  since: Date;
};

export interface ReviewTx {
  /** Locks the video row and returns it. Null for a missing or soft-deleted video. */
  lockVideo(videoId: string): Promise<ReviewVideo | null>;
  listSegments(videoId: string): Promise<SegmentRecord[]>;
  setChecks(videoId: string, checks: Checks): Promise<void>;
  setClassification(videoId: string, value: { stage: string; access: "FREE" | "FULL" }): Promise<void>;
  insertSegment(videoId: string, input: SegmentInput, position: number): Promise<SegmentRecord>;
  insertSegments(videoId: string, rows: { input: SegmentInput; position: number }[]): Promise<void>;
  updateSegment(videoId: string, segmentId: string, input: SegmentInput, revision: number): Promise<void>;
  deleteSegment(videoId: string, segmentId: string): Promise<void>;
  deleteAllSegments(videoId: string): Promise<void>;
  /** Changes positions for several segments at once (the store keeps `@@unique([videoId, position])` satisfied). */
  setPositions(videoId: string, changes: { id: string; position: number }[]): Promise<void>;
  /** Sets the status only if it is still `from`, and for an approval the final stage and access. False when someone else got there first. */
  setStatus(videoId: string, from: VideoStatusName, to: VideoStatusName, final?: { stage: string; access: "FREE" | "FULL" }): Promise<boolean>;
  appendEvent(event: StatusEventInput): Promise<{ id: string }>;
  glossary(languageCode: string): Promise<GlossaryRow[]>;
  insertGlossary(languageCode: string, row: Omit<GlossaryRow, "id">): Promise<GlossaryRow>;
  updateGlossary(languageCode: string, id: string, value: { transliteration: string; english: string }): Promise<boolean>;
}

export interface ReviewStore {
  transaction<T>(work: (tx: ReviewTx) => Promise<T>): Promise<T>;
  /** Videos in review and videos in Changes requested (not deleted), and the approvals since `since`. Unsorted. */
  queue(input: { since: Date }): Promise<{ inReview: QueueRowData[]; waiting: QueueRowData[]; approvedSince: number }>;
  /** A video in review or in Changes requested (not deleted), with its segments and history; null for any other. */
  detail(videoId: string): Promise<{ video: ReviewVideo; segments: SegmentRecord[]; history: HistoryEntry[]; submittedAt: Date | null } | null>;
  glossary(languageCode: string): Promise<GlossaryRow[]>;
  /** Records one decision email. `eventId` is unique, so a second record for the same decision is refused. */
  recordEmail(input: { eventId: string; toEmail: string; outcome: "SENT" | "FAILED"; failure: string | null }): Promise<void>;
}

export type Deps = {
  store: ReviewStore;
  mailer: (message: DecisionMessage) => Promise<void>;
  siteOrigin: () => string;
  now?: () => Date;
};

export type QueueRow = {
  id: string;
  title: string;
  creatorName: string;
  /** The final stage when the owner has set one, else the creator's proposal. */
  stage: string | null;
  durationSeconds: number | null;
  submittedAt: Date;
  waiting: string;
  badge: string;
  hasTranscript: boolean;
};

export type Queue = {
  counts: { needsReview: number; transcriptInProgress: number; waitingOnCreator: number; approvedThisMonth: number };
  rows: QueueRow[];
};

export type SegmentView = SegmentRecord & { links: Segment[] };

export type ReviewView = {
  video: Omit<ReviewVideo, "creatorEmail">;
  readOnly: boolean;
  submittedAt: Date | null;
  segments: SegmentView[];
  /** The glossary entries the segments' words matched, by entry key. */
  entries: Record<string, GlossaryRow>;
  history: HistoryEntry[];
};

export type WriteReason = "not-found" | "not-in-review";
export type Refusal = { ok: false; reason: WriteReason };
export type SegmentRefusal =
  | Refusal
  | { ok: false; reason: "invalid" | "overlap" | "conflict" | "too-many"; problems: readonly SegmentProblem[] };

export type VttPreview =
  | { ok: true; count: number; first: number; last: number; problems: [] }
  | { ok: false; reason: WriteReason | "invalid"; problems: string[] };

export type DecideRefusal =
  | Refusal
  | { ok: false; reason: Exclude<ApproveProblem, "not-in-review"> | "note-required" | "note-too-long"; problems: readonly ApproveProblem[] };

export type DecideResult = { ok: true; emailSent: boolean; creatorName: string; eventId: string } | DecideRefusal;

export type Decision = "approve" | "changes" | "reject";
const target: Record<Decision, VideoStatusName> = { approve: "APPROVED", changes: "CHANGES_REQUESTED", reject: "REJECTED" };

const labelOf = (actor: Actor) => actor.name?.trim() || actor.email.trim() || "unknown";

export function createReviewService(deps: Deps) {
  const now = () => (deps.now ? deps.now() : new Date());
  const owner = (actor: Actor | null | undefined): Actor => {
    if (!actor || actor.role !== "owner") throw new ForbiddenError();
    return actor;
  };

  /** Runs `work` on a video that is In review, in one transaction that holds the video's row lock. */
  async function onVideoInReview<T>(videoId: string, work: (tx: ReviewTx, video: ReviewVideo) => Promise<T>): Promise<T | Refusal> {
    return deps.store.transaction(async (tx) => {
      const video = await tx.lockVideo(videoId);
      if (!video) return { ok: false, reason: "not-found" } as const;
      if (video.status !== "IN_REVIEW") return { ok: false, reason: "not-in-review" } as const;
      return work(tx, video);
    });
  }

  // ---- reads ----

  async function getQueue(actor: Actor | null | undefined, input: { list: "review" | "waiting" }): Promise<Queue> {
    owner(actor);
    const at = now();
    const data = await deps.store.queue({ since: startOfMonth(at) });
    const chosen = input.list === "waiting" ? data.waiting : data.inReview;
    const rows = [...chosen]
      .sort((a, b) => a.since.getTime() - b.since.getTime() || a.title.localeCompare(b.title))
      .map<QueueRow>((r) => ({
        id: r.id,
        title: r.title,
        creatorName: r.creatorName,
        stage: r.stage ?? r.proposedStage,
        durationSeconds: r.durationSeconds,
        submittedAt: r.since,
        waiting: daysWaiting(r.since, at),
        badge: input.list === "waiting" ? "Changes requested" : queueBadge(r.segmentCount),
        hasTranscript: r.segmentCount > 0,
      }));
    return {
      counts: {
        needsReview: data.inReview.filter((r) => r.segmentCount === 0).length,
        transcriptInProgress: data.inReview.filter((r) => r.segmentCount > 0).length,
        waitingOnCreator: data.waiting.length,
        approvedThisMonth: data.approvedSince,
      },
      rows,
    };
  }

  async function getReview(actor: Actor | null | undefined, videoId: string): Promise<ReviewView | null> {
    owner(actor);
    const found = await deps.store.detail(videoId);
    if (!found || (found.video.status !== "IN_REVIEW" && found.video.status !== "CHANGES_REQUESTED")) return null;
    const entries = await deps.store.glossary(found.video.languageCode);
    const used: Record<string, GlossaryRow> = {};
    const segments = orderSegments(found.segments).map<SegmentView>((s) => {
      const marked = markLinked(s.script, entries);
      Object.assign(used, marked.entries);
      return { ...s, links: marked.segments };
    });
    const { creatorEmail: _email, ...video } = found.video;
    void _email;
    return {
      video,
      readOnly: found.video.status !== "IN_REVIEW",
      submittedAt: found.submittedAt,
      segments,
      entries: used,
      history: found.history,
    };
  }

  // ---- checklist and classification ----

  async function setChecklist(actor: Actor | null | undefined, input: { videoId: string; key: CheckKey; checked: boolean }): Promise<{ ok: true } | Refusal | { ok: false; reason: "invalid" }> {
    owner(actor);
    if (!checkKeys.includes(input.key)) return { ok: false, reason: "invalid" };
    const result = await onVideoInReview(input.videoId, async (tx, video) => {
      await tx.setChecks(video.id, { ...video.checks, [input.key]: input.checked });
      return { ok: true } as const;
    });
    return result;
  }

  async function setClassification(
    actor: Actor | null | undefined,
    input: { videoId: string; stage: string; access: string },
  ): Promise<{ ok: true } | Refusal | { ok: false; reason: "invalid" }> {
    owner(actor);
    if (!(stageSlugs as readonly string[]).includes(input.stage) || (input.access !== "FREE" && input.access !== "FULL")) {
      return { ok: false, reason: "invalid" };
    }
    const access = input.access;
    return onVideoInReview(input.videoId, async (tx, video) => {
      await tx.setClassification(video.id, { stage: input.stage, access });
      return { ok: true } as const;
    });
  }

  // ---- transcript ----

  async function linksFor(languageCode: string, script: string) {
    return markLinked(script, await deps.store.glossary(languageCode));
  }

  async function saveSegment(
    actor: Actor | null | undefined,
    input: { videoId: string; segmentId?: string; revision?: number } & SegmentInput,
  ): Promise<{ ok: true; segment: SegmentView; entries: Record<string, GlossaryRow> } | SegmentRefusal> {
    owner(actor);
    const candidate: SegmentInput = {
      start: input.start,
      end: input.end,
      script: input.script,
      transliteration: input.transliteration,
      english: input.english,
    };
    const result = await onVideoInReview(input.videoId, async (tx, video) => {
      const problems = validateSegment(candidate, { durationSeconds: video.durationSeconds });
      if (problems.length > 0) return { ok: false, reason: "invalid", problems } as const;
      const others = await tx.listSegments(video.id);
      let saved: SegmentRecord;
      if (input.segmentId === undefined) {
        if (others.length >= SEGMENTS_MAX) {
          return { ok: false, reason: "too-many", problems: [{ field: "segment", message: `A transcript can have at most ${SEGMENTS_MAX.toLocaleString("en")} segments.` }] } as const;
        }
        if (overlapsAny(others, candidate)) {
          return { ok: false, reason: "overlap", problems: [{ field: "start", message: "This overlaps another segment." }] } as const;
        }
        saved = await tx.insertSegment(video.id, candidate, Math.max(0, ...others.map((s) => s.position)) + 1);
      } else {
        const current = others.find((s) => s.id === input.segmentId);
        // Someone else deleted it, or changed it since this editor loaded it.
        if (!current || current.revision !== input.revision) {
          return { ok: false, reason: "conflict", problems: [{ field: "segment", message: "Someone else changed this segment." }] } as const;
        }
        if (overlapsAny(others, candidate, current.id)) {
          return { ok: false, reason: "overlap", problems: [{ field: "start", message: "This overlaps another segment." }] } as const;
        }
        saved = { ...current, ...candidate, revision: current.revision + 1 };
        await tx.updateSegment(video.id, current.id, candidate, saved.revision);
      }
      const all = [...others.filter((s) => s.id !== saved.id), saved];
      const moves = renumber(all);
      if (moves.length > 0) await tx.setPositions(video.id, moves);
      saved = { ...saved, position: moves.find((m) => m.id === saved.id)?.position ?? saved.position };
      return { ok: true, segment: saved, languageCode: video.languageCode } as const;
    });
    if (!result.ok) return result;
    const marked = await linksFor(result.languageCode, result.segment.script);
    return { ok: true, segment: { ...result.segment, links: marked.segments }, entries: marked.entries };
  }

  async function deleteSegment(
    actor: Actor | null | undefined,
    input: { videoId: string; segmentId: string; revision: number },
  ): Promise<{ ok: true } | Refusal | { ok: false; reason: "conflict" }> {
    owner(actor);
    return onVideoInReview(input.videoId, async (tx, video) => {
      const all = await tx.listSegments(video.id);
      const current = all.find((s) => s.id === input.segmentId);
      if (!current || current.revision !== input.revision) return { ok: false, reason: "conflict" } as const;
      await tx.deleteSegment(video.id, current.id);
      const moves = renumber(all.filter((s) => s.id !== current.id));
      if (moves.length > 0) await tx.setPositions(video.id, moves);
      return { ok: true } as const;
    });
  }

  /** Parses a WebVTT file into segments, or says what is wrong with it (with line numbers). */
  function readVtt(text: string, durationSeconds: number | null): { ok: true; segments: SegmentInput[] } | { ok: false; problems: string[] } {
    if (new TextEncoder().encode(text).length > VTT_MAX_BYTES) return { ok: false, problems: ["That file is bigger than 1 MB."] };
    const { cues, errors } = parseVtt(text);
    if (errors.length > 0) return { ok: false, problems: errors };
    if (cues.length === 0) return { ok: false, problems: ["That file has no captions in it."] };
    const segments = cuesToSegments(cues);
    const problems = segments.flatMap((s, i) => validateSegment(s, { durationSeconds }).map((p) => `line ${cues[i].line}: ${p.message}`));
    return problems.length > 0 ? { ok: false, problems } : { ok: true, segments };
  }

  async function previewVtt(actor: Actor | null | undefined, input: { videoId: string; text: string }): Promise<VttPreview> {
    owner(actor);
    const result = await onVideoInReview(input.videoId, async (_tx, video) => readVtt(input.text, video.durationSeconds));
    if ("reason" in result) return { ok: false, reason: result.reason, problems: [] };
    if (!result.ok) return { ok: false, reason: "invalid", problems: result.problems };
    const sorted = orderSegments(result.segments);
    return { ok: true, count: sorted.length, first: sorted[0].start, last: sorted[sorted.length - 1].end, problems: [] };
  }

  async function importVtt(
    actor: Actor | null | undefined,
    input: { videoId: string; text: string; mode: ImportMode },
  ): Promise<{ ok: true; count: number } | Refusal | { ok: false; reason: "invalid"; problems: string[] }> {
    owner(actor);
    return onVideoInReview(input.videoId, async (tx, video) => {
      const read = readVtt(input.text, video.durationSeconds);
      if (!read.ok) return { ok: false, reason: "invalid", problems: read.problems } as const;
      const existing = await tx.listSegments(video.id);
      const merged = mergeImport(existing, read.segments, input.mode, { durationSeconds: video.durationSeconds });
      if (!merged.ok) return { ok: false, reason: "invalid", problems: merged.problems } as const;
      if (input.mode === "replace") {
        await tx.deleteAllSegments(video.id);
        await tx.insertSegments(video.id, merged.segments.map((s, i) => ({ input: s, position: i + 1 })));
      } else {
        // Existing segments move to their final places first, then the new ones fill the gaps.
        const combined = orderSegments([
          ...existing.map((s) => ({ ...s, existing: true as const })),
          ...read.segments.map((s) => ({ ...s, existing: false as const })),
        ]);
        const moves: { id: string; position: number }[] = [];
        const added: { input: SegmentInput; position: number }[] = [];
        combined.forEach((s, i) => {
          if (s.existing) {
            if (s.position !== i + 1) moves.push({ id: s.id, position: i + 1 });
          } else {
            added.push({ input: { start: s.start, end: s.end, script: s.script, transliteration: s.transliteration, english: s.english }, position: i + 1 });
          }
        });
        if (moves.length > 0) await tx.setPositions(video.id, moves);
        await tx.insertSegments(video.id, added);
      }
      return { ok: true, count: read.segments.length } as const;
    });
  }

  // ---- glossary ----

  async function addGlossaryEntry(
    actor: Actor | null | undefined,
    input: { videoId: string; word: string; transliteration: string; english: string },
  ): Promise<{ ok: true; entry: GlossaryRow } | { ok: false; reason: "exists"; entry: GlossaryRow } | Refusal | { ok: false; reason: "invalid" }> {
    owner(actor);
    const word = input.word.trim();
    const transliteration = input.transliteration.trim();
    const english = input.english.trim();
    if (!word || !transliteration || !english || word.length > GLOSSARY_WORD_MAX || transliteration.length > GLOSSARY_MEANING_MAX || english.length > GLOSSARY_MEANING_MAX) {
      return { ok: false, reason: "invalid" };
    }
    return onVideoInReview(input.videoId, async (tx, video) => {
      const entries = await tx.glossary(video.languageCode);
      const existing = findExisting(word, entries);
      if (existing) return { ok: false, reason: "exists", entry: existing } as const;
      const entry = await tx.insertGlossary(video.languageCode, {
        entryKey: newEntryKey(entries),
        word,
        base: word,
        transliteration,
        english,
      });
      return { ok: true, entry } as const;
    });
  }

  async function updateGlossaryEntry(
    actor: Actor | null | undefined,
    input: { videoId: string; entryId: string; transliteration: string; english: string },
  ): Promise<{ ok: true } | Refusal | { ok: false; reason: "invalid" | "no-entry" }> {
    owner(actor);
    const transliteration = input.transliteration.trim();
    const english = input.english.trim();
    if (!transliteration || !english || transliteration.length > GLOSSARY_MEANING_MAX || english.length > GLOSSARY_MEANING_MAX) {
      return { ok: false, reason: "invalid" };
    }
    return onVideoInReview(input.videoId, async (tx, video) => {
      const done = await tx.updateGlossary(video.languageCode, input.entryId, { transliteration, english });
      return done ? ({ ok: true } as const) : ({ ok: false, reason: "no-entry" } as const);
    });
  }

  // ---- decisions ----

  async function decide(actor: Actor | null | undefined, input: { videoId: string; decision: Decision; note?: string | null }): Promise<DecideResult> {
    const who = owner(actor);
    const note = input.note?.trim() || null;
    if (note && note.length > NOTE_MAX) return { ok: false, reason: "note-too-long", problems: [] };
    if (input.decision !== "approve" && !note) return { ok: false, reason: "note-required", problems: [] };
    const to = target[input.decision];

    const committed = await deps.store.transaction(async (tx) => {
      const video = await tx.lockVideo(input.videoId);
      if (!video) return { ok: false, reason: "not-found" } as const;
      if (video.status !== "IN_REVIEW") return { ok: false, reason: "not-in-review" } as const;

      let final: { stage: string; access: "FREE" | "FULL" } | undefined;
      if (input.decision === "approve") {
        const stage = video.stage ?? video.proposedStage;
        const segments = await tx.listSegments(video.id);
        const problems = approveProblems({
          status: video.status,
          checks: video.checks,
          segmentCount: segments.length,
          stage,
          title: video.title,
          topic: video.topic,
          durationSeconds: video.durationSeconds,
          playbackId: video.playbackId,
        });
        if (problems.length > 0) return { ok: false, reason: problems[0] as Exclude<ApproveProblem, "not-in-review">, problems } as const;
        final = { stage: stage!, access: video.access };
      }

      const check = checkTransition({ from: "IN_REVIEW", to, by: "owner", note });
      if (!check.ok) {
        const reason = check.reason === "note-required" || check.reason === "note-too-long" ? check.reason : "not-in-review";
        return reason === "not-in-review" ? ({ ok: false, reason } as const) : ({ ok: false, reason, problems: [] } as const);
      }
      if (!(await tx.setStatus(video.id, "IN_REVIEW", to, final))) return { ok: false, reason: "not-in-review" } as const;
      const event = await tx.appendEvent({
        videoId: video.id,
        fromStatus: "IN_REVIEW",
        toStatus: to,
        actorId: who.id,
        actorLabel: labelOf(who),
        note,
      });
      return { ok: true, eventId: event.id, video } as const;
    });
    if (!committed.ok) return committed;

    // The decision is saved. Telling the creator can fail without undoing it.
    const { video, eventId } = committed;
    const outcome = outcomeOf(to)!;
    const origin = deps.siteOrigin();
    const link = `${origin}${outcome === "changes" ? creatorVideoPath(video.id) : creatorVideosPath()}`;
    let emailSent = false;
    let failure: string | null = null;
    if (!video.creatorEmail) {
      failure = "The creator has no email address on file.";
    } else {
      try {
        await deps.mailer({ to: video.creatorEmail, outcome, title: video.title, creatorName: video.creatorName, note, link });
        emailSent = true;
      } catch (error) {
        failure = shortFailure(error instanceof Error ? error.message : "");
      }
    }
    try {
      await deps.store.recordEmail({ eventId, toEmail: video.creatorEmail ?? "", outcome: emailSent ? "SENT" : "FAILED", failure });
    } catch {
      console.error("[review] could not record a decision email", { event: eventId });
    }
    return { ok: true, emailSent, creatorName: video.creatorName, eventId };
  }

  return {
    getQueue,
    getReview,
    setChecklist,
    setClassification,
    saveSegment,
    deleteSegment,
    previewVtt,
    importVtt,
    addGlossaryEntry,
    updateGlossaryEntry,
    decide,
  };
}

export type ReviewService = ReturnType<typeof createReviewService>;

import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { VideoStatusName } from "@/lib/content/status";
import type { GlossaryRow } from "./glossary";
import { parseChecks } from "./rules";
import type { SegmentRecord } from "./segments";
import type { HistoryEntry, QueueRowData, ReviewStore, ReviewTx, ReviewVideo } from "./service";

// The Prisma side of the owner's review (spec 10): the only place the review reads and writes touch the database. Every
// write goes through `transaction`, which locks the video row first, so two owners cannot change one video at the same time.
// Mux ids never leave this module; the playback id is the one value a screen needs to show the video.

type Db = Prisma.TransactionClient;

const videoSelect = {
  id: true,
  languageCode: true,
  slug: true,
  title: true,
  topic: true,
  status: true,
  stage: true,
  proposedStage: true,
  access: true,
  durationSeconds: true,
  playbackId: true,
  reviewChecks: true,
  host: { select: { name: true, user: { select: { name: true, email: true } } } },
} satisfies Prisma.VideoSelect;

type VideoRow = Prisma.VideoGetPayload<{ select: typeof videoSelect }>;

const toVideo = (row: VideoRow): ReviewVideo => ({
  id: row.id,
  languageCode: row.languageCode,
  slug: row.slug,
  title: row.title,
  topic: row.topic,
  status: row.status as VideoStatusName,
  stage: row.stage,
  proposedStage: row.proposedStage,
  access: row.access,
  durationSeconds: row.durationSeconds,
  playbackId: row.playbackId,
  checks: parseChecks(row.reviewChecks),
  creatorName: row.host.name.trim() || row.host.user?.name?.trim() || "the creator",
  creatorEmail: row.host.user?.email ?? null,
});

const toSegment = (row: { id: string; position: number; start: number; end: number; script: string; transliteration: string | null; english: string | null; revision: number }): SegmentRecord => ({
  id: row.id,
  position: row.position,
  start: row.start,
  end: row.end,
  script: row.script,
  transliteration: row.transliteration ?? "",
  english: row.english ?? "",
  revision: row.revision,
});

const toGlossary = (row: { id: string; entryKey: string; word: string; base: string; transliteration: string; english: string }): GlossaryRow => ({
  id: row.id,
  entryKey: row.entryKey,
  word: row.word,
  base: row.base,
  transliteration: row.transliteration,
  english: row.english,
});

const segmentData = (videoId: string, input: { start: number; end: number; script: string; transliteration: string; english: string }, position: number) => ({
  videoId,
  position,
  start: input.start,
  end: input.end,
  script: input.script,
  transliteration: input.transliteration.trim() === "" ? null : input.transliteration,
  english: input.english.trim() === "" ? null : input.english,
});

const makeTx = (p: Db): ReviewTx => ({
  async lockVideo(videoId) {
    // The row lock: a second transaction on this video waits here until the first one ends.
    await p.$queryRaw`SELECT "id" FROM "Video" WHERE "id" = ${videoId} FOR UPDATE`;
    const row = await p.video.findFirst({ where: { id: videoId, deletedAt: null }, select: videoSelect });
    return row ? toVideo(row) : null;
  },
  async listSegments(videoId) {
    const rows = await p.transcriptSegment.findMany({ where: { videoId }, orderBy: { position: "asc" } });
    return rows.map(toSegment);
  },
  async setChecks(videoId, checks) {
    await p.video.update({ where: { id: videoId }, data: { reviewChecks: checks } });
  },
  async setClassification(videoId, { stage, access }) {
    await p.video.update({ where: { id: videoId }, data: { stage, access } });
  },
  async insertSegment(videoId, input, position) {
    return toSegment(await p.transcriptSegment.create({ data: segmentData(videoId, input, position) }));
  },
  async insertSegments(videoId, rows) {
    if (rows.length === 0) return;
    await p.transcriptSegment.createMany({ data: rows.map((r) => segmentData(videoId, r.input, r.position)) });
  },
  async updateSegment(videoId, segmentId, input, revision) {
    const { videoId: _v, position: _p, ...data } = segmentData(videoId, input, 0);
    void _v;
    void _p;
    await p.transcriptSegment.update({ where: { id: segmentId }, data: { ...data, revision } });
  },
  async deleteSegment(videoId, segmentId) {
    await p.transcriptSegment.deleteMany({ where: { id: segmentId, videoId } });
  },
  async deleteAllSegments(videoId) {
    await p.transcriptSegment.deleteMany({ where: { videoId } });
  },
  async setPositions(videoId, changes) {
    if (changes.length === 0) return;
    const ids = changes.map((c) => c.id);
    const positions = changes.map((c) => c.position);
    // `@@unique([videoId, position])` forbids two segments sharing a position even for a moment: first move the changing
    // segments out of the way (to negative numbers), then to their final places. Two statements for the whole list.
    await p.$executeRaw`UPDATE "TranscriptSegment" AS t SET "position" = -v.pos FROM (SELECT unnest(${ids}::text[]) AS id, unnest(${positions}::int[]) AS pos) AS v WHERE t."id" = v.id AND t."videoId" = ${videoId}`;
    await p.$executeRaw`UPDATE "TranscriptSegment" AS t SET "position" = v.pos FROM (SELECT unnest(${ids}::text[]) AS id, unnest(${positions}::int[]) AS pos) AS v WHERE t."id" = v.id AND t."videoId" = ${videoId}`;
  },
  async setStatus(videoId, from, to, final) {
    // Conditional on the status the decision was made from: two decisions from the same status cannot both win.
    const changed = await p.video.updateMany({
      where: { id: videoId, status: from },
      data: { status: to, ...(final ? { stage: final.stage, access: final.access } : {}) },
    });
    return changed.count === 1;
  },
  async appendEvent(event) {
    const row = await p.videoStatusEvent.create({ data: event, select: { id: true } });
    return { id: row.id };
  },
  async glossary(languageCode) {
    return (await p.glossaryEntry.findMany({ where: { languageCode } })).map(toGlossary);
  },
  async insertGlossary(languageCode, row) {
    return toGlossary(await p.glossaryEntry.create({ data: { languageCode, ...row } }));
  },
  async updateGlossary(languageCode, id, value) {
    const changed = await p.glossaryEntry.updateMany({ where: { id, languageCode }, data: value });
    return changed.count === 1;
  },
});

const queueRow = (row: VideoRow & { _count: { segments: number }; events: { createdAt: Date }[]; createdAt: Date }): QueueRowData => ({
  id: row.id,
  title: row.title,
  creatorName: row.host.name.trim() || row.host.user?.name?.trim() || "the creator",
  stage: row.stage,
  proposedStage: row.proposedStage,
  durationSeconds: row.durationSeconds,
  segmentCount: row._count.segments,
  since: row.events[0]?.createdAt ?? row.createdAt,
});

export const prismaReviewStore: ReviewStore = {
  transaction: (work) => db().$transaction((p) => work(makeTx(p)), { timeout: 20_000, maxWait: 10_000 }),

  async queue({ since }) {
    const select = (status: "IN_REVIEW" | "CHANGES_REQUESTED") =>
      ({
        ...videoSelect,
        createdAt: true,
        _count: { select: { segments: true } },
        // The date the video came into this status most recently.
        events: { where: { toStatus: status }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      }) satisfies Prisma.VideoSelect;
    const [inReview, waiting, approvedSince] = await Promise.all([
      db().video.findMany({ where: { status: "IN_REVIEW", deletedAt: null }, select: select("IN_REVIEW") }),
      db().video.findMany({ where: { status: "CHANGES_REQUESTED", deletedAt: null }, select: select("CHANGES_REQUESTED") }),
      db().videoStatusEvent.count({ where: { toStatus: "APPROVED", createdAt: { gte: since }, video: { deletedAt: null } } }),
    ]);
    return { inReview: inReview.map(queueRow), waiting: waiting.map(queueRow), approvedSince };
  },

  async detail(videoId) {
    const row = await db().video.findFirst({
      where: { id: videoId, deletedAt: null, status: { in: ["IN_REVIEW", "CHANGES_REQUESTED"] } },
      select: {
        ...videoSelect,
        segments: { orderBy: { position: "asc" } },
        events: { orderBy: { createdAt: "desc" }, select: { id: true, toStatus: true, actorLabel: true, note: true, createdAt: true } },
      },
    });
    if (!row) return null;
    const failed = await db().decisionEmail.findMany({
      where: { eventId: { in: row.events.map((e) => e.id) }, outcome: "FAILED" },
      select: { eventId: true },
    });
    const failedIds = new Set(failed.map((f) => f.eventId));
    const history: HistoryEntry[] = row.events.map((e) => ({
      id: e.id,
      toStatus: e.toStatus as VideoStatusName,
      actorLabel: e.actorLabel,
      note: e.note,
      createdAt: e.createdAt,
      emailFailed: failedIds.has(e.id),
    }));
    return {
      video: toVideo(row),
      segments: row.segments.map(toSegment),
      history,
      submittedAt: row.events.find((e) => e.toStatus === "IN_REVIEW")?.createdAt ?? null,
    };
  },

  async glossary(languageCode) {
    return (await db().glossaryEntry.findMany({ where: { languageCode } })).map(toGlossary);
  },

  async recordEmail(input) {
    await db().decisionEmail.create({ data: { eventId: input.eventId, toEmail: input.toEmail, outcome: input.outcome, failure: input.failure } });
  },
};

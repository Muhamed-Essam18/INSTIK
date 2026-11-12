// The Prisma side of the content import. It takes a client so the import script can build its own
// (this file, like the rest of the import, must not import `server-only`, `db()` or `env()`).

import type { PrismaClient } from "../../../generated/prisma/client";
import type { ExistingState } from "./plan";
import { NOTE_INCOMPLETE_PREFIX, type ImportEvent, type ImportStore } from "./run";

const accessOf = (access: "free" | "full") => (access === "free" ? ("FREE" as const) : ("FULL" as const));

export function prismaImportStore(client: PrismaClient): ImportStore {
  return {
    async loadExisting(languageCode): Promise<ExistingState> {
      const [hosts, glossary, videos] = await Promise.all([
        client.host.findMany({ where: { languageCode }, select: { slug: true } }),
        client.glossaryEntry.findMany({ where: { languageCode }, select: { entryKey: true } }),
        client.video.findMany({
          where: { languageCode },
          select: {
            slug: true,
            status: true,
            events: { orderBy: { createdAt: "asc" }, take: 1, select: { note: true, actorLabel: true } },
          },
        }),
      ]);
      return {
        hostSlugs: new Set(hosts.map((h) => h.slug)),
        glossaryKeys: new Set(glossary.map((g) => g.entryKey)),
        // An import draft: still a Draft, and its first event was written by the import as "incomplete".
        videos: new Map(
          videos.map((v) => [
            v.slug,
            {
              incompleteDraft:
                v.status === "DRAFT" &&
                v.events[0]?.actorLabel === "import" &&
                (v.events[0]?.note ?? "").startsWith(NOTE_INCOMPLETE_PREFIX),
            },
          ]),
        ),
      };
    },

    async createHost(languageCode, host) {
      await client.host.create({
        data: {
          languageCode,
          slug: host.slug,
          name: host.name,
          nameArabic: host.nameArabic,
          story: host.story,
          topics: host.topics,
          photo: host.photo ?? null,
          order: host.order,
          sample: host.sample ?? false,
        },
      });
    },

    async createGlossaryEntry(languageCode, entry) {
      await client.glossaryEntry.create({
        data: {
          languageCode,
          entryKey: entry.id,
          word: entry.word,
          base: entry.base,
          transliteration: entry.transliteration,
          english: entry.english,
          audio: entry.audio ?? null,
        },
      });
    },

    async createVideo({ languageCode, video, segments, status, event }) {
      const host = await client.host.findUnique({
        where: { languageCode_slug: { languageCode, slug: video.host } },
        select: { id: true },
      });
      if (!host) throw new Error(`host "${video.host}" is not in the database`);
      // The video, its segments and its first history entry are written together or not at all.
      await client.video.create({
        data: {
          languageCode,
          slug: video.slug,
          title: video.title,
          titleArabic: video.titleArabic ?? null,
          stage: video.stage,
          topic: video.topic,
          hostId: host.id,
          durationSeconds: video.durationSeconds,
          access: accessOf(video.access),
          playbackId: video.playbackId ?? null,
          status,
          sample: video.sample ?? false,
          segments: { create: segments.map((s, position) => ({ position, ...segmentData(s) })) },
          events: { create: eventData(event) },
        },
      });
    },

    async completeDraft({ languageCode, slug, segments, event }) {
      await client.$transaction(async (tx) => {
        const video = await tx.video.findUnique({ where: { languageCode_slug: { languageCode, slug } }, select: { id: true } });
        if (!video) throw new Error(`video "${slug}" is not in the database`);
        // Only a Draft can be completed; the condition is part of the update so a second run cannot repeat it.
        const moved = await tx.video.updateMany({ where: { id: video.id, status: "DRAFT" }, data: { status: "APPROVED" } });
        if (moved.count !== 1) throw new Error(`video "${slug}" is no longer a draft`);
        await tx.transcriptSegment.createMany({
          data: segments.map((s, position) => ({ videoId: video.id, position, ...segmentData(s) })),
        });
        await tx.videoStatusEvent.create({ data: { videoId: video.id, ...eventData(event) } });
      });
    },
  };
}

const segmentData = (s: { start: number; end: number; script: string; transliteration: string | null; english: string | null }) => ({
  start: s.start,
  end: s.end,
  script: s.script,
  transliteration: s.transliteration,
  english: s.english,
});

const eventData = (event: ImportEvent) => ({
  fromStatus: event.fromStatus,
  toStatus: event.toStatus,
  actorLabel: event.actorLabel,
  note: event.note,
});

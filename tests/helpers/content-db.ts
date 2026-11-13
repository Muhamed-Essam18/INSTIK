// An in-memory stand-in for the content tables, filled from the sample files in content/ with every video Approved
// (as the import leaves them). Tests mock `@/lib/db` with it so the real content module runs unchanged:
//
//   vi.mock("@/lib/db", async () => ({ db: () => (await import("../helpers/content-db")).contentDb.db }));
//
// It understands only the query shapes src/lib/content/index.ts uses.

import { loadAllContent } from "@/lib/content/load";
import { languages } from "@/lib/languages";

export type FakeHost = {
  id: string;
  languageCode: string;
  slug: string;
  name: string;
  nameArabic: string | null;
  story: string;
  topics: string[];
  photo: string | null;
  order: number;
  userId: string | null;
  sample: boolean;
};
export type FakeVideo = {
  id: string;
  languageCode: string;
  slug: string;
  title: string;
  titleArabic: string | null;
  stage: string | null;
  topic: string | null;
  hostId: string;
  durationSeconds: number | null;
  access: "FREE" | "FULL";
  playbackId: string | null;
  status: string;
  sample: boolean;
  // Creator upload columns (spec 9). Imported videos have none of them set.
  proposedStage: string | null;
  description: string | null;
  muxUploadId: string | null;
  muxAssetId: string | null;
  assetReadyAt: Date | null;
  submittedAt: Date | null;
  checklistAcceptedAt: Date | null;
  uploadStartedAt: Date | null;
  pendingUploadId: string | null;
  pendingAssetId: string | null;
  pendingPlaybackId: string | null;
  pendingDurationSeconds: number | null;
  pendingReadyAt: Date | null;
  pendingStartedAt: Date | null;
  pendingFailure: string | null;
  deletedAt: Date | null;
  updatedAt: Date;
};
export type FakeSegment = {
  videoId: string;
  position: number;
  start: number;
  end: number;
  script: string;
  transliteration: string | null;
  english: string | null;
};
export type FakeEvent = {
  id: string;
  videoId: string;
  fromStatus: string | null;
  toStatus: string;
  actorId: string | null;
  actorLabel: string;
  note: string | null;
  createdAt: Date;
};
export type FakeGlossary = {
  languageCode: string;
  entryKey: string;
  word: string;
  base: string;
  transliteration: string;
  english: string;
  audio: string | null;
};

/** The creator upload columns of a video that has never been through the creator panel. */
const blankCreatorColumns = {
  proposedStage: null,
  description: null,
  muxUploadId: null,
  muxAssetId: null,
  assetReadyAt: null,
  submittedAt: null,
  checklistAcceptedAt: null,
  uploadStartedAt: null,
  pendingUploadId: null,
  pendingAssetId: null,
  pendingPlaybackId: null,
  pendingDurationSeconds: null,
  pendingReadyAt: null,
  pendingStartedAt: null,
  pendingFailure: null,
  deletedAt: null,
  updatedAt: new Date(0),
};

type Row = Record<string, unknown>;

function build() {
  const hosts: FakeHost[] = [];
  const videos: FakeVideo[] = [];
  const segments: FakeSegment[] = [];
  const glossary: FakeGlossary[] = [];
  const events: FakeEvent[] = [];
  const content = loadAllContent();
  for (const language of languages) {
    const lc = content.get(language.slug);
    if (!lc) continue;
    for (const h of lc.hosts) {
      hosts.push({
        id: `host-${language.code}-${h.slug}`,
        languageCode: language.code,
        slug: h.slug,
        name: h.name,
        nameArabic: h.nameArabic,
        story: h.story,
        topics: h.topics,
        photo: h.photo ?? null,
        order: h.order,
        userId: null,
        sample: h.sample ?? false,
      });
    }
    for (const v of lc.videos) {
      const id = `video-${language.code}-${v.slug}`;
      videos.push({
        id,
        languageCode: language.code,
        slug: v.slug,
        title: v.title,
        titleArabic: v.titleArabic ?? null,
        stage: v.stage,
        topic: v.topic,
        hostId: `host-${language.code}-${v.host}`,
        durationSeconds: v.durationSeconds,
        access: v.access === "free" ? "FREE" : "FULL",
        playbackId: v.playbackId ?? null,
        status: "APPROVED",
        sample: v.sample ?? false,
        ...blankCreatorColumns,
      });
      (lc.transcripts[v.slug] ?? []).forEach((line, position) =>
        segments.push({ videoId: id, position, start: line.start, end: line.end, script: line.script, transliteration: line.transliteration, english: line.english }),
      );
    }
    for (const g of lc.glossary.entries) {
      glossary.push({ languageCode: language.code, entryKey: g.id, word: g.word, base: g.base, transliteration: g.transliteration, english: g.english, audio: g.audio ?? null });
    }
  }
  return { hosts, videos, segments, glossary, events };
}

export function createContentDb() {
  let state = build();

  const hostOf = (v: FakeVideo) => state.hosts.find((h) => h.id === v.hostId)!;
  const videosOf = (h: FakeHost) => state.videos.filter((v) => v.hostId === h.id);

  function matches(row: Row, where: Row | undefined, kind: "video" | "host" | "event" | "other"): boolean {
    if (!where) return true;
    return Object.entries(where).every(([key, value]) => {
      if (key === "OR") return (value as Row[]).some((w) => matches(row, w, kind));
      if (key === "video" && kind === "event") return matches(state.videos.find((v) => v.id === row.videoId) as unknown as Row, value as Row, "video");
      if (key === "host" && kind === "video") return matches(hostOf(row as FakeVideo) as unknown as Row, value as Row, "host");
      if (key === "videos" && kind === "host") {
        const some = (value as { some: Row }).some;
        return videosOf(row as FakeHost).some((v) => matches(v as unknown as Row, some, "video"));
      }
      if (key === "languageCode_slug") {
        const k = value as { languageCode: string; slug: string };
        return row.languageCode === k.languageCode && row.slug === k.slug;
      }
      return row[key] === value;
    });
  }

  // Prisma's `events: { orderBy: { createdAt: "desc" }, take: 1 }` on a video: its newest history entry only.
  const newestEvent = (v: FakeVideo) =>
    state.events
      .filter((e) => e.videoId === v.id)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 1);
  const withHost = (v: FakeVideo) => ({ ...v, host: { slug: hostOf(v).slug }, events: newestEvent(v) });
  const withSegments = (v: FakeVideo) => ({
    ...withHost(v),
    segments: state.segments.filter((s) => s.videoId === v.id).sort((a, b) => a.position - b.position),
  });

  const db = {
    video: {
      findMany: async (args: { where?: Row }) =>
        state.videos.filter((v) => matches(v as unknown as Row, args.where, "video")).map(withHost),
      findFirst: async (args: { where?: Row }) => {
        const v = state.videos.find((x) => matches(x as unknown as Row, args.where, "video"));
        return v ? withSegments(v) : null;
      },
    },
    host: {
      findMany: async (args: { where?: Row }) =>
        state.hosts.filter((h) => matches(h as unknown as Row, args.where, "host")).sort((a, b) => a.order - b.order),
      findUnique: async (args: { where: Row }) => state.hosts.find((h) => matches(h as unknown as Row, args.where, "host")) ?? null,
      findFirst: async (args: { where?: Row }) => state.hosts.find((h) => matches(h as unknown as Row, args.where, "host")) ?? null,
    },
    videoStatusEvent: {
      findMany: async (args: { where?: Row }) =>
        state.events
          .filter((e) => matches(e as unknown as Row, args.where, "event"))
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
    },
    glossaryEntry: {
      findMany: async (args: { where?: Row }) =>
        state.glossary.filter((g) => matches(g as unknown as Row, args.where, "other")).sort((a, b) => a.entryKey.localeCompare(b.entryKey)),
    },
  };

  return {
    db,
    get state() {
      return state;
    },
    /** Back to the sample content with every video Approved. */
    reset() {
      state = build();
    },
    /** Marks a video as soft-deleted (or clears it with null). */
    setDeletedAt(languageCode: string, slug: string, deletedAt: Date | null) {
      const v = state.videos.find((x) => x.languageCode === languageCode && x.slug === slug);
      if (!v) throw new Error(`no video ${slug}`);
      v.deletedAt = deletedAt;
    },
    setStatus(languageCode: string, slug: string, status: string) {
      const v = state.videos.find((x) => x.languageCode === languageCode && x.slug === slug);
      if (!v) throw new Error(`no video ${slug}`);
      v.status = status;
    },
    addEvent(event: Partial<FakeEvent> & Pick<FakeEvent, "videoId" | "toStatus">): FakeEvent {
      const row: FakeEvent = {
        id: `event-${state.events.length + 1}`,
        fromStatus: null,
        actorId: null,
        actorLabel: "import",
        note: null,
        createdAt: new Date(2026, 10, 1, 0, state.events.length),
        ...event,
      };
      state.events.push(row);
      return row;
    },
    addHost(host: Partial<FakeHost> & Pick<FakeHost, "languageCode" | "slug" | "name">): FakeHost {
      const row: FakeHost = {
        id: `host-${host.languageCode}-${host.slug}`,
        nameArabic: null,
        story: "",
        topics: [],
        photo: null,
        order: state.hosts.length + 1,
        userId: `user-${host.slug}`,
        sample: false,
        ...host,
      };
      state.hosts.push(row);
      return row;
    },
    addVideo(video: Partial<FakeVideo> & Pick<FakeVideo, "languageCode" | "slug" | "hostId">): FakeVideo {
      const row: FakeVideo = {
        id: `video-${video.languageCode}-${video.slug}`,
        title: video.slug,
        titleArabic: null,
        stage: "hear-it",
        topic: "food",
        durationSeconds: 300,
        access: "FREE",
        playbackId: null,
        status: "DRAFT",
        sample: false,
        ...blankCreatorColumns,
        ...video,
      };
      state.videos.push(row);
      return row;
    },
  };
}

export const contentDb = createContentDb();

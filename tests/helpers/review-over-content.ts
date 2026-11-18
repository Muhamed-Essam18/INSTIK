import type { StatusEventInput } from "@/lib/content/status-service";
import type { Checks } from "@/lib/review/rules";
import { createReviewService, type ReviewStore, type ReviewTx, type ReviewVideo } from "@/lib/review/service";
import { contentDb, type FakeVideo } from "./content-db";

// The review service running against the same in-memory content tables the learner and creator reads use, so a decision made
// through the service can be read back through those reads with nothing faked in between.

export const ticked: Checks = { stageFits: true, audio: true, realPeople: true, safe: true, transcript: true };

/** A review store over the content tables: only what `decide` needs. */
export function storeOver(): ReviewStore {
  const find = (id: string): FakeVideo | undefined => contentDb.state.videos.find((v) => v.id === id && !v.deletedAt);
  const tx: Partial<ReviewTx> = {
    lockVideo: async (id) => {
      const v = find(id);
      if (!v) return null;
      const host = contentDb.state.hosts.find((h) => h.id === v.hostId)!;
      const row: ReviewVideo = {
        id: v.id,
        languageCode: v.languageCode,
        slug: v.slug,
        title: v.title,
        topic: v.topic,
        status: v.status as ReviewVideo["status"],
        stage: v.stage,
        proposedStage: v.proposedStage,
        access: v.access,
        durationSeconds: v.durationSeconds,
        playbackId: v.playbackId,
        checks: ticked,
        creatorName: host.name,
        creatorEmail: "creator@x.com",
      };
      return row;
    },
    listSegments: async (id) =>
      contentDb.state.segments
        .filter((s) => s.videoId === id)
        .map((s) => ({ id: `${id}-${s.position}`, position: s.position, start: s.start, end: s.end, script: s.script, transliteration: s.transliteration ?? "", english: s.english ?? "", revision: 0 })),
    setStatus: async (id, from, to, final) => {
      const v = find(id);
      if (!v || v.status !== from) return false;
      v.status = to;
      if (final) Object.assign(v, final);
      return true;
    },
    appendEvent: async (e: StatusEventInput) => ({ id: contentDb.addEvent({ ...e }).id }),
  };
  return {
    transaction: (work) => work(tx as ReviewTx),
    queue: async () => ({ inReview: [], waiting: [], approvedSince: 0 }),
    detail: async () => null,
    glossary: async () => [],
    recordEmail: async () => {},
  };
}

export const reviewOverContent = () => createReviewService({ store: storeOver(), mailer: async () => {}, siteOrigin: () => "https://instik.test" });


import { HostVideoList } from "@/components/host/HostVideoList";
import { markLocked } from "@/lib/billing/access";
import { getSubscription } from "@/lib/billing/subscription";
import type { LibraryVideo } from "@/lib/content/search";
import { getLearner } from "@/lib/session";

/**
 * The learner's own part of the host page: the same cards with "Full access" marked on the videos they cannot watch yet.
 * A signed-out visitor gets the plain list. It reads the session, so the host page renders it behind Suspense.
 */
export async function HostVideos({
  languageSlug,
  hostName,
  videos,
}: {
  languageSlug: string;
  hostName: string;
  videos: LibraryVideo[];
}) {
  const learner = await getLearner();
  const shown = learner ? markLocked(videos, await getSubscription(learner.id), new Date()) : videos;
  return <HostVideoList languageSlug={languageSlug} hostName={hostName} videos={shown} />;
}

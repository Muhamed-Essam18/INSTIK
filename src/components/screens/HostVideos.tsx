import { HostVideoList } from "@/components/host/HostVideoList";
import { markLocked } from "@/lib/billing/access";
import { getFullAccess } from "@/lib/billing/subscription";
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
  const access = learner ? await getFullAccess(learner.id) : null;
  const shown = access ? markLocked(videos, access.subscription, new Date(), access.manual) : videos;
  return <HostVideoList languageSlug={languageSlug} hostName={hostName} videos={shown} />;
}

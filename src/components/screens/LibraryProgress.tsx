import { LibraryBrowser } from "@/components/library/LibraryBrowser";
import { PickUpBanner } from "@/components/library/PickUpBanner";
import { canWatch, markLocked } from "@/lib/billing/access";
import { getSubscription } from "@/lib/billing/subscription";
import { getVideos } from "@/lib/content";
import type { LibraryVideo } from "@/lib/content/search";
import { getLibraryProgress } from "@/lib/hours/queries";
import { getLanguageBySlug } from "@/lib/languages";
import { getProfile } from "@/lib/learner/profiles";
import { getLearner } from "@/lib/session";

/**
 * The learner's own part of the Library: the pick-up banner, the Watched labels and the locked markers, from their
 * account. A signed-out visitor gets the same list with none of them; a learner without this language gets the list
 * with locked markers but no progress.
 */
export async function LibraryProgress({ languageSlug, videos }: { languageSlug: string; videos: LibraryVideo[] }) {
  const language = getLanguageBySlug(languageSlug);
  const learner = language ? await getLearner() : null;
  if (!language || !learner) return <LibraryBrowser languageSlug={languageSlug} videos={videos} />;

  const now = new Date();
  const subscription = await getSubscription(learner.id);
  if (!(await getProfile(learner.id, language.code))) {
    return <LibraryBrowser languageSlug={languageSlug} videos={markLocked(videos, subscription, now)} />;
  }

  // "Pick up where you left off" skips a video the learner can no longer watch.
  const approved = new Map((await getVideos(languageSlug)).map((v) => [v.slug, v]));
  const canPlay = (slug: string) => {
    const video = approved.get(slug);
    return video ? canWatch(video, subscription, now) : false;
  };
  const { pickUp, watchedSlugs } = await getLibraryProgress(learner.id, language.code, canPlay);
  const watched = new Set(watchedSlugs);
  // The banner looks up its video and host, so it is awaited here rather than rendered as an element.
  const banner = await PickUpBanner({ languageSlug, pickUp });
  return (
    <>
      {banner}
      <LibraryBrowser
        languageSlug={languageSlug}
        videos={markLocked(
          videos.map((v) => ({ ...v, watched: watched.has(v.slug) })),
          subscription,
          now,
        )}
      />
    </>
  );
}

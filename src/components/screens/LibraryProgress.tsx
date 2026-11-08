import { LibraryBrowser } from "@/components/library/LibraryBrowser";
import { PickUpBanner } from "@/components/library/PickUpBanner";
import { getLibraryVideos } from "@/lib/content/library";
import { getLibraryProgress } from "@/lib/hours/queries";
import { getLanguageBySlug } from "@/lib/languages";
import { getProfile } from "@/lib/learner/profiles";
import { getLearner } from "@/lib/session";

/**
 * The learner's own part of the Library: the pick-up banner and the Watched labels, from real progress.
 * A signed-out visitor, or a learner without this language, gets the same list with neither.
 */
export async function LibraryProgress({ languageSlug }: { languageSlug: string }) {
  const videos = getLibraryVideos(languageSlug);
  const language = getLanguageBySlug(languageSlug);
  const learner = language ? await getLearner() : null;
  if (!language || !learner || !(await getProfile(learner.id, language.code))) {
    return <LibraryBrowser languageSlug={languageSlug} videos={videos} />;
  }
  const { pickUp, watchedSlugs } = await getLibraryProgress(learner.id, language.code);
  const watched = new Set(watchedSlugs);
  return (
    <>
      <PickUpBanner languageSlug={languageSlug} pickUp={pickUp} />
      <LibraryBrowser languageSlug={languageSlug} videos={videos.map((v) => ({ ...v, watched: watched.has(v.slug) }))} />
    </>
  );
}

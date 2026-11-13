import { PlaceholderPage } from "@/components/PlaceholderPage";
import { creatorPath, creatorUploadPath, creatorVideosPath } from "@/lib/routes";
import { requireCreator } from "@/lib/session";

/**
 * The creator Dashboard, empty for now: statistics and earnings come later. It points to the two things a creator can do today.
 * Reads the session, so the page renders it behind Suspense. A learner or an owner who is not a creator gets a not-found page.
 */
export async function CreatorScreen() {
  const actor = await requireCreator(creatorPath());
  return (
    <PlaceholderPage
      title={actor.name ? `Hello, ${actor.name}` : "Hello"}
      note="Your statistics will appear here once your videos are live. Until then, you can upload a video or see how your videos are doing."
      backHref={creatorUploadPath()}
      backLabel="Upload a video"
      moreLinks={[{ href: creatorVideosPath(), label: "My videos" }]}
    />
  );
}

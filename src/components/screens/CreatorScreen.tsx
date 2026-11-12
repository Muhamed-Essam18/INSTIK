import { PlaceholderPage } from "@/components/PlaceholderPage";
import { creatorPath, landingPath } from "@/lib/routes";
import { requireCreator } from "@/lib/session";

/** The creator area's home, empty for now. Reads the session, so the page renders it behind Suspense. A learner or an owner gets a not-found page. */
export async function CreatorScreen() {
  const actor = await requireCreator(creatorPath());
  return (
    <PlaceholderPage
      title={actor.name ? `Hello, ${actor.name}` : "Hello"}
      note="Nothing here yet. Your videos, views and earnings will appear here."
      backHref={landingPath()}
      backLabel="Back to Instik"
    />
  );
}

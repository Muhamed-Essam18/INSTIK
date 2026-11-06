import { PlaceholderPage } from "@/components/PlaceholderPage";
import { donePath, roadmapPath } from "@/lib/routes";
import { requireLearner } from "@/lib/session";

/** Reads the language param and the session, so it is rendered inside a Suspense boundary by the page. */
export async function DoneScreen({ params }: { params: Promise<{ language: string }> }) {
  const { language } = await params;
  await requireLearner(donePath(language));
  return (
    <PlaceholderPage
      title="Done for today"
      note="That's enough for today. See you tomorrow."
      backHref={roadmapPath(language)}
      backLabel="See your roadmap"
    />
  );
}

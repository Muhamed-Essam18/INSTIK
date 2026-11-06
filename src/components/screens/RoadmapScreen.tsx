import { PlaceholderPage } from "@/components/PlaceholderPage";
import { libraryPath, roadmapPath } from "@/lib/routes";
import { requireLearner } from "@/lib/session";

/** Reads the language param and the session, so it is rendered inside a Suspense boundary by the page. */
export async function RoadmapScreen({ params }: { params: Promise<{ language: string }> }) {
  const { language } = await params;
  await requireLearner(roadmapPath(language));
  return (
    <PlaceholderPage
      title="Roadmap"
      note="Your roadmap is on its way."
      backHref={libraryPath(language)}
      backLabel="Back to the Library"
    />
  );
}

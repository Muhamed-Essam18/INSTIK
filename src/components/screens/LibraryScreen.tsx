import { LibraryBrowser } from "@/components/library/LibraryBrowser";
import { PickUpBanner } from "@/components/library/PickUpBanner";
import { getLibraryVideos } from "@/lib/content/library";

/** Reads the language param, so it is rendered inside a Suspense boundary by the page. */
export async function LibraryScreen({ params }: { params: Promise<{ language: string }> }) {
  const { language } = await params;
  return (
    <div className="flex flex-col gap-space-8">
      <PickUpBanner languageSlug={language} />
      <LibraryBrowser languageSlug={language} videos={getLibraryVideos(language)} />
    </div>
  );
}

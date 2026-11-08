import { Suspense } from "react";
import { LibraryBrowser } from "@/components/library/LibraryBrowser";
import { LibraryProgress } from "@/components/screens/LibraryProgress";
import { getLibraryVideos } from "@/lib/content/library";

/** Reads the language param, so it is rendered inside a Suspense boundary by the page. */
export async function LibraryScreen({ params }: { params: Promise<{ language: string }> }) {
  const { language } = await params;
  return (
    <div className="flex flex-col gap-space-8">
      {/* The fallback is today's list without banner or labels, so nothing shifts when the learner's part arrives. */}
      <Suspense fallback={<LibraryBrowser languageSlug={language} videos={getLibraryVideos(language)} />}>
        <LibraryProgress languageSlug={language} />
      </Suspense>
    </div>
  );
}

import { notFound } from "next/navigation";
import { PlaceholderPage } from "@/components/PlaceholderPage";
import { getHost, getVideo } from "@/lib/content";
import { donePath, hostPath, libraryPath } from "@/lib/routes";

/** Reads the language and video params, so it is rendered inside a Suspense boundary by the page. */
export async function WatchScreen({ params }: { params: Promise<{ language: string; video: string }> }) {
  const { language, video: slug } = await params;
  const video = getVideo(language, slug);
  if (!video) notFound();
  const host = getHost(language, video.host)!;

  return (
    <PlaceholderPage
      title={video.title}
      note="The player is on its way."
      backHref={libraryPath(language)}
      backLabel="Back to the Library"
      moreLinks={[
        { href: hostPath(language, host.slug), label: `More with ${host.name}` },
        { href: donePath(language), label: "Finish for today" },
      ]}
    >
      <p className="text-body text-slate">With {host.name}</p>
    </PlaceholderPage>
  );
}

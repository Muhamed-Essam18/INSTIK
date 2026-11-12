import { notFound } from "next/navigation";
import { Suspense } from "react";
import { HostHero } from "@/components/host/HostHero";
import { HostVideoList } from "@/components/host/HostVideoList";
import { OtherHosts } from "@/components/host/OtherHosts";
import { HostVideos } from "@/components/screens/HostVideos";
import { getHost, getHosts, getVideosByHost } from "@/lib/content";
import { getLibraryVideos } from "@/lib/content/library";
import { getLanguageBySlug } from "@/lib/languages";
import { watchVideoPath } from "@/lib/routes";

/** Reads the language and host params, so it is rendered inside a Suspense boundary by the page. */
export async function HostScreen({ params }: { params: Promise<{ language: string; host: string }> }) {
  const { language: slug, host: hostSlug } = await params;
  const language = getLanguageBySlug(slug);
  const host = await getHost(slug, hostSlug);
  if (!language || !host) notFound();

  const [hosts, libraryVideos, hostVideos] = await Promise.all([
    getHosts(slug),
    getLibraryVideos(slug),
    getVideosByHost(slug, host.slug),
  ]);
  const videos = libraryVideos.filter((v) => v.hostSlug === host.slug);
  const hello = hostVideos[0]; // lowest stage first

  return (
    <div className="flex flex-col gap-space-12">
      <HostHero
        language={language}
        host={host}
        helloHref={hello ? watchVideoPath(slug, hello.slug) : undefined}
        first={hosts[0]?.slug === host.slug}
      />

      <section aria-labelledby="host-videos" className="flex flex-col gap-5">
        <h2 id="host-videos" className="m-0 font-display text-[28px] leading-[34px] font-extrabold">
          Videos with {host.name}
        </h2>
        {/* The plain list is the static part; a signed-in learner's "Full access" markers arrive with the Suspense part. */}
        <Suspense fallback={<HostVideoList languageSlug={slug} hostName={host.name} videos={videos} />}>
          <HostVideos languageSlug={slug} hostName={host.name} videos={videos} />
        </Suspense>
      </section>

      <OtherHosts languageSlug={slug} hosts={hosts.filter((h) => h.slug !== host.slug)} />
    </div>
  );
}

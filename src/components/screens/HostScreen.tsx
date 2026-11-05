import { notFound } from "next/navigation";
import { HostHero } from "@/components/host/HostHero";
import { OtherHosts } from "@/components/host/OtherHosts";
import { VideoCard } from "@/components/library/VideoCard";
import { getHost, getHosts, getVideosByHost } from "@/lib/content";
import { getLibraryVideos } from "@/lib/content/library";
import { getLanguageBySlug } from "@/lib/languages";
import { watchVideoPath } from "@/lib/routes";

/** Reads the language and host params, so it is rendered inside a Suspense boundary by the page. */
export async function HostScreen({ params }: { params: Promise<{ language: string; host: string }> }) {
  const { language: slug, host: hostSlug } = await params;
  const language = getLanguageBySlug(slug);
  const host = getHost(slug, hostSlug);
  if (!language || !host) notFound();

  const hosts = getHosts(slug);
  const videos = getLibraryVideos(slug).filter((v) => v.hostSlug === host.slug);
  const hello = getVideosByHost(slug, host.slug)[0]; // lowest stage first

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
        {videos.length ? (
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-5 p-0">
            {videos.map((video, i) => (
              <li key={video.slug} className="flex flex-col">
                <VideoCard languageSlug={slug} video={video} tone={i} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 text-body text-slate">{host.name}&apos;s first videos are on the way.</p>
        )}
      </section>

      <OtherHosts languageSlug={slug} hosts={hosts.filter((h) => h.slug !== host.slug)} />
    </div>
  );
}

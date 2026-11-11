import { VideoCard } from "@/components/library/VideoCard";
import type { LibraryVideo } from "@/lib/content/search";

/** The host's videos as cards, or a kind line when there are none yet. Plain data in, no session. */
export function HostVideoList({
  languageSlug,
  hostName,
  videos,
}: {
  languageSlug: string;
  hostName: string;
  videos: LibraryVideo[];
}) {
  if (!videos.length) return <p className="m-0 text-body text-slate">{hostName}&apos;s first videos are on the way.</p>;
  return (
    <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-5 p-0">
      {videos.map((video, i) => (
        <li key={video.slug} className="flex flex-col">
          <VideoCard languageSlug={languageSlug} video={video} tone={i} />
        </li>
      ))}
    </ul>
  );
}

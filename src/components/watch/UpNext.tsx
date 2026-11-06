import Link from "next/link";
import { VideoCard } from "@/components/library/VideoCard";
import type { LibraryVideo } from "@/lib/content/search";
import { donePath } from "@/lib/routes";
import { AutoplaySwitch } from "./AutoplaySwitch";

type Props = { languageSlug: string; videos: LibraryVideo[] };

/** Up to three other videos at this stage, a visible autoplay switch, and a list that ends. */
export function UpNext({ languageSlug, videos }: Props) {
  return (
    <section aria-labelledby="up-next" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4">
        <h2 id="up-next" className="m-0 font-display text-heading text-ink">
          Up next
        </h2>
        <span className="grow" />
        <AutoplaySwitch />
      </div>

      {videos.length ? (
        <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2">
          {videos.map((video, i) => (
            <li key={video.slug} className="flex flex-col">
              <VideoCard languageSlug={languageSlug} video={video} tone={i} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 text-body text-slate">More videos at this stage are on the way.</p>
      )}

      <p className="m-0 text-label font-normal text-slate">
        That&apos;s all for Up next. Pick one when you&apos;re ready, or{" "}
        <Link href={donePath(languageSlug)} className="font-semibold">
          finish for today
        </Link>
        .
      </p>
    </section>
  );
}

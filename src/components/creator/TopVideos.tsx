import { AnswerBar } from "@/components/creator/AnswerBar";
import type { VideoStat } from "@/lib/earnings/dashboard-data";
import { formatHours, formatShare } from "@/lib/earnings/format";
import { stages, type StageSlug } from "@/lib/content/taxonomy";

const th = "px-space-4 py-space-3 font-semibold";
const td = "px-space-4 py-space-3 align-middle";

const stageName = (slug: string | null) => (slug ? (stages.find((s) => s.slug === (slug as StageSlug))?.label ?? "") : "");

/** The creator's own most-counted videos this month (at most five), each with its فاهم؟ answers and the colours explained in words. */
export function TopVideos({ videos }: { videos: readonly VideoStat[] }) {
  return (
    <section aria-labelledby="top-heading" className="flex flex-col gap-space-3">
      <h2 id="top-heading" className="m-0 font-display text-heading text-ink">
        Top videos this month
      </h2>
      {videos.length === 0 ? (
        <div className="rounded-lg bg-paper p-space-6 shadow-sm">
          <p className="m-0 text-body-lg text-ink">Nothing here yet. Counted views will show up as learners watch your videos.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-paper shadow-sm">
          <table className="w-full min-w-[720px] border-collapse text-left text-body">
            <caption className="sr-only">Your top videos this month</caption>
            <thead>
              <tr className="border-b border-hairline text-label text-slate">
                <th scope="col" className={th}>
                  Video
                </th>
                <th scope="col" className={th}>
                  Stage
                </th>
                <th scope="col" className={th}>
                  Counted views
                </th>
                <th scope="col" className={th}>
                  Watch hours
                </th>
                <th scope="col" className={th}>
                  Completion
                </th>
                <th scope="col" className={th}>
                  <span lang="ar" dir="rtl">
                    فاهم؟
                  </span>{" "}
                  answers
                </th>
              </tr>
            </thead>
            <tbody>
              {videos.map((v) => (
                <tr key={v.videoId} className="border-b border-hairline last:border-b-0">
                  <th scope="row" className={`${td} font-semibold`}>
                    {v.title.trim() || "Untitled video"}
                  </th>
                  <td className={td}>{stageName(v.stage)}</td>
                  <td className={td}>{v.views.toLocaleString("en-GB")}</td>
                  <td className={td}>{formatHours(v.watchSeconds)}</td>
                  <td className={td}>{v.completion === null ? "—" : formatShare(v.completion)}</td>
                  <td className={td}>
                    <AnswerBar answers={v.answers} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="m-0 text-caption text-slate">
        <span lang="ar" dir="rtl">
          فاهم؟
        </span>{" "}
        answers: <span className="font-semibold text-teal-text">teal</span> mostly understood, <span className="font-semibold">sun</span> some of it,{" "}
        <span className="font-semibold text-coral-text">coral</span> not yet. Lots of &quot;not yet&quot; usually means the video is harder than its stage.
      </p>
    </section>
  );
}

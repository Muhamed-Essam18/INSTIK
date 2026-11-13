import Link from "next/link";
import type { VideoRow } from "@/lib/creator/list";
import { creatorUploadPath } from "@/lib/routes";
import { StatusBadge } from "./StatusBadge";

const th = "px-space-4 py-space-3 font-semibold";
const td = "px-space-4 py-space-3";

/** Every video with its stage, status, the latest note from Instik, a views slot and when it was last updated (docs/design/CreatorVideos.dc.html). The list simply ends. */
export function VideoTable({ rows, filterLabel }: { rows: readonly VideoRow[]; filterLabel: string }) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-start gap-space-3 rounded-lg border border-hairline bg-paper p-space-6">
        <p className="m-0 text-body-lg text-ink">
          {filterLabel === "All" ? "You haven't made a video yet." : `Nothing under ${filterLabel} right now.`}
        </p>
        <Link href={creatorUploadPath()} className="inline-flex min-h-11 items-center text-label underline">
          Upload a video
        </Link>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-hairline bg-paper">
      <table className="w-full min-w-[720px] border-collapse text-left text-body">
        <caption className="sr-only">Your videos, most recently updated first</caption>
        <thead>
          <tr className="border-b border-hairline text-label text-slate">
            <th scope="col" className={th}>Title</th>
            <th scope="col" className={th}>Stage</th>
            <th scope="col" className={th}>Status</th>
            <th scope="col" className={th}>Latest note</th>
            <th scope="col" className={th}>Views this month</th>
            <th scope="col" className={th}>Updated</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-hairline align-top last:border-b-0">
              <th scope="row" className={`${td} font-semibold`}>
                <Link href={row.href} className="inline-flex min-h-11 items-center">
                  {row.title}
                </Link>
              </th>
              <td className={td}>{row.stage ?? "—"}</td>
              <td className={td}>
                <StatusBadge display={row.display} />
              </td>
              <td className={`${td} text-slate`}>{row.note ?? "—"}</td>
              <td className={`${td} text-slate`}>{row.isLive ? <span title="Counted views will appear here">Soon</span> : "—"}</td>
              <td className={`${td} text-slate`}>{row.updated}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

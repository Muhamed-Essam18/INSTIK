import Link from "next/link";
import type { CreatorRow } from "@/lib/creators/rules";
import { ownerCreatorPath } from "@/lib/routes";
import { PauseButton } from "./PauseButton";
import { ResendButton } from "./ResendButton";

const th = "px-space-4 py-space-3 font-semibold";
const td = "px-space-4 py-space-3";

const tone = { Active: "bg-teal text-ink", Invited: "bg-sun text-ink", Paused: "bg-hairline text-ink" } as const;

/** Every creator and everyone invited, with what is live, in review and waiting on them (docs/design/OwnerCreators.dc.html). No earnings or counted views yet. */
export function CreatorsTable({ rows }: { rows: readonly CreatorRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-hairline bg-paper p-space-6">
        <p className="m-0 text-body-lg text-ink">No creators yet. Invite someone above.</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-hairline bg-paper">
      <table className="w-full min-w-[720px] border-collapse text-left text-body">
        <caption className="sr-only">Creators and people invited</caption>
        <thead>
          <tr className="border-b border-hairline text-label text-slate">
            <th scope="col" className={th}>Creator</th>
            <th scope="col" className={th}>Status</th>
            <th scope="col" className={th}>Videos live</th>
            <th scope="col" className={th}>In review</th>
            <th scope="col" className={th}>Changes requested</th>
            <th scope="col" className={th}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.kind}-${row.id}`} className="border-b border-hairline align-top last:border-b-0">
              <th scope="row" className={`${td} font-semibold`}>
                {row.kind === "creator" ? (
                  <Link href={ownerCreatorPath(row.id)} className="inline-flex min-h-11 items-center">
                    {row.name}
                  </Link>
                ) : (
                  <span className="inline-flex min-h-11 items-center">{row.name}</span>
                )}
                <span className="block break-all text-caption font-normal text-slate">{row.email}</span>
              </th>
              <td className={td}>
                <span className="inline-flex flex-col items-start gap-1">
                  <span className={`inline-flex items-center rounded-pill px-space-3 py-1 text-label font-semibold ${tone[row.status]}`}>{row.status}</span>
                  {row.expired && <span className="text-caption text-slate">Expired</span>}
                </span>
              </td>
              <td className={td}>{row.kind === "creator" ? row.live : "—"}</td>
              <td className={td}>{row.kind === "creator" ? row.inReview : "—"}</td>
              <td className={td}>{row.kind === "creator" ? row.changes : "—"}</td>
              <td className={td}>
                {row.status === "Invited" ? (
                  <ResendButton email={row.email} name={row.name} />
                ) : (
                  <PauseButton creatorId={row.id} name={row.name} paused={row.status === "Paused"} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

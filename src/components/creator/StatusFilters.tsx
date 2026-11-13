import Link from "next/link";
import { creatorVideosPath, type CreatorVideoFilter } from "@/lib/routes";
import { filters, type Filter } from "@/lib/creator/rules";

type Props = { current: Filter; counts: Record<Filter, number> };

/** All, In review, Changes requested, Live and Drafts, each with how many videos it holds. They are plain links, so they work without scripts. */
export function StatusFilters({ current, counts }: Props) {
  return (
    <nav aria-label="Filter videos by status">
      <ul className="m-0 flex list-none flex-wrap gap-space-2 p-0">
        {filters.map(({ key, label }) => (
          <li key={key}>
            <Link
              href={creatorVideosPath(key === "all" ? undefined : (key as CreatorVideoFilter))}
              aria-current={current === key ? "page" : undefined}
              className={`inline-flex min-h-11 items-center gap-space-2 rounded-pill border px-space-4 text-label no-underline hover:text-ink ${
                current === key ? "border-ink bg-ink text-cream hover:text-cream" : "border-slate bg-paper text-ink"
              }`}
            >
              {label}
              <span className="font-semibold">{counts[key]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

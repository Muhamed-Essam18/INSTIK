"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { useEffect } from "react";
import { formatHours, spokenHours } from "@/lib/hours/totals";
import { hoursStore } from "@/lib/hours/store";
import { languageSlugFromPathname, roadmapPath } from "@/lib/routes";

type Props = {
  defaultSlug: string;
  /** Slug and code of every language, to find the code for the language in the URL. */
  languages: ReadonlyArray<{ slug: string; code: string }>;
  /**
   * The learner's total seconds per language code from the server, or undefined for a signed-out visitor
   * (and while the header is loading), which shows a neutral pill with no number.
   */
  initialTotals?: Readonly<Record<string, number>>;
};

const CIRCUMFERENCE = 2 * Math.PI * 11;

export function HoursPill({ defaultSlug, languages, initialTotals }: Props) {
  const pathname = usePathname();
  const slug = languageSlugFromPathname(pathname) ?? defaultSlug;
  const code = (languages.find((l) => l.slug === slug) ?? languages.find((l) => l.slug === defaultSlug))?.code;
  const live = useSyncExternalStore(hoursStore.subscribe, hoursStore.getSnapshot, hoursStore.getServerSnapshot);

  // Seed the store from the server's render; a newer heartbeat total already in the store is never lowered.
  useEffect(() => {
    if (initialTotals) hoursStore.seed(initialTotals);
  }, [initialTotals]);

  const seconds = initialTotals && code ? (live[code] ?? initialTotals[code] ?? 0) : undefined;
  const known = seconds !== undefined;
  const hourFraction = known ? (seconds % 3600) / 3600 : 0;

  return (
    <Link
      href={roadmapPath(slug)}
      aria-label={known ? `Hours: ${spokenHours(seconds)}` : "Hours"}
      className="flex min-h-11 items-center gap-2.5 rounded-pill bg-paper py-2 pr-4 pl-2 text-ink no-underline shadow-sm hover:text-ink"
    >
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
        <circle cx="14" cy="14" r="11" fill="none" strokeWidth="4" className="stroke-coral-tint" />
        {known && hourFraction > 0 ? (
          <circle
            cx="14"
            cy="14"
            r="11"
            fill="none"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${hourFraction * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            transform="rotate(-90 14 14)"
            className="stroke-coral"
          />
        ) : null}
      </svg>
      <span className="flex flex-col leading-4">
        <span className="text-xs font-medium text-slate">Hours</span>
        <span className="text-[15px] font-semibold">{known ? formatHours(seconds) : "—"}</span>
      </span>
    </Link>
  );
}

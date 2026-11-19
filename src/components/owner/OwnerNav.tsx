"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { defaultLanguage } from "@/lib/languages";
import { libraryPath, ownerAccessPath, ownerCreatorsPath, ownerEarningsPath, ownerPath, ownerRequestsPath } from "@/lib/routes";

// The owner panel's navigation, as in docs/design/OwnerEarnings.dc.html: Review queue, Creators, Earnings and a link to the learner site.

const items = [
  { label: "Review queue", href: ownerPath(), exact: false },
  { label: "Creators", href: ownerCreatorsPath(), exact: false },
  { label: "Earnings", href: ownerEarningsPath().split("?")[0], exact: false },
  { label: "Access", href: ownerAccessPath(), exact: false },
  { label: "Requests", href: ownerRequestsPath(), exact: false },
] as const;

const linkClass =
  "flex min-h-11 items-center rounded-md px-3.5 py-2.5 text-label no-underline text-ink hover:text-ink focus-visible:outline-ink";

/** Review queue covers `/owner` and the review and waiting pages under it, but not Creators. */
function isCurrent(pathname: string | null, href: string): boolean {
  if (pathname === null) return false;
  if (href === ownerPath()) return pathname === href || pathname.startsWith("/owner/review") || pathname.startsWith("/owner/waiting");
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Links({ pathname }: { pathname: string | null }) {
  return (
    <ul className="m-0 flex list-none flex-wrap items-center gap-space-1 p-0">
      {items.map(({ label, href }) => {
        const current = isCurrent(pathname, href);
        return (
          <li key={href}>
            <Link href={href} aria-current={current ? "page" : undefined} className={`${linkClass} ${current ? "bg-sun font-bold" : ""}`}>
              {label}
            </Link>
          </li>
        );
      })}
      <li>
        <Link href={libraryPath(defaultLanguage.slug)} className={linkClass}>
          Learner site
        </Link>
      </li>
    </ul>
  );
}

export function OwnerNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Owner panel" className="mb-space-8 flex flex-wrap items-center gap-space-4 border-b border-hairline pb-space-4">
      <span className="flex min-h-11 items-baseline gap-space-2 pr-space-2">
        <span className="font-display text-[22px] leading-7 font-extrabold text-ink">owner</span>
      </span>
      <Links pathname={pathname} />
    </nav>
  );
}

/** The same links without a current marker, for when the path is not yet known. */
export function OwnerNavFallback() {
  return (
    <nav aria-label="Owner panel" className="mb-space-8 flex flex-wrap items-center gap-space-4 border-b border-hairline pb-space-4">
      <Links pathname={null} />
    </nav>
  );
}

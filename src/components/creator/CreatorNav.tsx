"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { creatorHostPath, creatorPath, creatorUploadPath, creatorVideosPath } from "@/lib/routes";

// The creator panel's navigation, as in docs/design/CreatorUpload.dc.html: an ink column with four links and who is signed in.

const items = [
  { label: "Dashboard", href: creatorPath(), exact: true },
  { label: "Upload a video", href: creatorUploadPath(), exact: false },
  { label: "My videos", href: creatorVideosPath(), exact: false },
  { label: "My host page", href: creatorHostPath(), exact: false },
] as const;

const linkClass =
  "flex min-h-11 items-center rounded-md px-3.5 py-2.5 text-label no-underline text-cream hover:text-cream focus-visible:outline-cream";

function Links({ pathname }: { pathname: string | null }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-space-1 p-0">
      {items.map(({ label, href, exact }) => {
        const current = pathname !== null && (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));
        return (
          <li key={href}>
            <Link href={href} aria-current={current ? "page" : undefined} className={`${linkClass} ${current ? "bg-slate font-bold" : ""}`}>
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Frame({ children, signedInAs }: { children: React.ReactNode; signedInAs: string | null }) {
  return (
    <nav aria-label="Creator panel" className="flex flex-col gap-space-4 bg-ink px-space-4 py-space-6 text-cream md:min-h-screen md:w-64 md:shrink-0">
      <Link href={creatorPath()} className="flex min-h-11 items-baseline gap-space-2 px-3.5 text-cream no-underline hover:text-cream">
        <span className="font-display text-[28px] leading-8 font-extrabold">instik</span>
        <span className="text-label text-sun">creator</span>
      </Link>
      {children}
      {signedInAs ? <p className="m-0 mt-auto px-3.5 text-label text-cream">Signed in as {signedInAs}</p> : null}
    </nav>
  );
}

export function CreatorNav({ signedInAs }: { signedInAs: string | null }) {
  const pathname = usePathname();
  return (
    <Frame signedInAs={signedInAs}>
      <Links pathname={pathname} />
    </Frame>
  );
}

/** The same links without a current marker, shown while the pathname is not yet known. */
export function CreatorNavFallback() {
  return (
    <Frame signedInAs={null}>
      <Links pathname={null} />
    </Frame>
  );
}

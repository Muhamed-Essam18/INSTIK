"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { hostsPath, languageSlugFromPathname, libraryPath, roadmapPath } from "@/lib/routes";

const itemClass =
  "flex min-h-11 items-center rounded-md px-3.5 py-2.5 text-label no-underline hover:text-ink";

export function MainNav({ defaultSlug }: { defaultSlug: string }) {
  const pathname = usePathname();
  const slug = languageSlugFromPathname(pathname) ?? defaultSlug;

  const items = [
    { label: "Library", href: libraryPath(slug) },
    { label: "Roadmap", href: roadmapPath(slug) },
    { label: "Hosts", href: hostsPath(slug) },
  ];

  return (
    <nav aria-label="Main" className="flex flex-wrap gap-space-2">
      {items.map(({ label, href }) => {
        const current = pathname === href;
        return (
          <Link
            key={label}
            href={href}
            aria-current={current ? "page" : undefined}
            className={`${itemClass} ${current ? "bg-coral-tint text-ink" : "text-slate"}`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Same links without a current marker, shown while the pathname is not yet known. */
export function MainNavFallback({ defaultSlug }: { defaultSlug: string }) {
  const items = [
    { label: "Library", href: libraryPath(defaultSlug) },
    { label: "Roadmap", href: roadmapPath(defaultSlug) },
    { label: "Hosts", href: hostsPath(defaultSlug) },
  ];
  return (
    <nav aria-label="Main" className="flex flex-wrap gap-space-2">
      {items.map(({ label, href }) => (
        <Link key={label} href={href} className={`${itemClass} text-slate`}>
          {label}
        </Link>
      ))}
    </nav>
  );
}

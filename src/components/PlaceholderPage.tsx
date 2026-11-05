import Link from "next/link";
import type { ReactNode } from "react";

type PageLink = { href: string; label: string };

type Props = {
  title: string;
  note: string;
  backHref: string;
  backLabel: string;
  /** Further links to working pages, so no screen is a dead end. */
  moreLinks?: PageLink[];
  children?: ReactNode;
};

const linkClass = "inline-flex min-h-11 items-center self-start text-label underline";

export function PlaceholderPage({ title, note, backHref, backLabel, moreLinks = [], children }: Props) {
  return (
    <div className="flex flex-col gap-space-4">
      <h1 className="font-display text-title text-ink">{title}</h1>
      <p className="text-body-lg text-ink">{note}</p>
      {children}
      {[{ href: backHref, label: backLabel }, ...moreLinks].map(({ href, label }) => (
        <Link key={href} href={href} className={linkClass}>
          {label}
        </Link>
      ))}
    </div>
  );
}

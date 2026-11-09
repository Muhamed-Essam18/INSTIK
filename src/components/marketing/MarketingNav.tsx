"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { nav } from "@/lib/marketing/copy";
import { howItWorksPath, pricingPath } from "@/lib/routes";

const itemClass = "inline-flex min-h-11 items-center px-3.5 text-[15px] text-ink no-underline hover:text-ink";

export function MarketingNav({ hostsHref }: { hostsHref: string }) {
  const pathname = usePathname();
  const items = [
    { label: nav.howItWorks, href: howItWorksPath(), current: false },
    { label: nav.hosts, href: hostsHref, current: false },
    { label: nav.pricing, href: pricingPath(), current: pathname === pricingPath() },
  ];
  return (
    <nav aria-label="Main" className="flex flex-wrap gap-1">
      {items.map(({ label, href, current }) => (
        <Link
          key={label}
          href={href}
          aria-current={current ? "page" : undefined}
          className={`${itemClass} ${current ? "font-semibold underline" : "font-medium"}`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

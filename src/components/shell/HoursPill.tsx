import Link from "next/link";

export function HoursPill({ href }: { href: string }) {
  return (
    <Link
      href={href}
      aria-label="Hours are not tracked yet"
      className="flex min-h-11 items-center gap-2.5 rounded-pill bg-paper py-2 pr-4 pl-2 text-ink no-underline shadow-sm hover:text-ink"
    >
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
        <circle cx="14" cy="14" r="11" fill="none" strokeWidth="4" className="stroke-coral-tint" />
      </svg>
      <span className="flex flex-col leading-4">
        <span className="text-xs font-medium text-slate">Hours</span>
        <span className="text-[15px] font-semibold">—</span>
      </span>
    </Link>
  );
}

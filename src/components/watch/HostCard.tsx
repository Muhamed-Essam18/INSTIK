import Link from "next/link";
import type { Host } from "@/lib/content/schema";
import { hostPath } from "@/lib/routes";

type Props = {
  languageSlug: string;
  host: Host;
  /** The first host gets the sun-coloured initial, the rest teal (as on the host page). */
  first?: boolean;
};

export function HostCard({ languageSlug, host, first = false }: Props) {
  return (
    <Link
      href={hostPath(languageSlug, host.slug)}
      className="flex items-center gap-3 rounded-md bg-paper py-2.5 pr-4 pl-2.5 text-ink no-underline shadow-sm hover:text-ink"
    >
      <span
        aria-hidden="true"
        className={`flex size-11 items-center justify-center rounded-pill font-display text-[18px] font-extrabold ${
          first ? "bg-sun" : "bg-teal"
        }`}
      >
        {host.name.charAt(0)}
      </span>
      <span className="flex flex-col leading-[18px]">
        <span className="text-[12px] font-medium text-slate">Your host</span>
        <span className="text-[15px] font-semibold">{host.name}</span>
      </span>
    </Link>
  );
}

import Link from "next/link";
import type { PublicHost } from "@/lib/content/mappers";
import { hostPath } from "@/lib/routes";

type Props = { languageSlug: string; hosts: PublicHost[] };

export function OtherHosts({ languageSlug, hosts }: Props) {
  return (
    <section aria-labelledby="other-hosts" className="flex flex-col gap-space-6 sm:gap-5">
      <h2 id="other-hosts" className="m-0 font-display text-[28px] leading-[34px] font-extrabold">
        Other hosts
      </h2>
      <div className="flex flex-wrap gap-space-4">
        {hosts.map((host) => (
          <Link
            key={host.slug}
            href={hostPath(languageSlug, host.slug)}
            className="flex items-center gap-3.5 rounded-lg bg-paper py-3 pr-5 pl-3 text-ink no-underline hover:text-ink"
          >
            <span
              aria-hidden="true"
              className="flex size-14 items-center justify-center rounded-pill bg-teal font-display text-[22px] font-extrabold"
            >
              {host.name.charAt(0)}
            </span>
            <span className="flex flex-col">
              <span className="font-semibold">{host.name}</span>
              <span className="text-caption text-slate">{host.topics.slice(0, 3).join(", ")}</span>
            </span>
          </Link>
        ))}
        <div className="flex items-center gap-3.5 rounded-lg border-2 border-dashed border-hairline py-3 pr-5 pl-3 text-slate">
          <span aria-hidden="true" className="size-14 rounded-pill bg-paper" />
          <span className="text-label font-normal">More hosts joining soon</span>
        </div>
      </div>
    </section>
  );
}

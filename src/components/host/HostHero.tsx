import Link from "next/link";
import { TargetText } from "@/components/TargetText";
import type { Host } from "@/lib/content/schema";
import type { Language } from "@/lib/languages.schema";

type Props = {
  language: Language;
  host: Host;
  /** The video behind "Watch … say hello"; the action is left out when the host has none. */
  helloHref?: string;
  /** The first host gets the sun-coloured placeholder, the rest teal. */
  first?: boolean;
};

export function HostHero({ language, host, helloHref, first = false }: Props) {
  const label = `Host · ${[language.variety, language.name].filter(Boolean).join(" ")}`;
  return (
    <section className="flex flex-wrap items-center gap-space-12">
      <div
        className={`box-border flex aspect-[4/5] flex-[0_1_400px] items-end rounded-lg p-5 ${
          host.photo ? "" : first ? "bg-sun" : "bg-teal"
        }`}
      >
        {host.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={host.photo} alt={`${host.name}, host`} className="size-full rounded-lg object-cover" />
        ) : (
          <span className="text-caption text-ink">Photo coming soon</span>
        )}
      </div>
      <div className="flex flex-[1_1_420px] flex-col gap-space-4">
        <span className="text-label text-teal-text">{label}</span>
        <h1 className="m-0 font-display text-[56px] leading-[60px] font-extrabold">{host.name}</h1>
        <span className="self-start">
          <TargetText language={language} sizeClass="text-[24px] leading-9 font-medium">
            {host.nameArabic}
          </TargetText>
        </span>
        <p className="m-0 text-body-lg">{host.story}</p>
        <ul aria-label="Topics" className="m-0 flex list-none flex-wrap gap-space-2 p-0">
          {host.topics.map((topic) => (
            <li key={topic} className="rounded-pill bg-paper px-3 py-1.5 text-label">
              {topic}
            </li>
          ))}
        </ul>
        {helloHref ? (
          <Link
            href={helloHref}
            className="inline-flex h-[52px] items-center gap-2.5 self-start rounded-md bg-coral px-6 text-body font-semibold text-ink no-underline hover:text-ink"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 5.5v13l10.5-6.5z" fill="#1b2340" />
            </svg>
            Watch {host.name} say hello
          </Link>
        ) : null}
      </div>
    </section>
  );
}

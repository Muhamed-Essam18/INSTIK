import Link from "next/link";
import type { ReactNode } from "react";
import { defaultLanguage } from "@/lib/languages";
import { landing } from "@/lib/marketing/copy";
import { hostsPath } from "@/lib/routes";
import { Wrap } from "./Wrap";

const icon = (children: ReactNode) => (
  <svg
    width="26"
    height="26"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#1b2340"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const marks = [
  {
    bg: "bg-sun",
    svg: icon(
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" />
      </>,
    ),
  },
  { bg: "bg-coral-tint", svg: icon(<path d="M4 18h4v-5H4zM10 18h4V9h-4zM16 18h4V5h-4z" />) },
  {
    bg: "bg-teal",
    svg: icon(
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v4l3 2" />
      </>,
    ),
  },
];

export function Pillars() {
  return (
    <section aria-label={landing.pillarsLabel} className="bg-paper">
      <Wrap className="grid grid-cols-1 gap-8 py-16 md:grid-cols-3 md:py-24">
        {landing.pillars.map((pillar, i) => (
          <div key={pillar.title} className="flex flex-col gap-3">
            <span className={`flex size-14 items-center justify-center rounded-pill ${marks[i].bg}`}>{marks[i].svg}</span>
            <h2 className="font-display text-[26px] leading-8 font-extrabold">{pillar.title}</h2>
            <p className="text-[17px] leading-[27px]">{pillar.body}</p>
            {"link" in pillar && (
              <Link
                href={hostsPath(defaultLanguage.slug)}
                className="inline-flex min-h-11 items-center text-[15px] font-semibold"
              >
                {pillar.link}
              </Link>
            )}
          </div>
        ))}
      </Wrap>
    </section>
  );
}

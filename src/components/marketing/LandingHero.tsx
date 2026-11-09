import Link from "next/link";
import { defaultLanguage } from "@/lib/languages";
import { landing, nav } from "@/lib/marketing/copy";
import { waitlistPath } from "@/lib/routes";
import { largeButton } from "./buttons";
import { StartCta } from "./StartLink";
import { Wrap } from "./Wrap";

const languageName = [defaultLanguage.variety, defaultLanguage.name].filter(Boolean).join(" ");

export function LandingHero() {
  const { hero } = landing;
  const { sample } = hero;
  return (
    <section>
      <Wrap className="flex flex-wrap items-center gap-16 pt-16 pb-24">
        <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-6">
          <span className="self-start rounded-pill bg-paper px-3.5 py-1.5 text-label text-teal-text">
            {hero.badge(languageName)}
          </span>
          <h1 className="font-display text-[40px] leading-[46px] font-extrabold tracking-[-0.015em] sm:text-[64px] sm:leading-[68px]">
            {hero.title}
          </h1>
          <p className="max-w-[520px] text-[20px] leading-[30px]">{hero.body(languageName)}</p>
          <div className="flex flex-wrap items-center gap-4">
            <StartCta className={largeButton}>{nav.start}</StartCta>
            <Link href={waitlistPath()} className="inline-flex min-h-11 items-center text-[15px] font-semibold">
              {hero.waitlistHint}
            </Link>
          </div>
        </div>

        <div aria-hidden="true" className="relative flex min-w-0 flex-[1_1_440px] justify-center pb-7">
          <div className="flex w-full max-w-[500px] flex-col gap-4 rounded-lg bg-paper p-4 shadow-md">
            <div className="relative flex aspect-[16/10] items-center justify-center rounded-md bg-ink">
              <span className="absolute top-3.5 left-4 text-caption text-cream">{sample.hostLabel}</span>
              <span className="flex size-16 items-center justify-center rounded-pill bg-coral">
                <svg width="24" height="24" viewBox="0 0 24 24">
                  <path d="M8 5.5v13l10.5-6.5z" fill="#1b2340" />
                </svg>
              </span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-md bg-coral-tint px-3 pt-2 pb-3">
              <p lang="arz" dir="rtl" className="font-naskh text-[26px] leading-[46px] text-right">
                {sample.before} <mark className="rounded-sm bg-sun px-1 text-ink">{sample.highlight}</mark>
                {sample.after}
              </p>
              <p className="text-translit italic">{sample.transliteration}</p>
              <p className="text-translit text-slate">{sample.translation}</p>
            </div>
          </div>
          <div className="absolute right-0 bottom-0 flex items-center gap-3 rounded-pill bg-ink px-5 py-3.5 text-cream shadow-md sm:-right-2 sm:-bottom-1">
            <svg width="28" height="28" viewBox="0 0 28 28">
              <circle cx="14" cy="14" r="11" fill="none" stroke="#fff4e633" strokeWidth="4" />
              <circle
                cx="14"
                cy="14"
                r="11"
                fill="none"
                stroke="#ff6a4d"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray="46 69"
                transform="rotate(-90 14 14)"
              />
            </svg>
            <span className="text-[15px] font-semibold">{sample.hoursBadge(languageName)}</span>
          </div>
        </div>
      </Wrap>
    </section>
  );
}

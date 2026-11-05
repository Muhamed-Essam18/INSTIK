import Link from "next/link";
import type { Language } from "@/lib/languages.schema";
import { landingPath } from "@/lib/routes";

export function ComingSoonNotice({ language }: { language: Language }) {
  const label = language.variety ? `${language.variety} ${language.name}` : language.name;
  return (
    <div className="flex flex-col gap-space-4">
      <h1 className="font-display text-title text-ink">{label} is coming soon</h1>
      <p className="text-body-lg text-ink">We are still getting {label} ready. Check back soon.</p>
      <Link href={landingPath()} className="inline-flex min-h-11 items-center self-start text-label underline">
        Back to the start
      </Link>
    </div>
  );
}

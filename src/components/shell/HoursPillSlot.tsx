import { languages } from "@/lib/languages";
import { getHoursByLanguage } from "@/lib/hours/queries";
import { getLearner } from "@/lib/session";
import { HoursPill } from "./HoursPill";

const choices = languages.map(({ slug, code }) => ({ slug, code }));

/** Reads the session and the learner's hours, so the header renders it behind its own Suspense boundary. */
export async function HoursPillSlot({ defaultSlug }: { defaultSlug: string }) {
  const learner = await getLearner();
  if (!learner) return <HoursPill defaultSlug={defaultSlug} languages={choices} />;
  return <HoursPill defaultSlug={defaultSlug} languages={choices} initialTotals={await getHoursByLanguage(learner.id)} />;
}

/** The same pill without a number: shown while the header loads and to signed-out visitors. */
export function HoursPillFallback({ defaultSlug }: { defaultSlug: string }) {
  return <HoursPill defaultSlug={defaultSlug} languages={choices} />;
}

import { isAvailable, languages } from "../languages";
import { loadAllContent } from "./load";

// Next.js (Cache Components) needs at least one sample value for a dynamic route to know its address while building,
// otherwise the header cannot prerender. The samples come from the files in content/ (the import source), so the build
// still needs no database. They are only samples: every page reads the database when it is opened, and a video or host
// that is not in this list is rendered the first time it is visited.

export function sampleVideoParams(): { language: string; video: string }[] {
  const content = loadAllContent();
  return languages
    .filter(isAvailable)
    .flatMap((l) => (content.get(l.slug)?.videos ?? []).map((v) => ({ language: l.slug, video: v.slug })));
}

export function sampleHostParams(): { language: string; host: string }[] {
  const content = loadAllContent();
  return languages
    .filter(isAvailable)
    .flatMap((l) => (content.get(l.slug)?.hosts ?? []).map((h) => ({ language: l.slug, host: h.slug })));
}

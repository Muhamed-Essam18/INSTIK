import type { Language } from "@/lib/languages.schema";

/** How a language is named to learners: its variety then its name, for example "Egyptian Arabic". */
export const languageName = (l: Pick<Language, "variety" | "name">) => [l.variety, l.name].filter(Boolean).join(" ");

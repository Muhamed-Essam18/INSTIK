import data from "../../content/languages.json";
import { parseLanguagesFile, type Language } from "./languages.schema";

// Parsed at module load so an invalid file fails `next build`.
export const languages: readonly Language[] = parseLanguagesFile(data);

export function isAvailable(language: Language): boolean {
  return language.status === "available";
}

export const defaultLanguage: Language = languages.find(isAvailable)!;

export function getLanguageBySlug(slug: string): Language | undefined {
  return languages.find((l) => l.slug === slug);
}

export function getLanguageByCode(code: string): Language | undefined {
  return languages.find((l) => l.code === code);
}

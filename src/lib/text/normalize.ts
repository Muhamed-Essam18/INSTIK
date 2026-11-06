const COMBINING_MARKS = /\p{M}/gu; // Latin accents and Arabic tashkeel (U+064B–U+065F, U+0670, U+06D6–U+06ED)
const TATWEEL = /ـ/g;

/** Folds text for matching only: no accents, tashkeel, letter variants or case. Stored text is never altered. */
export function normalizeForSearch(text: string): string {
  return text
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .replace(TATWEEL, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Arabic vowel marks and Quranic annotation marks, plus tatweel (stretching).
const TASHKEEL = /[ً-ٰٟۖ-ۭـ]/g;

/**
 * Removes tashkeel and tatweel for display and word matching. Unlike normalizeForSearch it does not
 * decompose or fold letters, so أ إ آ ا stay distinct. Stored text is never altered.
 */
export function stripTashkeel(text: string): string {
  return text.replace(TASHKEEL, "");
}

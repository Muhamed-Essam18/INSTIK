// A video's address name, made once when its creator first submits it (data-model.md). Pure.

const MAX = 60;

/** Lower-case Latin words joined by hyphens; accents are dropped. A title with no Latin letters or digits (for example only Arabic) gives "video". */
export function slugify(title: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX)
    .replace(/-+$/g, "");
  return slug || "video";
}

/** The first of `base`, `base-2`, `base-3`… that `isTaken` does not report as taken. */
export async function uniqueSlug(base: string, isTaken: (slug: string) => Promise<boolean>): Promise<string> {
  if (!(await isTaken(base))) return base;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base}-${n}`;
    if (!(await isTaken(candidate))) return candidate;
  }
  return `${base}-${Date.now()}`;
}

/** The placeholder address a draft has until its first submit. */
export const draftSlug = (id: string): string => `draft-${id}`;
export const isDraftSlug = (slug: string): boolean => slug.startsWith("draft-");

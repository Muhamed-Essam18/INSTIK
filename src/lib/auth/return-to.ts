const MAX_LENGTH = 512;

const slug = "[a-z0-9]+(?:-[a-z0-9]+)*";
const query = String.raw`(?:\?[A-Za-z0-9=&_%.,~-]*)?`;
const shapes = [
  `/`,
  `/learn/${slug}`,
  `/learn/${slug}/watch/${slug}`,
  `/learn/${slug}/roadmap`,
  `/learn/${slug}/done`,
  `/learn/${slug}/hosts`,
  `/learn/${slug}/hosts/${slug}`,
  `/settings`,
  `/settings/add-language`,
  `/pricing`,
  `/onboarding/finish`,
  // The creator programme: an invitation link (a 43-character token) and the creator and owner areas.
  `/invite/[A-Za-z0-9_-]{20,64}`,
  `/creator`,
  `/owner`,
  `/owner/creators`,
].map((shape) => new RegExp(`^${shape}${query}$`));

// The purchase link: only the two known periods, never the generic query pattern (nothing else under /billing is allowed).
const exactShapes = [/^\/billing\/start\?period=(?:monthly|yearly)$/];

/** Addresses of the creator programme. Someone going there has no learner profile to set up, so signing in goes straight back. */
export const isStaffPath = (path: string | undefined): boolean => path !== undefined && /^\/(?:invite\/|creator$|owner(?:\/|$))/.test(path);

/**
 * A return address is only ever a path inside this site matching a known route shape. Anything else
 * (another site, a protocol-relative address, a path with control characters or an API route) becomes `fallback`.
 */
export function sanitiseReturnTo(value: unknown, fallback: string): string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_LENGTH) return fallback;
  return shapes.some((shape) => shape.test(value)) || exactShapes.some((shape) => shape.test(value)) ? value : fallback;
}

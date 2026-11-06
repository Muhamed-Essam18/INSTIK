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
  `/onboarding/finish`,
].map((shape) => new RegExp(`^${shape}${query}$`));

/**
 * A return address is only ever a path inside this site matching a known route shape. Anything else
 * (another site, a protocol-relative address, a path with control characters or an API route) becomes `fallback`.
 */
export function sanitiseReturnTo(value: unknown, fallback: string): string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_LENGTH) return fallback;
  return shapes.some((shape) => shape.test(value)) ? value : fallback;
}

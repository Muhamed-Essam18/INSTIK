import "server-only";
import Stripe from "stripe";
import { env } from "@/lib/env";
import { siteUrl } from "@/lib/site";

let cached: Stripe | undefined;

/** The Stripe client, created on first use. Throws a clear error when billing is not configured. */
export function stripe(): Stripe {
  if (cached) return cached;
  const key = env().STRIPE_SECRET_KEY;
  if (!key) throw new Error("Billing is not configured: STRIPE_SECRET_KEY is not set");
  cached = new Stripe(key);
  return cached;
}

/** The public origin used in Checkout and portal return addresses. */
export function siteOrigin(): string {
  return siteUrl();
}

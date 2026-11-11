import "server-only";
import { billingReady } from "./plans";

/**
 * True when billing can start a charge: real prices, a Stripe key and a webhook secret. Reads the environment directly
 * (not the full validated environment) so pages that only ask this question never fail for an unrelated missing setting.
 */
export function billingEnabled(): boolean {
  return billingReady({
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  });
}

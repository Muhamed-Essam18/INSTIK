export async function register() {
  // A misconfigured deployment should fail when the server starts, not when the first learner signs in.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { env } = await import("@/lib/env");
    env();
    // The price config must be consistent (both amounts or neither, yearly cheaper than twelve months) before any page shows it.
    const { validateBilling } = await import("@/lib/billing/plans");
    validateBilling();
  }
}

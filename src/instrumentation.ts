export async function register() {
  // A misconfigured deployment should fail when the server starts, not when the first learner signs in.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { env } = await import("@/lib/env");
    env();
  }
}

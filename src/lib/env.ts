import "server-only";
import { z } from "zod";

const postgresUrl = z.string().regex(/^postgres(ql)?:\/\//, "must be a postgres connection string");

const envSchema = z.object({
  DATABASE_URL: postgresUrl,
  DIRECT_URL: postgresUrl,
  AUTH_SECRET: z.string().min(32),
  AUTH_URL: z.string().min(1).optional(),
  AUTH_GOOGLE_ID: z.string().min(1),
  AUTH_GOOGLE_SECRET: z.string().min(1),
  AUTH_RESEND_KEY: z.string().min(1),
  EMAIL_FROM: z.string().min(1),
  IP_HASH_SALT: z.string().min(16),
});

export type Env = z.infer<typeof envSchema>;

/** Parses an environment object. The error names the variables, never their values. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  // An empty string means "not set" (a blank line in .env.local).
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== undefined && v !== ""));
  const result = envSchema.safeParse(cleaned);
  if (result.success) return result.data;
  const names = [...new Set(result.error.issues.map((i) => String(i.path[0])))];
  throw new Error(`Missing or invalid environment variables: ${names.join(", ")} (see .env.example)`);
}

let cached: Env | undefined;

/** The server environment, parsed on first use (never at import time, so build and tests need no secrets). */
export function env(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}

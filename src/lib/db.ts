import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/lib/env";

const globalForDb = globalThis as unknown as { prisma?: PrismaClient };

/**
 * The database client, created on first use (never at import time, so `next build` and tests need no secrets).
 * In development the client is kept on `globalThis` so hot reload does not open a new connection pool each time.
 */
export function db(): PrismaClient {
  if (globalForDb.prisma) return globalForDb.prisma;
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: env().DATABASE_URL }) });
  if (process.env.NODE_ENV !== "production") globalForDb.prisma = client;
  return client;
}

import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// Prisma 7 does not read env files, and Next's `.env.local` is not one it knows, so load it here.
// Values already in the environment (CI, hosting) win because loadEnvFile never overrides them.
for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

// Migrations use Neon's direct (non-pooled) connection. Generating the client needs no database,
// so a missing value must not fail `prisma generate` (it runs on install).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DIRECT_URL ?? "" },
});

import { defineConfig } from "prisma/config";

// Migrations use Neon's direct (non-pooled) connection. Generating the client needs no database,
// so a missing value must not fail `prisma generate` (it runs on install).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DIRECT_URL ?? "" },
});

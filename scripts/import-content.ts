// Moves the sample videos, hosts, transcripts and glossary from content/ into the database. Safe to run again:
// rows that already exist are left exactly as they are. Languages stay in content/languages.json.
//
//   npm run import:content                 import and print the report
//   npm run import:content -- --dry-run    print what would happen; write nothing
//   npm run import:content -- --json       print the report as JSON
//
// Exit code 0: nothing failed and nothing is incomplete. 1: something failed or is incomplete (see the report).
// 2: setup problem (no DATABASE_URL, unreadable content/languages.json).
//
// Run by tsx, not plain Node: the validators and the generated Prisma client use extensionless imports.
// This script and everything it imports MUST NOT import `server-only`, `db()` or `env()`.

import { existsSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { readLanguageFolder } from "../src/lib/content/load";
import { prismaImportStore } from "../src/lib/content/import/store";
import { formatReport, runImport } from "../src/lib/content/import/run";
import { isAvailable, languages } from "../src/lib/languages";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file); // never overrides values already in the environment
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const asJson = args.includes("--json");

function fail(message: string): never {
  console.error(message);
  process.exit(2);
}

const url = process.env.DATABASE_URL;
if (!url) fail("DATABASE_URL is not set (see .env.example).");

// An async function, not top-level await: tsx runs this file as CommonJS.
async function main() {
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    const report = await runImport({
      languages: languages.map((l) => ({
        code: l.code,
        slug: l.slug,
        available: isAvailable(l),
        transcriptLayers: l.transcriptLayers,
      })),
      readRaw: readLanguageFolder,
      store: prismaImportStore(client),
      dryRun,
    });
    console.log(asJson ? JSON.stringify(report, null, 2) : formatReport(report));
    process.exitCode = report.ok ? 0 : 1;
  } finally {
    await client.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

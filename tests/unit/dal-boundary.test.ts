import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Constitution XI: code outside the Data Access Layer must not query the database directly. The layer is listed in
// specs/008-roles-invites-content-db/plan.md ("Data Access Layer"). Adding a file that imports the database client to
// this list is a decision to make on purpose, not by accident.

const allowed = [
  // The session and the role gates.
  "src/lib/session.ts",
  // Auth.js adapter (sessions and accounts).
  "src/auth.ts",
  // Stores and data modules, each scoped by the signed-in user, an actor, or Approved-only.
  "src/lib/auth/throttle.ts",
  "src/lib/billing/checkout.ts",
  "src/lib/billing/store.ts",
  "src/lib/billing/subscription.ts",
  "src/lib/content/creator-reads.ts",
  "src/lib/content/index.ts",
  "src/lib/content/status-store.ts",
  "src/lib/creator/store.ts",
  "src/lib/hours/queries.ts",
  "src/lib/hours/service.ts",
  "src/lib/invites/store.ts",
  "src/lib/mux/store.ts",
  "src/lib/learner/preferences.ts",
  "src/lib/learner/profiles.ts",
  "src/lib/waitlist/actions.ts",
  "src/lib/waitlist/throttle.ts",
];

const root = process.cwd();

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === "generated" ? [] : sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

const rel = (file: string) => path.relative(root, file).replace(/\\/g, "/");
const files = sourceFiles(path.join(root, "src"));

describe("the Data Access Layer boundary", () => {
  it("lets only the listed modules import the database client", () => {
    const importers = files
      .filter((f) => /from\s+["']@\/lib\/db["']/.test(readFileSync(f, "utf8")))
      .map(rel)
      .sort();
    expect(importers).toEqual([...allowed].sort());
  });

  it("keeps pages, components and server actions away from the database client", () => {
    const offenders = files
      .map(rel)
      .filter((f) => f.startsWith("src/app/") || f.startsWith("src/components/") || /\/actions\.ts$/.test(f))
      .filter((f) => !allowed.includes(f))
      .filter((f) => /@\/lib\/db["']/.test(readFileSync(path.join(root, f), "utf8")));
    expect(offenders).toEqual([]);
  });

  it("gives every learner-facing content read no way to ask for a status", () => {
    const source = readFileSync(path.join(root, "src/lib/content/index.ts"), "utf8");
    const exported = [...source.matchAll(/export (?:async )?function (\w+)\(([^)]*)\)/g)];
    expect(exported.map((m) => m[1]).sort()).toEqual(
      ["getGlossary", "getHost", "getHosts", "getTranscript", "getTranscriptView", "getVideo", "getVideos", "getVideosByHost"].sort(),
    );
    for (const [, name, params] of exported) expect(params, name).not.toMatch(/status/i);
  });

  it("filters every video query in the learner module through the one Approved-only helper", () => {
    const source = readFileSync(path.join(root, "src/lib/content/index.ts"), "utf8");
    // Each video query: the text from `db().video.` to the end of its statement must carry the shared filter.
    const queries = source.split("db().video.").slice(1).map((rest) => rest.slice(0, rest.indexOf(";")));
    expect(queries.length).toBeGreaterThanOrEqual(4);
    for (const q of queries) expect(q).toMatch(/\.\.\.approvedOnly/);
  });

  it("never reads learner-facing hosts or videos in pages or components through creator-reads", () => {
    const importers = files
      .filter((f) => /content\/creator-reads["']/.test(readFileSync(f, "utf8")))
      .map(rel);
    expect(importers.filter((f) => f.startsWith("src/components/") || f.startsWith("src/app/(shell)/"))).toEqual([]);
  });
});

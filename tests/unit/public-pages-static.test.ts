import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Public pages (landing, Library, hosts, pricing) must stay static and open to everyone. Reading the session in
// them would make them dynamic and tempt a sign-in wall. Only the header's user slot and the protected pages may.

function sourceFiles(path: string): string[] {
  if (statSync(path).isFile()) return [path];
  return readdirSync(path).flatMap((name) => sourceFiles(join(path, name)));
}

const publicSources = [
  "src/app/(shell)/page.tsx",
  "src/app/(shell)/pricing",
  "src/app/(shell)/learn/[language]/page.tsx",
  "src/app/(shell)/learn/[language]/hosts",
  "src/components/screens/LibraryScreen.tsx",
  "src/components/screens/HostScreen.tsx",
  "src/components/library",
  "src/components/host",
].flatMap(sourceFiles);

describe("public pages", () => {
  it("find the files to check", () => {
    expect(publicSources.length).toBeGreaterThan(8);
  });

  it.each(publicSources)("%s does not read the session, auth or the database", (file) => {
    expect(readFileSync(file, "utf8")).not.toMatch(/@\/lib\/session|@\/auth["']|@\/lib\/db/);
  });
});

// Manual check (quickstart scenarios 1 and 2): in a private window the landing page, Library, host pages and
// pricing show full content with no sign-in prompt; a video address redirects to onboarding with its title and host.

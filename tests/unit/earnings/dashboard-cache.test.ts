import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { creatorActor, setupEarnings } from "../../helpers/earnings-memory";

// The cached dashboard reader is a dependency of the service, wired in one place (spec 11 FR-014, research.md section 10; constitution XI).

const read = (file: string) => readFileSync(file, "utf8");
const files = (path: string): string[] =>
  statSync(path).isFile() ? [path] : readdirSync(path).flatMap((name) => files(join(path, name)));
const sources = files("src").filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes("generated"));

describe("readCreatorDashboard", () => {
  const source = read("src/lib/earnings/dashboard.ts");

  it("is a cached scope that gets its creator id as an argument, lives about a minute and carries per-creator and request tags", () => {
    expect(source).toMatch(/"use cache"/);
    expect(source).toMatch(/export async function readCreatorDashboard\(creatorId: string, month: string, minute: string\)/);
    expect(source).toMatch(/cacheLife\(\{ revalidate: 60, expire: 300 \}\)/);
    expect(source).toMatch(/cacheTag\(`creator-stats:\$\{creatorId\}`, "creator-earnings", "creator-requests"\)/);
  });

  it("reads no session, cookie or header inside the cache and takes only plain strings", () => {
    expect(source).not.toMatch(/cookies\(|headers\(|@\/lib\/session|@\/auth/);
  });

  it("is imported only by instance.ts, and the service never imports it", () => {
    const importers = sources.filter((f) => /from\s+["'](\.\/dashboard|@\/lib\/earnings\/dashboard)["']/.test(read(f)));
    expect(importers.map((f) => f.replace(/\\/g, "/"))).toEqual(["src/lib/earnings/instance.ts"]);
    expect(read("src/lib/earnings/service.ts")).not.toMatch(/["']\.\/dashboard["']/);
  });
});

describe("the service and the reader", () => {
  it("resolves the creator id from the actor's own id, never from input", async () => {
    const t = setupEarnings({ now: "2026-11-11T12:00:00Z" });
    await t.service.getDashboard(creatorActor("ann"));
    await t.service.getDashboard(creatorActor("bob"));
    expect(t.dashCalls.map((c) => c.creatorId)).toEqual(["ann", "bob"]);
  });

  it("passes different arguments for different creators, so their cache entries can never be shared", async () => {
    const t = setupEarnings({ now: "2026-11-11T12:00:00Z" });
    await t.service.getDashboard(creatorActor("ann"));
    await t.service.getDashboard(creatorActor("bob"));
    expect(new Set(t.dashCalls.map((c) => JSON.stringify(c))).size).toBe(2);
  });

  it("passes the minute so a cache entry never outlives its minute's key", async () => {
    const t = setupEarnings({ now: "2026-11-11T12:00:42Z" });
    await t.service.getDashboard(creatorActor("ann"));
    expect(t.dashCalls[0].minute).toBe("2026-11-11T12:00:00.000Z");
  });

  it("takes the reader as a dependency (tests pass a plain function)", () => {
    expect(read("src/lib/earnings/service.ts")).toMatch(/readDashboard\?: ReadDashboard/);
    expect(read("src/lib/earnings/instance.ts")).toMatch(/readDashboard: readCreatorDashboard/);
  });
});

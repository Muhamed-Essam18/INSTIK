import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createCreatorsService, type CreatorsStore } from "@/lib/creators/service";
import { createInviteService, type InviteStore } from "@/lib/invites/service";
import { setupEarnings } from "../helpers/earnings-memory";
import { account, setupGrants } from "../helpers/grants-memory";
import { setupRequests } from "../helpers/requests-memory";
import { ForbiddenError } from "@/lib/roles/forbidden";
import type { Actor } from "@/lib/roles/actor";
import { segment, setupReview, video } from "../helpers/review-memory";

// Every owner read and action refuses a creator, a learner and nobody, with no data returned (spec 10 FR-028, FR-029, SC-009; constitution XI).

const creator: Actor = { id: "ann", email: "ann@x.com", name: "Ann", role: "creator" };
const pausedCreator: Actor = { ...creator, paused: true };
const learner: Actor = { id: "lea", email: "lea@x.com", name: null, role: "learner" };
const ownerWhoIsCreator: Actor = { id: "boss", email: "boss@x.com", name: "Boss", role: "owner", isCreator: true };
const nobody = [creator, pausedCreator, learner, null] as const;

const untouched = () => {
  throw new Error("the store must not be reached");
};

describe("the review service", () => {
  const vtt = "WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nx\n";
  const body = { videoId: "v1", start: 0, end: 2, script: "ك", transliteration: "", english: "" };
  // Every function the review service has, each called with the arguments it needs. A new function without a line here fails the first test.
  const calls: Record<string, (s: ReturnType<typeof setupReview>["service"], a: Actor | null) => Promise<unknown>> = {
    getQueue: (s, a) => s.getQueue(a, { list: "review" }),
    getReview: (s, a) => s.getReview(a, "v1"),
    setChecklist: (s, a) => s.setChecklist(a, { videoId: "v1", key: "audio", checked: true }),
    setClassification: (s, a) => s.setClassification(a, { videoId: "v1", stage: "hear-it", access: "FULL" }),
    saveSegment: (s, a) => s.saveSegment(a, body),
    deleteSegment: (s, a) => s.deleteSegment(a, { videoId: "v1", segmentId: "x", revision: 0 }),
    previewVtt: (s, a) => s.previewVtt(a, { videoId: "v1", text: vtt }),
    importVtt: (s, a) => s.importVtt(a, { videoId: "v1", text: vtt, mode: "replace" }),
    addGlossaryEntry: (s, a) => s.addGlossaryEntry(a, { videoId: "v1", word: "كلمة", transliteration: "kilma", english: "word" }),
    updateGlossaryEntry: (s, a) => s.updateGlossaryEntry(a, { videoId: "v1", entryId: "g", transliteration: "k", english: "w" }),
    decide: (s, a) => s.decide(a, { videoId: "v1", decision: "reject", note: "No." }),
  };

  it("has a check here for every function it exports", () => {
    expect(Object.keys(calls).sort()).toEqual(Object.keys(setupReview().service).sort());
  });

  it.each(Object.keys(calls))("%s refuses everyone but an owner and returns nothing", async (name) => {
    for (const actor of nobody) {
      const t = setupReview({ videos: [video({ id: "v1" })], segments: { v1: [segment({ id: "x", start: 5, end: 6 })] } });
      await expect(calls[name](t.service, actor)).rejects.toBeInstanceOf(ForbiddenError);
      expect(t.state.videos.get("v1")!.status).toBe("IN_REVIEW");
      expect(t.state.segments.get("v1")).toHaveLength(1);
      expect(t.state.events).toHaveLength(0);
      expect(t.mailer).not.toHaveBeenCalled();
    }
  });

  it("still serves an owner who is also a creator (the owner area is theirs too)", async () => {
    const t = setupReview({ videos: [video({ id: "v1" })] });
    expect((await t.service.getQueue(ownerWhoIsCreator, { list: "review" })).rows).toHaveLength(1);
  });
});

describe("the creator management service", () => {
  const store: CreatorsStore = new Proxy({} as CreatorsStore, { get: () => untouched });
  const service = createCreatorsService({ store, ownerEmails: [], defaultLanguageCode: "arz" });
  const calls: Record<string, (a: Actor | null) => Promise<unknown>> = {
    listCreators: (a) => service.listCreators(a),
    getCreatorStats: (a) => service.getCreatorStats(a, "ann"),
    pauseCreator: (a) => service.pauseCreator(a, "ann"),
    resumeCreator: (a) => service.resumeCreator(a, "ann"),
  };

  it("has a check here for every function it exports", () => {
    expect(Object.keys(calls).sort()).toEqual(Object.keys(service).sort());
  });

  it.each(Object.keys(calls))("%s refuses everyone but an owner before touching the database", async (name) => {
    for (const actor of nobody) await expect(calls[name](actor)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("the earnings service (spec 11)", () => {
  const figures = { grossCents: 100, vatCents: 0, feesCents: 0, refundsCents: 0 };
  // Every function the earnings service has, each called with the arguments it needs. A new function without a line here fails the first test.
  const calls: Record<string, (s: ReturnType<typeof setupEarnings>["service"], a: Actor | null) => Promise<unknown>> = {
    getStatement: (s, a) => s.getStatement(a, "2026-10"),
    listMonths: (s, a) => s.listMonths(a),
    saveRevenue: (s, a) => s.saveRevenue(a, { month: "2026-11", figures, expectedVersion: 0 }),
    addAdjustment: (s, a) => s.addAdjustment(a, { month: "2026-11", amountCents: 100, note: "x" }),
    closeMonth: (s, a) => s.closeMonth(a, "2026-10"),
    markPaid: (s, a) => s.markPaid(a, { month: "2026-10", creatorId: "ann", reference: "x" }),
    reversePayout: (s, a) => s.reversePayout(a, { payoutId: "p", reason: "x" }),
  };

  it("has a check here for every owner function it exports (getDashboard is the creator's own, tested in dashboard-service.test.ts)", () => {
    expect([...Object.keys(calls), "getDashboard"].sort()).toEqual(Object.keys(setupEarnings().service).sort());
  });

  it.each(Object.keys(calls))("%s refuses everyone but an owner before touching the database", async (name) => {
    for (const actor of nobody) {
      const t = setupEarnings({ revenue: { "2026-10": {} } });
      await expect(calls[name](t.service, actor)).rejects.toBeInstanceOf(ForbiddenError);
      expect(t.state.changes).toHaveLength(0);
      expect(t.state.adjustments).toHaveLength(0);
      expect(t.state.payouts).toHaveLength(0);
      expect(t.state.closed.size).toBe(0);
    }
  });

  it("every earnings action calls requireOwner and takes no actor, role, user id, payout amount or currency from its input", () => {
    const source = readFileSync("src/lib/earnings/actions.ts", "utf8");
    const actions = [...source.matchAll(/export async function (\w+)\(([\s\S]*?)\n\}/g)];
    expect(actions.length).toBeGreaterThan(0);
    for (const [, name, body] of actions) expect(body, name).toMatch(/requireOwner\(/);
    expect(source).not.toMatch(/actor:\s*z\.|role:\s*z\.|actorId|amountCents:\s*z\.|currency:\s*z\./);
  });

  it("still serves an owner who is also a creator", async () => {
    const t = setupEarnings();
    expect(await t.service.listMonths(ownerWhoIsCreator)).toHaveLength(1);
  });
});

describe("the manual access service (spec 11)", () => {
  // Every function the grants service has, each called with the arguments it needs. A new function without a line here fails the first test.
  const calls: Record<string, (s: ReturnType<typeof setupGrants>["service"], a: Actor | null) => Promise<unknown>> = {
    grantAccess: (s, a) => s.grantAccess(a, { email: "mona@example.com", reason: "GIFT" }),
    removeAccess: (s, a) => s.removeAccess(a, { email: "mona@example.com" }),
    listGrants: (s, a) => s.listGrants(a),
  };

  it("has a check here for every function it exports", () => {
    expect(Object.keys(calls).sort()).toEqual(Object.keys(setupGrants().service).sort());
  });

  it.each(Object.keys(calls))("%s refuses everyone but an owner and changes nothing", async (name) => {
    for (const actor of nobody) {
      const t = setupGrants({ accounts: [account("mona", { manualAccessAt: new Date() })] });
      await expect(calls[name](t.service, actor)).rejects.toBeInstanceOf(ForbiddenError);
      expect(t.state.events).toHaveLength(0);
      expect(t.state.users.get("mona")!.manualAccessAt).not.toBeNull();
    }
  });

  it("the grants actions never take an actor, a role or a user id from their input", () => {
    const source = readFileSync("src/lib/grants/actions.ts", "utf8");
    expect(source).not.toMatch(/actor:\s*z\.|role:\s*z\.|actorId|userId:\s*z\./);
  });
});

describe("the content requests service (spec 11)", () => {
  const food = { stage: "follow-it", topic: "food", text: "Cooking at home." };
  // The owner-only functions, each called with the arguments it needs. listOpenRequests is also open to creators and is tested in requests-service.test.ts.
  const calls: Record<string, (s: ReturnType<typeof setupRequests>["service"], a: Actor | null) => Promise<unknown>> = {
    createRequest: (s, a) => s.createRequest(a, food),
    editRequest: (s, a) => s.editRequest(a, { id: "r1", ...food }),
    closeRequest: (s, a) => s.closeRequest(a, { id: "r1" }),
    listAllRequests: (s, a) => s.listAllRequests(a),
  };

  it("has a check here for every owner function it exports", () => {
    expect([...Object.keys(calls), "listOpenRequests"].sort()).toEqual(Object.keys(setupRequests().service).sort());
  });

  it.each(Object.keys(calls))("%s refuses everyone but an owner and changes nothing", async (name) => {
    for (const actor of nobody) {
      const t = setupRequests();
      await t.service.createRequest({ id: "boss", email: "boss@x.com", name: "Boss", role: "owner" }, food);
      await expect(calls[name](t.service, actor)).rejects.toBeInstanceOf(ForbiddenError);
      expect(t.state.rows).toHaveLength(1);
      expect(t.state.rows[0].status).toBe("OPEN");
    }
  });
});

describe("the invitation service's owner functions", () => {
  const store: InviteStore = new Proxy({} as InviteStore, { get: () => untouched });
  const service = createInviteService({ store, mailer: untouched, ownerEmails: [], linkFor: (t) => t, defaultLanguageCode: "arz" });

  it("refuses resendInvite for everyone but an owner, before touching the database", async () => {
    for (const actor of nobody.filter((a): a is Actor => a !== null)) {
      expect(await service.resendInvite({ actor, email: "mona@example.com" })).toEqual({ ok: false, reason: "forbidden" });
    }
  });
});

describe("every server action checks the owner role again", () => {
  const files = ["src/lib/review/actions.ts", "src/lib/creators/actions.ts", "src/lib/earnings/actions.ts", "src/lib/grants/actions.ts", "src/lib/requests/actions.ts"];
  const owned = [...readFileSync("src/lib/invites/actions.ts", "utf8").matchAll(/export async function (\w+)\(([\s\S]*?)\n\}/g)].filter((m) => ["createInvite", "revokeInvite", "resendInvite"].includes(m[1]));

  it.each(files)("%s: each exported action calls requireOwner", (file) => {
    const source = readFileSync(file, "utf8");
    const actions = [...source.matchAll(/export async function (\w+)\(([\s\S]*?)\n\}/g)];
    expect(actions.length).toBeGreaterThan(1);
    for (const [, name, body] of actions) expect(body, name).toMatch(/requireOwner\(/);
  });

  it("the owner invitation actions call requireOwner too", () => {
    expect(owned.map((m) => m[1]).sort()).toEqual(["createInvite", "resendInvite", "revokeInvite"]);
    for (const [, name, body] of owned) expect(body, name).toMatch(/requireOwner\(/);
  });

  it("no owner action takes an actor, a role or a user id from its input", () => {
    for (const file of files) expect(readFileSync(file, "utf8"), file).not.toMatch(/actor:\s*z\.|role:\s*z\.|actorId/);
  });
});

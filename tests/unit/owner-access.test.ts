import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createCreatorsService, type CreatorsStore } from "@/lib/creators/service";
import { createInviteService, type InviteStore } from "@/lib/invites/service";
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
  const files = ["src/lib/review/actions.ts", "src/lib/creators/actions.ts"];
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

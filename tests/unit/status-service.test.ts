import { beforeEach, describe, expect, it } from "vitest";
import { createStatusService, type StatusActor, type StatusEventInput, type StatusStore, type StatusTx } from "@/lib/content/status-service";
import type { VideoStatusName } from "@/lib/content/status";
import type { Actor } from "@/lib/roles/actor";

type Event = StatusEventInput & { createdAt: Date };

function memory(initial: Record<string, { status: VideoStatusName; hostUserId: string | null }>) {
  const videos = new Map(Object.entries(initial).map(([id, v]) => [id, { id, ...v }]));
  const events: Event[] = [];
  let clock = 0;
  const tx: StatusTx = {
    async getVideo(id) {
      await Promise.resolve();
      const v = videos.get(id);
      return v ? { ...v } : null;
    },
    async setStatus(id, from, to) {
      await Promise.resolve();
      const v = videos.get(id);
      if (!v || v.status !== from) return false;
      v.status = to;
      return true;
    },
    async appendEvent(event) {
      await Promise.resolve();
      events.push({ ...event, createdAt: new Date(2026, 10, 11, 0, 0, clock++) });
    },
  };
  // Note what the store offers: only these three steps. There is no way to change or delete an event.
  const store: StatusStore = { transaction: (work) => work(tx) };
  return { store, videos, events, txMethods: Object.keys(tx).sort() };
}

const creator = (id: string): Actor => ({ id, email: `${id}@x.com`, name: id === "ann" ? "Ann" : null, role: "creator" });
const owner: Actor = { id: "boss", email: "boss@instik.test", name: "Boss", role: "owner" };
const learner: Actor = { id: "learn", email: "learn@x.com", name: null, role: "learner" };
const system: StatusActor = { kind: "system", label: "Mux" };

let mem: ReturnType<typeof memory>;
const run = (videoId: string, to: VideoStatusName, actor: StatusActor, note?: string) =>
  createStatusService({ store: mem.store }).changeStatus({ videoId, to, actor, note });

beforeEach(() => {
  mem = memory({
    v1: { status: "DRAFT", hostUserId: "ann" },
    review: { status: "IN_REVIEW", hostUserId: "ann" },
    processing: { status: "PROCESSING", hostUserId: "ann" },
    changes: { status: "CHANGES_REQUESTED", hostUserId: "ann" },
    bens: { status: "DRAFT", hostUserId: "ben" },
  });
});

describe("the whole path, with a history entry for each change", () => {
  it("records previous and new status, actor, time and note, in order", async () => {
    expect(await run("v1", "UPLOADING", creator("ann"), "Starting upload")).toEqual({ ok: true });
    expect(await run("v1", "PROCESSING", system)).toEqual({ ok: true });
    expect(await run("v1", "IN_REVIEW", system)).toEqual({ ok: true });
    expect(await run("v1", "CHANGES_REQUESTED", owner, "Audio is quiet")).toEqual({ ok: true });
    expect(await run("v1", "UPLOADING", creator("ann"))).toEqual({ ok: true });
    expect(mem.events.map((e) => [e.fromStatus, e.toStatus, e.actorLabel, e.actorId, e.note])).toEqual([
      ["DRAFT", "UPLOADING", "Ann", "ann", "Starting upload"],
      ["UPLOADING", "PROCESSING", "Mux", null, null],
      ["PROCESSING", "IN_REVIEW", "Mux", null, null],
      ["IN_REVIEW", "CHANGES_REQUESTED", "Boss", "boss", "Audio is quiet"],
      ["CHANGES_REQUESTED", "UPLOADING", "Ann", "ann", null],
    ]);
    const times = mem.events.map((e) => e.createdAt.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(mem.videos.get("v1")?.status).toBe("UPLOADING");
  });

  it("uses the email as the label for a person with no name, and trims the note", async () => {
    await run("v1", "UPLOADING", creator("ben2"), "  hi  ");
    // ben2 does not own v1, so nothing happened; use the owner of bens instead
    expect(mem.events).toEqual([]);
    await run("bens", "UPLOADING", creator("ben"), "  hi  ");
    expect(mem.events[0]).toMatchObject({ actorLabel: "ben@x.com", note: "hi" });
  });
});

describe("refused changes leave the status and the history exactly as they were", () => {
  const unchanged = () => {
    expect(mem.events).toEqual([]);
  };

  it("refuses DRAFT to APPROVED for everyone", async () => {
    for (const actor of [owner, creator("ann"), system]) {
      expect(await run("v1", "APPROVED", actor, "x")).toMatchObject({ ok: false, reason: "not-allowed" });
    }
    expect(mem.videos.get("v1")?.status).toBe("DRAFT");
    unchanged();
  });

  it("refuses Rejected and Changes requested without a note", async () => {
    expect(await run("review", "REJECTED", owner)).toEqual({ ok: false, reason: "note-required" });
    expect(await run("review", "CHANGES_REQUESTED", owner, "   ")).toEqual({ ok: false, reason: "note-required" });
    expect(mem.videos.get("review")?.status).toBe("IN_REVIEW");
    unchanged();
  });

  it("refuses a note over 2,000 characters", async () => {
    expect(await run("review", "APPROVED", owner, "x".repeat(2001))).toEqual({ ok: false, reason: "note-too-long" });
    unchanged();
  });

  it("does not let a creator approve, reject or request changes, even on their own video in review", async () => {
    for (const to of ["APPROVED", "REJECTED", "CHANGES_REQUESTED"] as const) {
      expect(await run("review", to, creator("ann"), "note")).toEqual({ ok: false, reason: "forbidden" });
    }
    expect(mem.videos.get("review")?.status).toBe("IN_REVIEW");
    unchanged();
  });

  it("does not let a creator touch another creator's video: it looks missing", async () => {
    expect(await run("bens", "UPLOADING", creator("ann"))).toEqual({ ok: false, reason: "not-found" });
    expect(await run("nope", "UPLOADING", creator("ann"))).toEqual({ ok: false, reason: "not-found" });
    expect(mem.videos.get("bens")?.status).toBe("DRAFT");
    unchanged();
  });

  it("refuses a learner every change", async () => {
    expect(await run("v1", "UPLOADING", learner)).toEqual({ ok: false, reason: "forbidden" });
    unchanged();
  });

  it("does not let an owner start an upload or the system approve", async () => {
    expect(await run("v1", "UPLOADING", owner)).toEqual({ ok: false, reason: "forbidden" });
    expect(await run("review", "APPROVED", system)).toEqual({ ok: false, reason: "forbidden" });
    unchanged();
  });

  it("reports an unknown video as not found for an owner", async () => {
    expect(await run("nope", "APPROVED", owner)).toEqual({ ok: false, reason: "not-found" });
  });
});

describe("who may make which move", () => {
  it("lets an owner make the three review decisions", async () => {
    expect(await run("review", "APPROVED", owner)).toEqual({ ok: true });
    mem.videos.set("r2", { id: "r2", status: "IN_REVIEW", hostUserId: "ann" });
    expect(await run("r2", "REJECTED", owner, "Not suitable")).toEqual({ ok: true });
    mem.videos.set("r3", { id: "r3", status: "IN_REVIEW", hostUserId: "ann" });
    expect(await run("r3", "CHANGES_REQUESTED", owner, "Re-record the intro")).toEqual({ ok: true });
  });

  it("lets a creator upload a new version or resubmit after changes were requested", async () => {
    expect(await run("changes", "IN_REVIEW", creator("ann"))).toEqual({ ok: true });
    mem.videos.set("c2", { id: "c2", status: "CHANGES_REQUESTED", hostUserId: "ann" });
    expect(await run("c2", "UPLOADING", creator("ann"))).toEqual({ ok: true });
  });

  it("moves a failed processing back to Draft with the automatic note, and nothing else", async () => {
    expect(await run("processing", "DRAFT", system)).toEqual({ ok: true });
    expect(mem.videos.get("processing")?.status).toBe("DRAFT");
    expect(mem.events[0]).toMatchObject({
      fromStatus: "PROCESSING",
      toStatus: "DRAFT",
      actorLabel: "Mux",
      note: "The upload didn't work. Please try again.",
    });
    expect(await run("review", "REJECTED", system, "x")).toEqual({ ok: false, reason: "forbidden" });
  });

  it("uses the automatic note even when the caller passes another one", async () => {
    expect(await run("processing", "DRAFT", system, "ffmpeg exited with code 1")).toEqual({ ok: true });
    expect(mem.events[0].note).toBe("The upload didn't work. Please try again.");
  });

  it("no longer lets processing go back to Uploading, and keeps a creator from failing it", async () => {
    expect(await run("processing", "UPLOADING", system, "x")).toEqual({ ok: false, reason: "not-allowed" });
    expect(await run("processing", "DRAFT", creator("ann"))).toEqual({ ok: false, reason: "forbidden" });
    expect(mem.videos.get("processing")?.status).toBe("PROCESSING");
    expect(mem.events).toHaveLength(0);
  });
});

describe("the history can only grow", () => {
  it("is written through a store that has no update or delete of an event", () => {
    expect(mem.txMethods).toEqual(["appendEvent", "getVideo", "setStatus"]);
  });
});

describe("two changes at once", () => {
  it("leave one winner and one event", async () => {
    const results = await Promise.all([run("review", "APPROVED", owner), run("review", "REJECTED", owner, "No")]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(mem.events).toHaveLength(1);
    expect(["APPROVED", "REJECTED"]).toContain(mem.videos.get("review")?.status);
    expect(mem.events[0].toStatus).toBe(mem.videos.get("review")?.status);
  });
});

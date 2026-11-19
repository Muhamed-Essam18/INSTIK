import { describe, expect, it, vi } from "vitest";
import { ForbiddenError } from "@/lib/roles/forbidden";
import type { Actor } from "@/lib/roles/actor";
import { setupRequests } from "../../helpers/requests-memory";

// Content requests from the owners (spec 11 User Story 6; FR-016, FR-017).

const owner: Actor = { id: "boss", email: "boss@x.com", name: "Boss", role: "owner" };
const creator: Actor = { id: "ann", email: "ann@x.com", name: "Ann", role: "creator" };
const pausedCreator: Actor = { ...creator, paused: true };
const learner: Actor = { id: "lea", email: "lea@x.com", name: null, role: "learner" };
const food = { stage: "follow-it", topic: "food", text: "Cooking at home, ordering street food." };

describe("createRequest", () => {
  it("saves a request with stage, topic and text, open, with who posted it and when", async () => {
    const t = setupRequests();
    expect(await t.service.createRequest(owner, { ...food, text: "  Cooking at home.  " })).toEqual({ ok: true });
    expect(t.state.rows).toHaveLength(1);
    expect(t.state.rows[0]).toMatchObject({ stage: "follow-it", topic: "food", text: "Cooking at home.", status: "OPEN", createdById: "boss", closedAt: null });
    expect(t.state.rows[0].createdAt).toEqual(new Date("2026-11-18T10:00:00Z"));
  });

  it("needs a stage and a topic from the site's own lists", async () => {
    const t = setupRequests();
    expect(await t.service.createRequest(owner, { ...food, stage: "superbeginner" })).toEqual({ ok: false, reason: "stage" });
    expect(await t.service.createRequest(owner, { ...food, topic: "cats" })).toEqual({ ok: false, reason: "topic" });
    expect(t.state.rows).toHaveLength(0);
  });

  it("needs text of 1 to 200 characters, asks plainly and saves nothing otherwise", async () => {
    const t = setupRequests();
    expect(await t.service.createRequest(owner, { ...food, text: "   " })).toEqual({ ok: false, reason: "empty" });
    expect(await t.service.createRequest(owner, { ...food, text: "a".repeat(201) })).toEqual({ ok: false, reason: "too-long" });
    expect(t.state.rows).toHaveLength(0);
    expect(await t.service.createRequest(owner, { ...food, text: "a".repeat(200) })).toEqual({ ok: true });
    expect(t.state.rows).toHaveLength(1);
  });
});

describe("editRequest and closeRequest", () => {
  it("edits an open request and keeps its place and status", async () => {
    const t = setupRequests();
    await t.service.createRequest(owner, food);
    const id = t.state.rows[0].id;
    expect(await t.service.editRequest(owner, { id, stage: "hear-it", topic: "family", text: "Introducing your family." })).toEqual({ ok: true });
    expect(t.state.rows[0]).toMatchObject({ stage: "hear-it", topic: "family", text: "Introducing your family.", status: "OPEN" });
  });

  it("refuses to edit a closed request, an unknown one, or with bad input", async () => {
    const t = setupRequests();
    await t.service.createRequest(owner, food);
    const id = t.state.rows[0].id;
    await t.service.closeRequest(owner, { id });
    expect(await t.service.editRequest(owner, { id, ...food, text: "Changed" })).toEqual({ ok: false, reason: "closed" });
    expect(await t.service.editRequest(owner, { id: "nope", ...food })).toEqual({ ok: false, reason: "not-found" });
    expect(await t.service.editRequest(owner, { id, ...food, text: "" })).toEqual({ ok: false, reason: "empty" });
    expect(t.state.rows[0].text).toBe(food.text);
  });

  it("closes a request, stamps when, and refuses to close it twice or an unknown one", async () => {
    const t = setupRequests();
    await t.service.createRequest(owner, food);
    const id = t.state.rows[0].id;
    t.clock.now = new Date("2026-11-20T10:00:00Z");
    expect(await t.service.closeRequest(owner, { id })).toEqual({ ok: true });
    expect(t.state.rows[0]).toMatchObject({ status: "CLOSED", closedAt: new Date("2026-11-20T10:00:00Z") });
    expect(await t.service.closeRequest(owner, { id })).toEqual({ ok: false, reason: "closed" });
    expect(await t.service.closeRequest(owner, { id: "nope" })).toEqual({ ok: false, reason: "not-found" });
  });
});

describe("what creators and owners see", () => {
  const post = async (t: ReturnType<typeof setupRequests>, text: string, day: number) => {
    t.clock.now = new Date(Date.UTC(2026, 10, day, 10));
    await t.service.createRequest(owner, { ...food, text });
  };

  it("lists the open requests newest first, for a creator (paused or not) and an owner", async () => {
    const t = setupRequests();
    await post(t, "First", 1);
    await post(t, "Second", 2);
    await post(t, "Third", 3);
    for (const actor of [creator, pausedCreator, owner]) {
      expect((await t.service.listOpenRequests(actor)).map((r) => r.text)).toEqual(["Third", "Second", "First"]);
    }
  });

  it("hides a closed request from creators but keeps it in the owner's list, marked closed", async () => {
    const t = setupRequests();
    await post(t, "Keep", 1);
    await post(t, "Close me", 2);
    await t.service.closeRequest(owner, { id: t.state.rows[1].id });
    expect((await t.service.listOpenRequests(creator)).map((r) => r.text)).toEqual(["Keep"]);
    const all = await t.service.listAllRequests(owner);
    expect(all.map((r) => [r.text, r.status])).toEqual([["Close me", "CLOSED"], ["Keep", "OPEN"]]);
  });

  it("shows at most 20 open requests, so the list ends", async () => {
    const t = setupRequests();
    for (let i = 1; i <= 25; i += 1) await post(t, `Request ${i}`, ((i - 1) % 28) + 1 > 0 ? i : 1);
    expect(await t.service.listOpenRequests(creator)).toHaveLength(20);
  });

  it("shows at most 100 requests to the owner", async () => {
    const t = setupRequests();
    for (let i = 0; i < 105; i += 1) {
      t.state.rows.push({ id: `x${i}`, stage: "hear-it", topic: "food", text: `T${i}`, status: "CLOSED", createdAt: new Date(Date.UTC(2026, 0, 1, 0, i)), closedAt: null, createdById: "boss" });
    }
    expect(await t.service.listAllRequests(owner)).toHaveLength(100);
  });
});

describe("who may use it", () => {
  const writes: Record<string, (s: ReturnType<typeof setupRequests>["service"], a: Actor | null) => Promise<unknown>> = {
    createRequest: (s, a) => s.createRequest(a, food),
    editRequest: (s, a) => s.editRequest(a, { id: "r1", ...food }),
    closeRequest: (s, a) => s.closeRequest(a, { id: "r1" }),
    listAllRequests: (s, a) => s.listAllRequests(a),
  };

  it.each(Object.keys(writes))("%s refuses a creator, a paused creator, a learner and nobody, and changes nothing", async (name) => {
    for (const actor of [creator, pausedCreator, learner, null]) {
      const t = setupRequests();
      await t.service.createRequest(owner, food);
      const insert = vi.spyOn(t.store, "insert");
      const update = vi.spyOn(t.store, "update");
      const close = vi.spyOn(t.store, "close");
      await expect(writes[name](t.service, actor)).rejects.toBeInstanceOf(ForbiddenError);
      expect(insert).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
      expect(close).not.toHaveBeenCalled();
      expect(t.state.rows).toHaveLength(1);
      expect(t.state.rows[0].status).toBe("OPEN");
    }
  });

  it("never shows requests to a learner or to nobody", async () => {
    const t = setupRequests();
    await t.service.createRequest(owner, food);
    await expect(t.service.listOpenRequests(learner)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(t.service.listOpenRequests(null)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("has a check for every function the service exports", () => {
    expect(Object.keys(setupRequests().service).sort()).toEqual([...Object.keys(writes), "listOpenRequests"].sort());
  });
});

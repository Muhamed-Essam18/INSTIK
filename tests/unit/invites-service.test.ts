import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  ForbiddenError,
  createInviteService,
  type InviteMessage,
  type InviteRecord,
  type InviteStore,
  type InviteTx,
} from "@/lib/invites/service";
import { hashToken } from "@/lib/invites/rules";
import type { Actor } from "@/lib/roles/actor";

// The invitation service with an in-memory store that behaves like a database transaction (all or nothing, one at a time).

type User = { id: string; email: string; role: "LEARNER" | "CREATOR"; learnerData: string[] };
type Host = { languageCode: string; slug: string; name: string; userId: string; order: number };
type State = { invites: InviteRecord[]; users: User[]; hosts: Host[]; nextId: number };

function memoryStore(options: { serial?: boolean; failCreateHost?: boolean } = {}) {
  const serial = options.serial ?? true;
  let state: State = {
    invites: [],
    users: [
      { id: "learner", email: "learner@x.com", role: "LEARNER", learnerData: ["hours", "rhythm"] },
      { id: "creator", email: "creator@x.com", role: "CREATOR", learnerData: [] },
      { id: "boss", email: "boss@instik.test", role: "LEARNER", learnerData: [] },
      { id: "invitee", email: "mona@example.com", role: "LEARNER", learnerData: ["progress"] },
    ],
    hosts: [{ languageCode: "arz", slug: "salma", name: "Salma", userId: "", order: 1 }],
    nextId: 1,
  };
  let lock: Promise<unknown> = Promise.resolve();
  const tick = () => Promise.resolve();

  const tx: InviteTx = {
    async revokePendingForEmail(email, now) {
      await tick();
      for (const i of state.invites) {
        if (i.email === email && !i.usedAt && !i.revokedAt && i.expiresAt > now) i.revokedAt = now;
      }
    },
    async createInvite(invite) {
      await tick();
      const record: InviteRecord = { ...invite, id: `inv-${state.nextId++}`, usedAt: null, usedById: null, revokedAt: null };
      state.invites.push(record);
      return { ...record };
    },
    async revokeIfPending(id, now) {
      await tick();
      const i = state.invites.find((x) => x.id === id);
      if (!i) return "not-found";
      if (i.usedAt || i.revokedAt || i.expiresAt <= now) return "not-pending";
      i.revokedAt = now;
      return "revoked";
    },
    async findByTokenHash(hash) {
      await tick();
      const i = state.invites.find((x) => x.tokenHash === hash);
      return i ? { ...i } : null;
    },
    async claim(id, userId, now) {
      await tick();
      const i = state.invites.find((x) => x.id === id);
      if (!i || i.usedAt || i.revokedAt || i.expiresAt <= now) return false;
      i.usedAt = now;
      i.usedById = userId;
      return true;
    },
    async getUser(id) {
      await tick();
      const u = state.users.find((x) => x.id === id);
      return u ? { id: u.id, email: u.email, role: u.role } : null;
    },
    async makeCreator(userId) {
      await tick();
      const u = state.users.find((x) => x.id === userId);
      if (!u || u.role !== "LEARNER") return false;
      u.role = "CREATOR";
      return true;
    },
    async hostSlugsTaken(languageCode) {
      await tick();
      return new Set(state.hosts.filter((h) => h.languageCode === languageCode).map((h) => h.slug));
    },
    async nextHostOrder(languageCode) {
      await tick();
      return Math.max(0, ...state.hosts.filter((h) => h.languageCode === languageCode).map((h) => h.order)) + 1;
    },
    async createHost(host) {
      await tick();
      if (options.failCreateHost) throw new Error("database went away");
      state.hosts.push(host);
    },
  };

  const store: InviteStore = {
    async transaction(work) {
      const run = async () => {
        const snapshot = serial ? structuredClone(state) : null;
        try {
          return await work(tx);
        } catch (error) {
          if (snapshot) state = snapshot; // all or nothing
          throw error;
        }
      };
      if (!serial) return run();
      const result = lock.then(run, run);
      lock = result.catch(() => undefined);
      return result;
    },
    async list() {
      return state.invites.map((i) => ({ ...i }));
    },
    async countCreatedSince(invitedById, since) {
      return state.invites.filter((i) => i.invitedById === invitedById && i.createdAt >= since).length;
    },
    async roleOfEmail(email) {
      return state.users.find((u) => u.email === email)?.role ?? null;
    },
  };
  return { store, get state() { return state; } };
}

const owner: Actor = { id: "boss", email: "boss@instik.test", name: "Boss", role: "owner" };
const learnerActor: Actor = { id: "learner", email: "learner@x.com", name: null, role: "learner" };
const creatorActor: Actor = { id: "creator", email: "creator@x.com", name: null, role: "creator" };

let clock = new Date("2026-11-11T10:00:00Z");
let sent: InviteMessage[] = [];
let mailFails = false;
let counter = 0;

function setup(opts: Parameters<typeof memoryStore>[0] = {}) {
  const mem = memoryStore(opts);
  const service = createInviteService({
    store: mem.store,
    mailer: async (m) => {
      if (mailFails) throw new Error("mail down");
      sent.push(m);
    },
    ownerEmails: ["boss@instik.test"],
    linkFor: (token) => `https://instik.test/invite/${token}`,
    defaultLanguageCode: "arz",
    now: () => clock,
    makeToken: () => `token-${++counter}`,
  });
  return { mem, service };
}

const tokenOf = (m: InviteMessage) => m.link.replace("https://instik.test/invite/", "");
const mona = { id: "invitee", email: "mona@example.com" };
const day = 24 * 60 * 60 * 1000;

beforeEach(() => {
  clock = new Date("2026-11-11T10:00:00Z");
  sent = [];
  mailFails = false;
  counter = 0;
});

describe("createInvite", () => {
  it("records a pending invitation and emails only the name, the link and the expiry", async () => {
    const { mem, service } = setup();
    expect(await service.createInvite({ actor: owner, name: "Mona Ali", email: "Mona@Example.com" })).toEqual({ ok: true });
    expect(sent).toHaveLength(1);
    expect(Object.keys(sent[0]).sort()).toEqual(["expiresAt", "link", "name", "to"]);
    expect(sent[0]).toMatchObject({ to: "mona@example.com", name: "Mona Ali", link: "https://instik.test/invite/token-1" });
    expect(sent[0].expiresAt.toISOString()).toBe("2026-11-18T10:00:00.000Z");
    const [stored] = mem.state.invites;
    expect(stored.tokenHash).toBe(hashToken("token-1"));
    expect(JSON.stringify(stored)).not.toContain("token-1");
    expect(stored.invitedById).toBe("boss");
    expect((await service.listInvites({ actor: owner }))[0]).toMatchObject({ email: "mona@example.com", state: "pending" });
  });

  it.each([
    ["a learner", learnerActor],
    ["a creator", creatorActor],
  ])("refuses %s and creates and sends nothing", async (_label, actor) => {
    const { mem, service } = setup();
    expect(await service.createInvite({ actor, name: "Mona", email: "mona@example.com" })).toEqual({ ok: false, reason: "forbidden" });
    expect(mem.state.invites).toEqual([]);
    expect(sent).toEqual([]);
  });

  it("refuses a bad name or email with the field named", async () => {
    const { service } = setup();
    expect(await service.createInvite({ actor: owner, name: "  ", email: "a@b.co" })).toMatchObject({ ok: false, reason: "invalid", field: "name" });
    expect(await service.createInvite({ actor: owner, name: "Mona", email: "nope" })).toMatchObject({ ok: false, reason: "invalid", field: "email" });
    expect(sent).toEqual([]);
  });

  it("refuses an email that already belongs to an owner or a creator and creates nothing (FR-031)", async () => {
    const { mem, service } = setup();
    expect(await service.createInvite({ actor: owner, name: "Boss", email: "boss@instik.test" })).toMatchObject({ ok: false, reason: "already-on-team", field: "email" });
    expect(await service.createInvite({ actor: owner, name: "C", email: "creator@x.com" })).toMatchObject({ ok: false, reason: "already-creator", field: "email" });
    expect(mem.state.invites).toEqual([]);
    expect(sent).toEqual([]);
  });

  it("allows an email that belongs to a learner", async () => {
    const { service } = setup();
    expect(await service.createInvite({ actor: owner, name: "L", email: "learner@x.com" })).toEqual({ ok: true });
  });

  it("revokes the earlier pending invitation for the same email", async () => {
    const { mem, service } = setup();
    await service.createInvite({ actor: owner, name: "Mona", email: "mona@example.com" });
    await service.createInvite({ actor: owner, name: "Mona", email: "mona@example.com" });
    const states = (await service.listInvites({ actor: owner })).map((i) => i.state).sort();
    expect(states).toEqual(["pending", "revoked"]);
    expect(mem.state.invites).toHaveLength(2);
    // The first link no longer works; the second does.
    expect(await service.acceptInvite({ account: mona, token: tokenOf(sent[0]) })).toEqual({ ok: false, reason: "invalid" });
    expect(await service.acceptInvite({ account: mona, token: tokenOf(sent[1]) })).toEqual({ ok: true });
  });

  it("leaves no pending invitation when the email cannot be sent", async () => {
    const { mem, service } = setup();
    mailFails = true;
    expect(await service.createInvite({ actor: owner, name: "Mona", email: "mona@example.com" })).toEqual({ ok: false, reason: "send-failed" });
    expect((await service.listInvites({ actor: owner })).map((i) => i.state)).toEqual(["revoked"]);
    expect(mem.state.invites.filter((i) => !i.revokedAt)).toEqual([]);
  });

  it("limits one owner to 20 invitations an hour", async () => {
    const { service } = setup();
    for (let n = 0; n < 20; n += 1) {
      expect(await service.createInvite({ actor: owner, name: "N", email: `p${n}@example.com` })).toEqual({ ok: true });
    }
    expect(await service.createInvite({ actor: owner, name: "N", email: "p20@example.com" })).toEqual({ ok: false, reason: "too-many" });
    clock = new Date(clock.getTime() + 61 * 60 * 1000);
    expect(await service.createInvite({ actor: owner, name: "N", email: "p20@example.com" })).toEqual({ ok: true });
  });
});

describe("revokeInvite and listInvites", () => {
  it("lets an owner revoke a pending invitation and refuses others", async () => {
    const { service } = setup();
    await service.createInvite({ actor: owner, name: "Mona", email: "mona@example.com" });
    const [invite] = await service.listInvites({ actor: owner });
    expect(await service.revokeInvite({ actor: creatorActor, inviteId: invite.id })).toEqual({ ok: false, reason: "forbidden" });
    expect(await service.revokeInvite({ actor: owner, inviteId: invite.id })).toEqual({ ok: true });
    expect(await service.revokeInvite({ actor: owner, inviteId: invite.id })).toEqual({ ok: false, reason: "not-pending" });
    expect(await service.revokeInvite({ actor: owner, inviteId: "nope" })).toEqual({ ok: false, reason: "not-found" });
    expect(await service.acceptInvite({ account: mona, token: tokenOf(sent[0]) })).toEqual({ ok: false, reason: "invalid" });
  });

  it("refuses to list for anyone but an owner", async () => {
    const { service } = setup();
    await expect(service.listInvites({ actor: learnerActor })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(service.listInvites({ actor: creatorActor })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("shows used and expired states", async () => {
    const { service } = setup();
    await service.createInvite({ actor: owner, name: "Mona", email: "mona@example.com" });
    await service.createInvite({ actor: owner, name: "Late", email: "late@example.com" });
    await service.acceptInvite({ account: mona, token: tokenOf(sent[0]) });
    clock = new Date(clock.getTime() + 8 * day);
    const byEmail = Object.fromEntries((await service.listInvites({ actor: owner })).map((i) => [i.email, i.state]));
    expect(byEmail).toEqual({ "mona@example.com": "used", "late@example.com": "expired" });
  });
});

describe("acceptInvite", () => {
  it("makes the account a creator, creates their host profile and marks the invitation used", async () => {
    const { mem, service } = setup();
    await service.createInvite({ actor: owner, name: "Mona Ali", email: "mona@example.com" });
    expect(await service.acceptInvite({ account: mona, token: tokenOf(sent[0]) })).toEqual({ ok: true });
    expect(mem.state.users.find((u) => u.id === "invitee")?.role).toBe("CREATOR");
    expect(mem.state.hosts.at(-1)).toEqual({ languageCode: "arz", slug: "mona-ali", name: "Mona Ali", userId: "invitee", order: 2 });
    expect(mem.state.invites[0]).toMatchObject({ usedById: "invitee", usedAt: clock });
  });

  it("keeps the learner's existing learner data", async () => {
    const { mem, service } = setup();
    await service.createInvite({ actor: owner, name: "Mona", email: "mona@example.com" });
    await service.acceptInvite({ account: mona, token: tokenOf(sent[0]) });
    expect(mem.state.users.find((u) => u.id === "invitee")?.learnerData).toEqual(["progress"]);
  });

  it("gives the host a different slug when the name is already taken", async () => {
    const { mem, service } = setup();
    await service.createInvite({ actor: owner, name: "Salma", email: "mona@example.com" });
    await service.acceptInvite({ account: mona, token: tokenOf(sent[0]) });
    expect(mem.state.hosts.at(-1)?.slug).toBe("salma-2");
  });

  it("works exactly once", async () => {
    const { service } = setup();
    await service.createInvite({ actor: owner, name: "Mona", email: "mona@example.com" });
    const token = tokenOf(sent[0]);
    expect(await service.acceptInvite({ account: mona, token })).toEqual({ ok: true });
    expect(await service.acceptInvite({ account: mona, token })).toEqual({ ok: false, reason: "invalid" });
  });

  it("refuses an unknown token", async () => {
    const { mem, service } = setup();
    expect(await service.acceptInvite({ account: mona, token: "made-up" })).toEqual({ ok: false, reason: "invalid" });
    expect(mem.state.users.find((u) => u.id === "invitee")?.role).toBe("LEARNER");
  });

  it("refuses an expired invitation without changing anything", async () => {
    const { mem, service } = setup();
    await service.createInvite({ actor: owner, name: "Mona", email: "mona@example.com" });
    clock = new Date(clock.getTime() + 7 * day); // exactly the expiry time
    const before = JSON.stringify(mem.state);
    expect(await service.acceptInvite({ account: mona, token: tokenOf(sent[0]) })).toEqual({ ok: false, reason: "invalid" });
    expect(JSON.stringify(mem.state)).toBe(before);
  });

  it("works on the last moment before expiry", async () => {
    const { service } = setup();
    await service.createInvite({ actor: owner, name: "Mona", email: "mona@example.com" });
    clock = new Date(clock.getTime() + 7 * day - 1);
    expect(await service.acceptInvite({ account: mona, token: tokenOf(sent[0]) })).toEqual({ ok: true });
  });

  it("refuses a signed-in account with a different email and changes nothing", async () => {
    const { mem, service } = setup();
    await service.createInvite({ actor: owner, name: "Mona", email: "mona@example.com" });
    const before = JSON.stringify(mem.state);
    expect(await service.acceptInvite({ account: { id: "learner", email: "learner@x.com" }, token: tokenOf(sent[0]) })).toEqual({
      ok: false,
      reason: "wrong-email",
    });
    expect(JSON.stringify(mem.state)).toBe(before);
  });

  it("matches the email without regard to case", async () => {
    const { service } = setup();
    await service.createInvite({ actor: owner, name: "Mona", email: "mona@example.com" });
    expect(await service.acceptInvite({ account: { id: "invitee", email: "Mona@Example.com" }, token: tokenOf(sent[0]) })).toEqual({ ok: true });
  });

  it("refuses an account that is already a creator or an owner", async () => {
    const { mem, service } = setup();
    // Learner accounts exist for these emails; make the stored role a creator and put the other on the owner list.
    await service.createInvite({ actor: owner, name: "Mona", email: "mona@example.com" });
    mem.state.users.find((u) => u.id === "invitee")!.role = "CREATOR";
    expect(await service.acceptInvite({ account: mona, token: tokenOf(sent[0]) })).toEqual({ ok: false, reason: "already-privileged" });
    expect(mem.state.invites[0].usedAt).toBeNull();

    const boss = { id: "boss", email: "boss@instik.test" };
    mem.state.invites.push({ ...mem.state.invites[0], id: "inv-x", email: "boss@instik.test", tokenHash: hashToken("boss-token") });
    expect(await service.acceptInvite({ account: boss, token: "boss-token" })).toEqual({ ok: false, reason: "already-privileged" });
  });

  it("lets only one of two simultaneous acceptances win", async () => {
    const { mem, service } = setup({ serial: false });
    await service.createInvite({ actor: owner, name: "Mona", email: "mona@example.com" });
    const token = tokenOf(sent[0]);
    const results = await Promise.all([
      service.acceptInvite({ account: mona, token }),
      service.acceptInvite({ account: mona, token }),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(mem.state.hosts.filter((h) => h.userId === "invitee")).toHaveLength(1);
  });

  it("undoes the claim and the role change when creating the profile fails", async () => {
    const { mem, service } = setup({ failCreateHost: true });
    await service.createInvite({ actor: owner, name: "Mona", email: "mona@example.com" });
    await expect(service.acceptInvite({ account: mona, token: tokenOf(sent[0]) })).rejects.toThrow("database went away");
    expect(mem.state.users.find((u) => u.id === "invitee")?.role).toBe("LEARNER");
    expect(mem.state.invites[0].usedAt).toBeNull();
    expect(mem.state.invites[0].usedById).toBeNull();
    expect(mem.state.hosts.some((h) => h.userId === "invitee")).toBe(false);
  });
});

describe("previewInvite", () => {
  it("shows the invited name for a pending link and changes nothing", async () => {
    const { mem, service } = setup();
    await service.createInvite({ actor: owner, name: "Mona Ali", email: "mona@example.com" });
    const before = JSON.stringify(mem.state);
    expect(await service.previewInvite(tokenOf(sent[0]))).toEqual({ ok: true, name: "Mona Ali", email: "mona@example.com" });
    expect(await service.previewInvite("made-up")).toEqual({ ok: false });
    expect(JSON.stringify(mem.state)).toBe(before);
  });
});

describe("only acceptInvite makes a creator (FR-003)", () => {
  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) return name === "generated" ? [] : sourceFiles(full);
      return /\.(ts|tsx)$/.test(name) ? [full] : [];
    });
  }

  it("writes the creator role in one place, the invitation store used by acceptInvite", () => {
    const writers = sourceFiles(path.join(process.cwd(), "src"))
      .filter((file) => /role:\s*["']CREATOR["']/.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(process.cwd(), file).replace(/\\/g, "/"));
    expect(writers).toEqual(["src/lib/invites/store.ts"]);
  });
});

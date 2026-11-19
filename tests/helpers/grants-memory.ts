import {
  createGrantsService,
  type ActiveGrant,
  type GrantAccount,
  type GrantEventRecord,
  type GrantReason,
  type GrantsStore,
  type GrantsTx,
} from "@/lib/grants/service";

// An in-memory stand-in for the grants store so the manual access rules run with no database. A transaction rolls back everything it did
// if it throws, and a lock serialises two callers, as the real row lock does. Accounts carry a subscription the store can never touch.

export type MemoryAccount = GrantAccount & { subscription: { status: string } | null };
export type MemoryEvent = { id: string; userId: string; kind: "GRANTED" | "REMOVED"; reason: GrantReason; note: string | null; byId: string; at: Date };

export const account = (id: string, over: Partial<MemoryAccount> = {}): MemoryAccount => ({
  id,
  email: `${id}@example.com`,
  name: id.toUpperCase(),
  manualAccessAt: null,
  subscription: null,
  ...over,
});

export function setupGrants(setup: { accounts?: MemoryAccount[]; now?: string } = {}) {
  const clock = { now: new Date(setup.now ?? "2026-11-18T10:00:00Z") };
  const state = {
    users: new Map((setup.accounts ?? []).map((a) => [a.id, a])),
    events: [] as MemoryEvent[],
  };
  let seq = 0;

  const tx: GrantsTx = {
    lockAccount: async (email) => [...state.users.values()].find((u) => u.email.toLowerCase() === email) ?? null,
    latestGrantReason: async (userId) => [...state.events].reverse().find((e) => e.userId === userId && e.kind === "GRANTED")?.reason ?? null,
    setManualAccess: async (userId, at) => {
      state.users.get(userId)!.manualAccessAt = at;
    },
    appendEvent: async (event) => {
      state.events.push({ ...event, id: `ev${(seq += 1)}` });
    },
  };

  let tail: Promise<unknown> = Promise.resolve();
  const store: GrantsStore = {
    transaction: (work) => {
      const run = tail.then(async () => {
        const users = new Map([...state.users].map(([id, u]) => [id, { ...u }]));
        const events = [...state.events];
        try {
          return await work(tx);
        } catch (error) {
          state.users = users;
          state.events = events;
          throw error;
        }
      });
      tail = run.catch(() => undefined);
      return run;
    },
    active: async (): Promise<ActiveGrant[]> =>
      [...state.users.values()]
        .filter((u) => u.manualAccessAt !== null)
        .map((u) => {
          const last = [...state.events].reverse().find((e) => e.userId === u.id && e.kind === "GRANTED");
          return { userId: u.id, email: u.email, name: u.name, since: u.manualAccessAt as Date, reason: last?.reason ?? null, note: last?.note ?? null, byName: last?.byId ?? null };
        }),
    events: async (limit): Promise<GrantEventRecord[]> =>
      [...state.events]
        .sort((a, b) => b.at.getTime() - a.at.getTime())
        .slice(0, limit)
        .map((e) => ({ id: e.id, userId: e.userId, email: state.users.get(e.userId)?.email ?? "", accountName: state.users.get(e.userId)?.name ?? null, kind: e.kind, reason: e.reason, note: e.note, byName: e.byId, at: e.at })),
  };

  const service = createGrantsService({ store, now: () => clock.now });
  return { state, store, tx, service, clock };
}

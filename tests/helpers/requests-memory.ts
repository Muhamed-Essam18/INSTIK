import { createRequestsService, type RequestRecord, type RequestsStore } from "@/lib/requests/service";

// An in-memory stand-in for the requests store so the content request rules run with no database.

export function setupRequests(setup: { now?: string } = {}) {
  const clock = { now: new Date(setup.now ?? "2026-11-18T10:00:00Z") };
  const state = { rows: [] as (RequestRecord & { createdById: string })[] };
  let seq = 0;

  const store: RequestsStore = {
    insert: async (row) => {
      state.rows.push({ id: `r${(seq += 1)}`, stage: row.stage, topic: row.topic, text: row.text, status: "OPEN", createdAt: row.at, closedAt: null, createdById: row.createdById });
    },
    update: async (id, data) => {
      const row = state.rows.find((r) => r.id === id);
      if (!row) return "not-found";
      if (row.status === "CLOSED") return "closed";
      Object.assign(row, { stage: data.stage, topic: data.topic, text: data.text });
      return "updated";
    },
    close: async (id, at) => {
      const row = state.rows.find((r) => r.id === id);
      if (!row) return "not-found";
      if (row.status === "CLOSED") return "already-closed";
      row.status = "CLOSED";
      row.closedAt = at;
      return "closed";
    },
    listOpen: async (limit) => state.rows.filter((r) => r.status === "OPEN").sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit),
    listAll: async (limit) => [...state.rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit),
  };

  const service = createRequestsService({ store, now: () => clock.now });
  return { state, store, service, clock };
}

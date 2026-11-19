import "server-only";
import { db } from "@/lib/db";
import type { RequestRecord, RequestsStore } from "./service";

// The Prisma side of content requests (spec 11 User Story 6): the one place that queries `ContentRequest`.

const toRecord = (row: { id: string; stage: string; topic: string; text: string; status: "OPEN" | "CLOSED"; createdAt: Date; closedAt: Date | null }): RequestRecord => ({
  id: row.id,
  stage: row.stage,
  topic: row.topic,
  text: row.text,
  status: row.status,
  createdAt: row.createdAt,
  closedAt: row.closedAt,
});

export const prismaRequestsStore: RequestsStore = {
  async insert(row) {
    await db().contentRequest.create({ data: { stage: row.stage, topic: row.topic, text: row.text, createdById: row.createdById, createdAt: row.at } });
  },

  async update(id, data) {
    const row = await db().contentRequest.findUnique({ where: { id }, select: { status: true } });
    if (!row) return "not-found";
    if (row.status === "CLOSED") return "closed";
    // Guarded by status in the where clause, so a request closed a moment ago is never edited.
    const result = await db().contentRequest.updateMany({ where: { id, status: "OPEN" }, data: { stage: data.stage, topic: data.topic, text: data.text } });
    return result.count === 1 ? "updated" : "closed";
  },

  async close(id, at) {
    const result = await db().contentRequest.updateMany({ where: { id, status: "OPEN" }, data: { status: "CLOSED", closedAt: at } });
    if (result.count === 1) return "closed";
    const exists = await db().contentRequest.findUnique({ where: { id }, select: { id: true } });
    return exists ? "already-closed" : "not-found";
  },

  async listOpen(limit) {
    return (await db().contentRequest.findMany({ where: { status: "OPEN" }, orderBy: { createdAt: "desc" }, take: limit })).map(toRecord);
  },

  async listAll(limit) {
    return (await db().contentRequest.findMany({ orderBy: { createdAt: "desc" }, take: limit })).map(toRecord);
  },
};

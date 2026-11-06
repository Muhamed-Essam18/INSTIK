import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { evaluateThrottle, type ThrottleResult } from "./throttle-rules";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Visitor addresses are only ever stored as a salted hash, and used for nothing but this limit. */
const hashVisitor = (visitorId: string) =>
  createHash("sha256").update(`${env().IP_HASH_SALT}:${visitorId}`).digest("hex");

/** Checks the send limits for this address and visitor and, when allowed, records the attempt. */
export async function checkAndRecordSend(email: string, visitorId: string): Promise<ThrottleResult> {
  const now = new Date();
  const hourAgo = new Date(now.getTime() - HOUR);
  const emailKey = `email:${email}`;
  const visitorKey = `visitor:${hashVisitor(visitorId)}`;
  const client = db();

  const [emailAttempts, visitorCount] = await Promise.all([
    client.signInAttempt.findMany({
      where: { key: emailKey, createdAt: { gte: hourAgo } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    client.signInAttempt.count({ where: { key: visitorKey, createdAt: { gte: hourAgo } } }),
  ]);

  const result = evaluateThrottle({
    emailCountLastHour: emailAttempts.length,
    visitorCountLastHour: visitorCount,
    lastEmailSendAt: emailAttempts[0]?.createdAt ?? null,
    now,
  });
  if (!result.ok) return result;

  await client.signInAttempt.createMany({ data: [{ key: emailKey }, { key: visitorKey }] });
  await client.signInAttempt.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - DAY) } } });
  return result;
}

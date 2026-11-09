import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { evaluateWaitlistThrottle, type WaitlistThrottleResult } from "./throttle-rules";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Visitor addresses are only ever stored as a salted hash, and used for nothing but this limit. */
const hashVisitor = (visitorId: string) =>
  createHash("sha256").update(`${env().IP_HASH_SALT}:${visitorId}`).digest("hex");

/** Checks the waitlist limit for this visitor and, when allowed, records the attempt. */
export async function checkAndRecordWaitlist(visitorId: string): Promise<WaitlistThrottleResult> {
  const now = new Date();
  const key = `waitlist:visitor:${hashVisitor(visitorId)}`;
  const client = db();
  const count = await client.signInAttempt.count({ where: { key, createdAt: { gte: new Date(now.getTime() - HOUR) } } });
  const result = evaluateWaitlistThrottle({ visitorCountLastHour: count });
  if (!result.ok) return result;
  await client.signInAttempt.create({ data: { key } });
  await client.signInAttempt.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - DAY) } } });
  return result;
}

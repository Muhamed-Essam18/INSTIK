import { muxClient } from "@/lib/mux/client";
import { parseMuxEvent } from "@/lib/mux/events";
import { webhookService } from "@/lib/mux/instance";

// POST /api/mux/webhook: called only by Mux (contracts/mux-webhook.md). The signature is checked on the raw body before anything
// is read from it; then the event is parsed with zod and applied. Responses carry no body: nothing from the request, a secret or
// an error is ever echoed.

const reply = (status: number) => new Response(null, { status });

export async function POST(request: Request) {
  const mux = muxClient();
  if (!mux) return reply(503);

  const rawBody = await request.text(); // the exact bytes Mux signed; never request.json() before verifying
  try {
    await mux.webhooks.verifySignature(rawBody, request.headers);
  } catch {
    return reply(400);
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return reply(400);
  }

  const event = parseMuxEvent(json);
  if (!event) return reply(200); // a type we do not act on, or fields we cannot read: nothing to do

  try {
    await webhookService().handle(event);
    return reply(200);
  } catch {
    // Mux retries on a 500. The log line carries the event's own id and type only.
    const { id, type } = json as { id?: unknown; type?: unknown };
    console.error("[mux] webhook processing failed", { event: typeof id === "string" ? id : undefined, type: typeof type === "string" ? type : undefined });
    return reply(500);
  }
}

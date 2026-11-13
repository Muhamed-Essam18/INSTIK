import { beforeEach, describe, expect, it, vi } from "vitest";

// The route checks the signature first, answers with no body, and never applies an event it could not verify.

const verifySignature = vi.hoisted(() => vi.fn());
const handle = vi.hoisted(() => vi.fn());
const client = vi.hoisted(() => ({ current: null as null | { webhooks: { verifySignature: typeof verifySignature } } }));

vi.mock("@/lib/mux/client", () => ({ muxClient: () => client.current }));
vi.mock("@/lib/mux/instance", () => ({ webhookService: () => ({ handle }) }));

import { POST } from "@/app/api/mux/webhook/route";

const post = (body: string, headers: Record<string, string> = { "mux-signature": "t=1,v1=abc" }) =>
  POST(new Request("http://localhost/api/mux/webhook", { method: "POST", body, headers }));
const readyEvent = JSON.stringify({ id: "evt-1", type: "video.asset.ready", data: { id: "as-1", upload_id: "up-1", duration: 12 } });

beforeEach(() => {
  verifySignature.mockReset().mockResolvedValue(undefined);
  handle.mockReset().mockResolvedValue("applied");
  client.current = { webhooks: { verifySignature } };
});

describe("POST /api/mux/webhook", () => {
  it("answers 503 with no body when the Mux settings are missing, and does nothing", async () => {
    client.current = null;
    const response = await post(readyEvent);
    expect(response.status).toBe(503);
    expect(await response.text()).toBe("");
    expect(handle).not.toHaveBeenCalled();
  });

  it("answers 400 with no body and applies nothing when the signature is bad or missing", async () => {
    verifySignature.mockRejectedValue(new Error("bad signature"));
    const response = await post(readyEvent, {});
    expect(response.status).toBe(400);
    expect(await response.text()).toBe("");
    expect(handle).not.toHaveBeenCalled();
  });

  it("checks the signature on the exact raw body and the request headers", async () => {
    await post(readyEvent);
    expect(verifySignature).toHaveBeenCalledTimes(1);
    expect(verifySignature.mock.calls[0][0]).toBe(readyEvent);
    expect((verifySignature.mock.calls[0][1] as Headers).get("mux-signature")).toBe("t=1,v1=abc");
  });

  it("answers 400 for a verified body that is not JSON", async () => {
    const response = await post("not json");
    expect(response.status).toBe(400);
    expect(handle).not.toHaveBeenCalled();
  });

  it("applies a verified event and answers 200 with no body", async () => {
    const response = await post(readyEvent);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
    expect(handle).toHaveBeenCalledWith({ kind: "asset-ready", assetId: "as-1", uploadId: "up-1", durationSeconds: 12, playbackId: null });
  });

  it("answers 200 and does nothing for an event type it does not act on", async () => {
    const response = await post(JSON.stringify({ id: "evt-2", type: "video.asset.updated", data: { id: "as-1" } }));
    expect(response.status).toBe(200);
    expect(handle).not.toHaveBeenCalled();
  });

  it("answers 500 with no body when applying fails, so Mux retries, and logs only the event id and type", async () => {
    handle.mockRejectedValue(new Error("database down: secret detail"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await post(readyEvent);
    expect(response.status).toBe(500);
    expect(await response.text()).toBe("");
    expect(log).toHaveBeenCalledWith("[mux] webhook processing failed", { event: "evt-1", type: "video.asset.ready" });
    expect(JSON.stringify(log.mock.calls)).not.toContain("secret detail");
    log.mockRestore();
  });
});

import { describe, expect, it } from "vitest";
import { failureMessage } from "@/lib/creator/messages";

describe("failureMessage", () => {
  it("has a short, kind sentence for every reason and never names a status or the video host", () => {
    for (const reason of ["not-allowed", "not-found", "not-set-up", "wrong-status", "host-error"] as const) {
      const { message } = failureMessage({ ok: false, reason });
      expect(message.length).toBeGreaterThan(10);
      expect(message).not.toMatch(/mux|DRAFT|UPLOADING|PROCESSING|error|invalid|failed/i);
    }
  });

  it("gives each missing item once, keyed by field, for the form to show", () => {
    const out = failureMessage({
      ok: false,
      reason: "invalid",
      problems: [
        { field: "title", message: "Give your video a title." },
        { field: "host", message: "Finish your host page first." },
        { field: "title", message: "A second title problem." },
      ],
    });
    expect(out.fields).toEqual({ title: "Give your video a title.", host: "Finish your host page first." });
  });
});

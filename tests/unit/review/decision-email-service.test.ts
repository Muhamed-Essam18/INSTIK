import { describe, expect, it } from "vitest";
import { owner, segment, setupReview, ticked, video } from "../../helpers/review-memory";

const ready = (options = {}) => setupReview({ videos: [video({ id: "v1", checks: { ...ticked } })], segments: { v1: [segment({ id: "s", start: 0, end: 5 })] } }, options);

describe("the decision email", () => {
  it("sends exactly one email and records SENT", async () => {
    const t = ready();
    const r = await t.service.decide(owner, { videoId: "v1", decision: "approve" });
    expect(r).toMatchObject({ ok: true, emailSent: true });
    expect(t.mailer).toHaveBeenCalledTimes(1);
    expect(t.mailer).toHaveBeenCalledWith(expect.objectContaining({ to: "salma@x.com", outcome: "approved", title: "Video v1", link: "https://instik.test/creator/videos" }));
    expect(t.state.emails).toEqual([{ eventId: t.state.events[0].id, toEmail: "salma@x.com", outcome: "SENT", failure: null }]);
  });

  it("links a changes-requested email to that video", async () => {
    const t = ready();
    await t.service.decide(owner, { videoId: "v1", decision: "changes", note: "Louder." });
    expect(t.mailer).toHaveBeenCalledWith(expect.objectContaining({ outcome: "changes", note: "Louder.", link: "https://instik.test/creator/videos/v1" }));
  });

  it("a mailer that throws records FAILED with a short reason, the decision stands, and emailSent is false", async () => {
    const t = ready({ mailerFails: true });
    const r = await t.service.decide(owner, { videoId: "v1", decision: "reject", note: "No." });
    expect(r).toMatchObject({ ok: true, emailSent: false });
    expect(t.state.videos.get("v1")!.status).toBe("REJECTED");
    expect(t.state.emails[0]).toMatchObject({ outcome: "FAILED", failure: "The email service answered 500." });
    expect(t.state.emails[0].failure!.length).toBeLessThanOrEqual(200);
  });

  it("does not send a second email when the decision is repeated", async () => {
    const t = ready();
    await t.service.decide(owner, { videoId: "v1", decision: "approve" });
    const again = await t.service.decide(owner, { videoId: "v1", decision: "approve" });
    expect(again).toMatchObject({ ok: false, reason: "not-in-review" });
    expect(t.mailer).toHaveBeenCalledTimes(1);
    expect(t.state.emails).toHaveLength(1);
  });

  it("a creator with no email address records a failure without throwing", async () => {
    const t = ready({ creatorEmailMissing: true });
    const r = await t.service.decide(owner, { videoId: "v1", decision: "approve" });
    expect(r).toMatchObject({ ok: true, emailSent: false });
    expect(t.mailer).not.toHaveBeenCalled();
    expect(t.state.emails[0]).toMatchObject({ outcome: "FAILED", failure: "The creator has no email address on file." });
  });

  it("a refused decision sends nothing", async () => {
    const t = setupReview({ videos: [video({ id: "v1" })] });
    await t.service.decide(owner, { videoId: "v1", decision: "approve" });
    await t.service.decide(owner, { videoId: "v1", decision: "reject" });
    expect(t.mailer).not.toHaveBeenCalled();
  });

  it("shows an Email not sent mark through getReview for a failed one", async () => {
    const t = ready({ mailerFails: true });
    await t.service.decide(owner, { videoId: "v1", decision: "changes", note: "Louder." });
    const view = await t.service.getReview(owner, "v1");
    expect(view!.history[0]).toMatchObject({ toStatus: "CHANGES_REQUESTED", emailFailed: true });
  });
});

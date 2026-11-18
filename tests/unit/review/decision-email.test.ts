import { describe, expect, it } from "vitest";
import { buildDecisionEmail, shortFailure } from "@/lib/review/email";

const base = { title: "A rainy day", creatorName: "Salma", note: null, link: "https://instik.test/creator/videos" };

describe("buildDecisionEmail", () => {
  it("approved: subject, one sentence, link and signature, with no note section", () => {
    const m = buildDecisionEmail({ ...base, outcome: "approved" });
    expect(m.subject).toBe('Approved: "A rainy day" is live on Instik');
    expect(m.text).toContain("Hi Salma,");
    expect(m.text).toContain("approved and is live");
    expect(m.text).toContain("https://instik.test/creator/videos");
    expect(m.text).toMatch(/The Instik team$/);
    expect(m.text).not.toContain("From the Instik team");
    expect(m.html).toContain('<a href="https://instik.test/creator/videos">');
  });

  it("changes: subject and the link to that video", () => {
    const m = buildDecisionEmail({ ...base, outcome: "changes", note: "Please redo the audio.", link: "https://instik.test/creator/videos/v1" });
    expect(m.subject).toBe('Changes needed on "A rainy day"');
    expect(m.text).toContain("From the Instik team:\nPlease redo the audio.");
    expect(m.html).toContain("<strong>From the Instik team</strong>");
    expect(m.html).toContain("https://instik.test/creator/videos/v1");
  });

  it("rejected: says it will not go live, warmly, with the note", () => {
    const m = buildDecisionEmail({ ...base, outcome: "rejected", note: "It does not fit." });
    expect(m.subject).toBe('About "A rainy day"');
    expect(m.text).toContain("won't go live");
    expect(m.text).toContain("Thank you");
    expect(m.text).toContain("It does not fit.");
  });

  it("escapes the title, name and note in the HTML", () => {
    const m = buildDecisionEmail({
      outcome: "changes",
      title: '<b>"Hi"</b>',
      creatorName: "<script>x</script>",
      note: "a < b & c\nnext line",
      link: 'https://x.test/?a=1&b="2"',
    });
    expect(m.html).not.toContain("<script>");
    expect(m.html).not.toContain("<b>");
    expect(m.html).toContain("&lt;script&gt;");
    expect(m.html).toContain("a &lt; b &amp; c<br>next line");
    expect(m.html).toContain("&amp;b=&quot;2&quot;");
  });

  it("has a plain text and an HTML version, with no Mux ids or other creators", () => {
    const m = buildDecisionEmail({ ...base, outcome: "approved" });
    expect(m.text.length).toBeGreaterThan(20);
    expect(m.html.startsWith("<p>")).toBe(true);
    for (const body of [m.text, m.html]) expect(body).not.toMatch(/playback|mux|asset/i);
  });

  it("falls back to a friendly greeting without a name", () => {
    expect(buildDecisionEmail({ ...base, creatorName: " ", outcome: "approved" }).text).toContain("Hi there,");
  });
});

describe("shortFailure", () => {
  it("is at most 200 characters on one line and never empty", () => {
    expect(shortFailure("a\n\nb".repeat(200)).length).toBeLessThanOrEqual(200);
    expect(shortFailure("  ")).toBe("The email could not be sent.");
    expect(shortFailure("x\ny")).toBe("x y");
  });
});

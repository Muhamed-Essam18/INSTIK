import { describe, expect, it } from "vitest";
import { buildInviteEmail } from "@/lib/invites/email";

const link = "https://instik.test/invite/abc_DEF-123";

describe("buildInviteEmail", () => {
  it("has the invited name, the team, the link and the one-time, 7-day note", () => {
    const { subject, text, html } = buildInviteEmail({ name: "Mona Ali", link });
    expect(subject).toBe("You're invited to create on Instik");
    for (const body of [text, html]) {
      expect(body).toContain("Mona Ali");
      expect(body).toContain("Instik team");
      expect(body).toContain(link);
      expect(body).toMatch(/works once and lasts 7 days/);
    }
  });

  it("contains nothing else about anyone: no inviter and no invited email address", () => {
    const { text, html } = buildInviteEmail({ name: "Mona", link });
    for (const body of [text, html]) {
      expect(body).not.toMatch(/@/);
    }
  });

  it("never turns the invited name into markup", () => {
    const { html, text } = buildInviteEmail({ name: `<img src=x onerror=alert(1)> & "Co"`, link });
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt; &amp; &quot;Co&quot;");
    expect(text).toContain("<img"); // plain text is not interpreted as markup
  });
});

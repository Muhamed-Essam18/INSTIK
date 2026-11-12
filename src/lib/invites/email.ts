import type { InviteMessage } from "./service";

/** Escapes text for HTML: the invited name comes from an owner's form and must never become markup. */
const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const SUBJECT = "You're invited to create on Instik";

/**
 * The invitation: the invited name, the Instik team, the link and the sentence that it works once and lasts 7 days.
 * Nothing else about anyone is in it (spec FR-007).
 */
export function buildInviteEmail(message: Pick<InviteMessage, "name" | "link">): { subject: string; text: string; html: string } {
  const text = `Hi ${message.name},

The Instik team would like you to create videos on Instik. Here is your invitation:

${message.link}

It works once and lasts 7 days. If you weren't expecting it, you can ignore this email.

The Instik team`;
  const html = `<p>Hi ${escapeHtml(message.name)},</p><p>The Instik team would like you to create videos on Instik. Here is your invitation:</p><p><a href="${escapeHtml(message.link)}">Accept your invitation</a></p><p>It works once and lasts 7 days. If you weren't expecting it, you can ignore this email.</p><p>The Instik team</p>`;
  return { subject: SUBJECT, text, html };
}

/** Sends the invitation through Resend, the same service that sends sign-in links. */
export async function sendInviteEmail(message: InviteMessage): Promise<void> {
  // Imported here so the message builder above can be used (and tested) without the server environment.
  const { env } = await import("@/lib/env");
  const { AUTH_RESEND_KEY, EMAIL_FROM } = env();
  const { subject, text, html } = buildInviteEmail(message);
  // Development only: print the link, because the Resend test sender delivers to one address. Never in production.
  const development = process.env.NODE_ENV === "development";
  if (development) console.info(`[dev] Invite link for ${message.to}: ${message.link}`);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${AUTH_RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: EMAIL_FROM, to: message.to, subject, text, html }),
    });
    if (!response.ok) throw new Error(`Resend responded ${response.status}`);
  } catch (error) {
    // In development a refused send (test sender) must not cancel the invitation: the logged link still works.
    if (development) console.warn(`[dev] Invite email not delivered: ${error instanceof Error ? error.message : error}`);
    else throw error;
  }
}

import type { VideoStatusName } from "@/lib/content/status";

// The decision email (spec 10, contracts/decision-email.md): one per decision, to the creator, after the decision is saved.

export type DecisionOutcome = "approved" | "changes" | "rejected";

export const outcomeOf = (status: VideoStatusName): DecisionOutcome | null =>
  status === "APPROVED" ? "approved" : status === "CHANGES_REQUESTED" ? "changes" : status === "REJECTED" ? "rejected" : null;

export type DecisionMessage = {
  to: string;
  outcome: DecisionOutcome;
  title: string;
  creatorName: string;
  note: string | null;
  /** The address of the page the email points to. */
  link: string;
};

/** Escapes text for HTML: the title, the name and the note all come from forms and must never become markup. */
const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const subjectFor = (outcome: DecisionOutcome, title: string) =>
  outcome === "approved" ? `Approved: "${title}" is live on Instik` : outcome === "changes" ? `Changes needed on "${title}"` : `About "${title}"`;

const sentenceFor = (outcome: DecisionOutcome, title: string) =>
  outcome === "approved"
    ? `Good news: "${title}" has been approved and is live on Instik. Learners can watch it now.`
    : outcome === "changes"
      ? `We've had a look at "${title}" and it needs a few changes before it can go live. You can upload a new version whenever you're ready.`
      : `Thank you for sharing "${title}" with us. We've decided it won't go live on Instik.`;

const linkLabel = (outcome: DecisionOutcome) => (outcome === "changes" ? "See what to change" : "Go to My videos");

/** The subject, plain text and HTML for one decision. Nothing about learners, other creators or the video host is in it. */
export function buildDecisionEmail(message: Pick<DecisionMessage, "outcome" | "title" | "creatorName" | "note" | "link">): {
  subject: string;
  text: string;
  html: string;
} {
  const { outcome, title, creatorName, link } = message;
  const note = message.note?.trim() || null;
  const name = creatorName.trim() || "there";
  const sentence = sentenceFor(outcome, title);
  const text = [
    `Hi ${name},`,
    sentence,
    ...(note ? [`From the Instik team:\n${note}`] : []),
    `${linkLabel(outcome)}: ${link}`,
    "The Instik team",
  ].join("\n\n");
  const html = [
    `<p>Hi ${escapeHtml(name)},</p>`,
    `<p>${escapeHtml(sentence)}</p>`,
    ...(note ? [`<p><strong>From the Instik team</strong><br>${escapeHtml(note).replace(/\r?\n/g, "<br>")}</p>`] : []),
    `<p><a href="${escapeHtml(link)}">${linkLabel(outcome)}</a></p>`,
    "<p>The Instik team</p>",
  ].join("");
  return { subject: subjectFor(outcome, title), text, html };
}

/** A short plain reason for a failed send: never the provider's response body. */
export const FAILURE_MAX = 200;
export const shortFailure = (reason: string): string => reason.replace(/\s+/g, " ").trim().slice(0, FAILURE_MAX) || "The email could not be sent.";

/** Sends the decision email through Resend, the same service that sends sign-in links and invitations. Throws a short reason on failure. */
export async function sendDecisionEmail(message: DecisionMessage): Promise<void> {
  // Imported here so the builder above can be used (and tested) without the server environment.
  const { env } = await import("@/lib/env");
  const { AUTH_RESEND_KEY, EMAIL_FROM } = env();
  const { subject, text, html } = buildDecisionEmail(message);
  // Development only: print the message, because the Resend test sender delivers to one address. Never in production.
  const development = process.env.NODE_ENV === "development";
  if (development) console.info(`[dev] Decision email to ${message.to}: ${subject} (${message.link})`);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${AUTH_RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: EMAIL_FROM, to: message.to, subject, text, html }),
    });
    if (!response.ok) throw new Error(`The email service answered ${response.status}.`);
  } catch (error) {
    if (development) console.warn(`[dev] Decision email not delivered: ${error instanceof Error ? error.message : error}`);
    else throw new Error(error instanceof Error ? shortFailure(error.message) : "The email could not be sent.");
  }
}

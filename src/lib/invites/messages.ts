// What people read about invitations. Short, warm and calm; none of these says why a link failed (so a link cannot be probed).

export const INVALID_LINK = "This invitation can't be used. Ask the Instik team for a new one.";
export const WRONG_EMAIL = "This invitation was sent to a different email address. Sign in with the address it was sent to.";
export const ALREADY_PRIVILEGED = "Nothing needs doing: this account already has access.";

export const acceptMessage = (reason: "invalid" | "wrong-email" | "already-privileged" | "signed-out"): string =>
  reason === "wrong-email" ? WRONG_EMAIL : reason === "already-privileged" ? ALREADY_PRIVILEGED : INVALID_LINK;

export type InviteFormResult =
  | { ok: true }
  | { ok: false; field?: "name" | "email"; message: string };

export const createMessage = (
  result:
    | { reason: "forbidden" }
    | { reason: "invalid"; field: "name" | "email"; message: string }
    | { reason: "already-on-team" | "already-creator"; field: "email" }
    | { reason: "too-many" }
    | { reason: "send-failed" },
): { field?: "name" | "email"; message: string } => {
  switch (result.reason) {
    case "invalid":
      return { field: result.field, message: result.message };
    case "already-on-team":
      return { field: "email", message: "That address already belongs to someone on the Instik team." };
    case "already-creator":
      return { field: "email", message: "That person is already a creator." };
    case "too-many":
      return { message: "That's a lot of invitations for one hour. Try again a little later." };
    case "send-failed":
      return { message: "Couldn't send the email. Try again." };
    case "forbidden":
      return { message: "You can't do that." };
  }
};

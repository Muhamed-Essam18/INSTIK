import type { GrantReason, GrantRefusal, RemoveRefusal } from "./service";

// What the Access page says. Short, calm and specific; no blame.

export const reasonLabel: Record<GrantReason, string> = { TESTING: "Testing", CREATOR: "Creator", GIFT: "Gift", OTHER: "Other" };

export function grantRefusal(reason: GrantRefusal): string {
  switch (reason) {
    case "email":
      return "Enter the email address of the account.";
    case "reason":
      return "Choose why: testing, creator, gift or other.";
    case "note-too-long":
      return "Please shorten the note to 200 characters or fewer.";
    case "no-account":
      return "No account with that email yet. They need to sign in once first.";
    case "already-granted":
      return "This account already has Full access from you.";
  }
}

export function removeRefusal(reason: RemoveRefusal): string {
  switch (reason) {
    case "email":
      return "Enter the email address of the account.";
    case "note-too-long":
      return "Please shorten the note to 200 characters or fewer.";
    case "no-account":
      return "No account with that email yet.";
    case "no-grant":
      return "That account has no Full access from you to remove.";
  }
}

export const grantDone = (email: string) => `${email} now has Full access.`;
export const removeDone = (email: string) => `Full access from you was removed for ${email}.`;

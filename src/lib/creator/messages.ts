import type { HostFailure } from "./host-service";
import type { Failure } from "./upload-service";
import type { ProblemField } from "./rules";

// What a creator is told when something does not go through: short, warm, never shaming, and never a Mux detail or a status name.

export type ActionFailure = { ok: false; message: string; fields?: Partial<Record<ProblemField, string>> };

export function failureMessage(failure: Failure): ActionFailure {
  switch (failure.reason) {
    case "not-allowed":
      return { ok: false, message: "This isn't available to your account." };
    case "not-found":
      return { ok: false, message: "We couldn't find that video." };
    case "not-set-up":
      return { ok: false, message: "Uploads aren't set up yet. Please try again soon." };
    case "wrong-status":
      return { ok: false, message: "This video can't be changed right now." };
    case "host-error":
      return { ok: false, message: "We couldn't start the upload. Please try again." };
    case "invalid": {
      const fields: Partial<Record<ProblemField, string>> = {};
      for (const problem of failure.problems) fields[problem.field] ??= problem.message;
      return { ok: false, message: "A few things to finish first.", fields };
    }
  }
}

export const INPUT_PROBLEM: ActionFailure = { ok: false, message: "Something in that wasn't quite right. Please check and try again." };

/** What a creator is told when a host page edit does not go through. */
export function hostFailureMessage(failure: HostFailure): { ok: false; message: string; fields?: Partial<Record<string, string>> } {
  switch (failure.reason) {
    case "not-allowed":
      return { ok: false, message: "This isn't available to your account." };
    case "not-found":
      return { ok: false, message: "We couldn't find your host page." };
    case "not-set-up":
      return { ok: false, message: "Photo upload isn't set up yet. Please try again soon." };
    case "photo-failed":
      return { ok: false, message: "We couldn't save that photo. Your old photo is still there. Please try again." };
    case "photo":
      return { ok: false, message: failure.message };
    case "invalid":
      return { ok: false, message: "A few things to finish first.", fields: failure.fields };
  }
}

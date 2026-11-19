import type { RequestRefusal } from "./service";

// What the Requests page says. Short, calm and specific; no blame.

export function requestRefusal(reason: RequestRefusal): string {
  switch (reason) {
    case "stage":
      return "Choose a stage for the request.";
    case "topic":
      return "Choose a topic for the request.";
    case "empty":
      return "Write a sentence or two about the video you would like.";
    case "too-long":
      return "Please shorten the request to 200 characters or fewer.";
    case "not-found":
      return "We couldn't find that request. Reload and try again.";
    case "closed":
      return "That request is already closed.";
  }
}

export const REQUEST_POSTED = "Request posted. Every creator can see it now.";
export const REQUEST_SAVED = "Request updated.";
export const REQUEST_CLOSED = "Request closed. Creators no longer see it.";

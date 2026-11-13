import { describe, expect, it } from "vitest";
import {
  NOTE_MAX,
  PROCESSING_FAILED_NOTE,
  TOO_LONG_NOTE,
  allowedNext,
  automaticNote,
  checkTransition,
  movesBy,
  videoStatuses,
  type ActorKind,
  type VideoStatusName,
} from "@/lib/content/status";

const kinds: ActorKind[] = ["system", "creator", "owner"];

describe("the status path", () => {
  it("has seven statuses", () => {
    expect(videoStatuses).toHaveLength(7);
  });

  it.each([
    ["DRAFT", ["UPLOADING"]],
    ["UPLOADING", ["PROCESSING", "DRAFT"]],
    ["PROCESSING", ["IN_REVIEW", "DRAFT"]],
    ["IN_REVIEW", ["APPROVED", "CHANGES_REQUESTED", "REJECTED"]],
    ["CHANGES_REQUESTED", ["UPLOADING", "IN_REVIEW"]],
    ["APPROVED", []],
    ["REJECTED", []],
  ] as [VideoStatusName, VideoStatusName[]][])("%s can only go to %j", (from, next) => {
    expect([...allowedNext(from)].sort()).toEqual([...next].sort());
  });
});

describe("checkTransition: moves off the path", () => {
  it.each([
    ["DRAFT", "APPROVED"],
    ["DRAFT", "IN_REVIEW"],
    ["APPROVED", "DRAFT"],
    ["APPROVED", "REJECTED"],
    ["REJECTED", "UPLOADING"],
    ["IN_REVIEW", "DRAFT"],
    ["UPLOADING", "IN_REVIEW"],
    ["DRAFT", "DRAFT"],
  ] as [VideoStatusName, VideoStatusName][])("%s to %s is not allowed for anyone", (from, to) => {
    for (const by of kinds) {
      expect(checkTransition({ from, to, by, note: "a note" })).toEqual({ ok: false, reason: "not-allowed" });
    }
  });
});

describe("checkTransition: who may move", () => {
  it("lets the system record upload and processing results", () => {
    expect(checkTransition({ from: "UPLOADING", to: "PROCESSING", by: "system" })).toEqual({ ok: true });
    expect(checkTransition({ from: "PROCESSING", to: "IN_REVIEW", by: "system" })).toEqual({ ok: true });
    expect(checkTransition({ from: "PROCESSING", to: "DRAFT", by: "system" })).toEqual({ ok: true });
  });

  it("allows PROCESSING to DRAFT (processing failed) for the system only", () => {
    expect(checkTransition({ from: "PROCESSING", to: "DRAFT", by: "creator", note: "x" })).toEqual({ ok: false, reason: "forbidden" });
    expect(checkTransition({ from: "PROCESSING", to: "DRAFT", by: "owner", note: "x" })).toEqual({ ok: false, reason: "forbidden" });
  });

  it("no longer lets processing go back to UPLOADING", () => {
    for (const by of kinds) {
      expect(checkTransition({ from: "PROCESSING", to: "UPLOADING", by, note: "x" })).toEqual({ ok: false, reason: "not-allowed" });
    }
  });

  it("has one automatic note, for a failed upload or failed processing (back to Draft) only", () => {
    expect(PROCESSING_FAILED_NOTE).toBe("The upload didn't work. Please try again.");
    expect(automaticNote("PROCESSING", "DRAFT")).toBe(PROCESSING_FAILED_NOTE);
    expect(automaticNote("UPLOADING", "DRAFT")).toBe(PROCESSING_FAILED_NOTE);
    for (const from of videoStatuses) {
      for (const to of videoStatuses) {
        if ((from === "PROCESSING" || from === "UPLOADING") && to === "DRAFT") continue;
        expect(automaticNote(from, to)).toBeNull();
      }
    }
  });

  it("has a fixed, kind note for a video that is too long", () => {
    expect(TOO_LONG_NOTE).toBe("That video is longer than 30 minutes. Please upload a shorter one.");
  });

  it("lets only the system send a first upload back to Draft (cancelled, errored or expired)", () => {
    expect(checkTransition({ from: "UPLOADING", to: "DRAFT", by: "system" })).toEqual({ ok: true });
    expect(checkTransition({ from: "UPLOADING", to: "DRAFT", by: "creator" })).toEqual({ ok: false, reason: "forbidden" });
    expect(checkTransition({ from: "UPLOADING", to: "DRAFT", by: "owner" })).toEqual({ ok: false, reason: "forbidden" });
  });

  it("lets a creator complete their own submission once processing is done, and nobody else", () => {
    expect(checkTransition({ from: "PROCESSING", to: "IN_REVIEW", by: "creator" })).toEqual({ ok: true });
    expect(checkTransition({ from: "PROCESSING", to: "IN_REVIEW", by: "system" })).toEqual({ ok: true });
    expect(checkTransition({ from: "PROCESSING", to: "IN_REVIEW", by: "owner" })).toEqual({ ok: false, reason: "forbidden" });
  });

  it("lets a creator start an upload and upload again or resubmit after changes were requested", () => {
    expect(checkTransition({ from: "DRAFT", to: "UPLOADING", by: "creator" })).toEqual({ ok: true });
    expect(checkTransition({ from: "CHANGES_REQUESTED", to: "UPLOADING", by: "creator" })).toEqual({ ok: true });
    expect(checkTransition({ from: "CHANGES_REQUESTED", to: "IN_REVIEW", by: "creator" })).toEqual({ ok: true });
  });

  it("lets only an owner make the review decisions", () => {
    expect(checkTransition({ from: "IN_REVIEW", to: "APPROVED", by: "owner" })).toEqual({ ok: true });
    expect(checkTransition({ from: "IN_REVIEW", to: "APPROVED", by: "creator" })).toEqual({ ok: false, reason: "forbidden" });
    expect(checkTransition({ from: "IN_REVIEW", to: "APPROVED", by: "system" })).toEqual({ ok: false, reason: "forbidden" });
    expect(checkTransition({ from: "IN_REVIEW", to: "REJECTED", by: "creator", note: "x" })).toEqual({ ok: false, reason: "forbidden" });
  });

  it("does not let an owner start an upload", () => {
    expect(checkTransition({ from: "DRAFT", to: "UPLOADING", by: "owner" })).toEqual({ ok: false, reason: "forbidden" });
  });

  it("gives nobody a move outside the table", () => {
    for (const by of kinds) {
      for (const from of videoStatuses) {
        for (const to of videoStatuses) {
          const listed = movesBy[by].some(([f, t]) => f === from && t === to);
          const result = checkTransition({ from, to, by, note: "a note" });
          expect(result.ok).toBe(listed);
        }
      }
    }
  });
});

describe("checkTransition: notes", () => {
  it("requires a non-blank note for Rejected and Changes requested", () => {
    for (const to of ["REJECTED", "CHANGES_REQUESTED"] as const) {
      expect(checkTransition({ from: "IN_REVIEW", to, by: "owner" })).toEqual({ ok: false, reason: "note-required" });
      expect(checkTransition({ from: "IN_REVIEW", to, by: "owner", note: "   " })).toEqual({ ok: false, reason: "note-required" });
      expect(checkTransition({ from: "IN_REVIEW", to, by: "owner", note: "Audio is unclear" })).toEqual({ ok: true });
    }
  });

  it("keeps the note optional elsewhere", () => {
    expect(checkTransition({ from: "IN_REVIEW", to: "APPROVED", by: "owner", note: "Lovely" })).toEqual({ ok: true });
    expect(checkTransition({ from: "DRAFT", to: "UPLOADING", by: "creator", note: null })).toEqual({ ok: true });
  });

  it("refuses a note over 2,000 characters", () => {
    const long = "x".repeat(NOTE_MAX + 1);
    expect(checkTransition({ from: "IN_REVIEW", to: "APPROVED", by: "owner", note: long })).toEqual({ ok: false, reason: "note-too-long" });
    expect(checkTransition({ from: "IN_REVIEW", to: "APPROVED", by: "owner", note: "x".repeat(NOTE_MAX) })).toEqual({ ok: true });
  });
});

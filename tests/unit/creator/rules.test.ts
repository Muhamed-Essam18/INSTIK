import { describe, expect, it } from "vitest";
import {
  CHECKLIST_ITEMS,
  canDelete,
  canEditDetails,
  canUploadNewVersion,
  countByFilter,
  displayStatus,
  listFor,
  parseFilter,
  shortNote,
  submitProblems,
  type Filter,
  type VideoFacts,
} from "@/lib/creator/rules";

const now = new Date("2026-11-13T12:00:00Z");
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);
const v = (extra: Partial<VideoFacts> & Pick<VideoFacts, "status">): VideoFacts => extra;

describe("displayStatus", () => {
  it.each([
    [v({ status: "DRAFT" }), "draft", "Draft"],
    [v({ status: "UPLOADING", uploadStartedAt: minutesAgo(5) }), "uploading", "Uploading"],
    [v({ status: "PROCESSING" }), "processing", "Processing"],
    [v({ status: "PROCESSING", assetReadyAt: now }), "ready-to-submit", "Ready to submit"],
    [v({ status: "PROCESSING", assetReadyAt: now, submittedAt: now }), "processing", "Processing"],
    [v({ status: "IN_REVIEW" }), "in-review", "In review"],
    [v({ status: "CHANGES_REQUESTED" }), "changes-requested", "Changes requested"],
    [v({ status: "REJECTED" }), "rejected", "Rejected"],
    [v({ status: "APPROVED" }), "live", "Live"],
  ])("maps %j to %s", (video, key, label) => {
    expect(displayStatus(video, now)).toMatchObject({ key, label });
  });

  it("says Upload didn't finish after 75 minutes (1 hour link plus 15 minutes) with no asset, and not before", () => {
    expect(displayStatus(v({ status: "UPLOADING", uploadStartedAt: minutesAgo(74) }), now).key).toBe("uploading");
    expect(displayStatus(v({ status: "UPLOADING", uploadStartedAt: minutesAgo(76) }), now).key).toBe("upload-unfinished");
    expect(displayStatus(v({ status: "UPLOADING", uploadStartedAt: minutesAgo(600), hasAsset: true }), now).key).toBe("uploading");
  });

  it("keeps Changes requested and adds the new version state", () => {
    expect(displayStatus(v({ status: "CHANGES_REQUESTED", hasPendingUpload: true, pendingStartedAt: minutesAgo(3) }), now)).toMatchObject({
      key: "changes-requested",
      pending: { key: "new-version-processing", label: "New version processing" },
    });
    expect(displayStatus(v({ status: "CHANGES_REQUESTED", hasPendingUpload: true, hasPendingAsset: true }), now).pending?.key).toBe(
      "new-version-processing",
    );
    expect(
      displayStatus(v({ status: "CHANGES_REQUESTED", hasPendingUpload: true, hasPendingAsset: true, pendingReadyAt: now }), now).pending,
    ).toEqual({ key: "new-version-ready", label: "New version ready to submit" });
    expect(displayStatus(v({ status: "CHANGES_REQUESTED", hasPendingUpload: true, pendingStartedAt: minutesAgo(80) }), now).pending?.key).toBe(
      "new-version-unfinished",
    );
  });
});

describe("filters and counts", () => {
  const videos: VideoFacts[] = [
    v({ status: "UPLOADING", uploadStartedAt: minutesAgo(2) }),
    v({ status: "PROCESSING" }),
    v({ status: "PROCESSING", assetReadyAt: now }),
    v({ status: "DRAFT" }),
    v({ status: "UPLOADING", uploadStartedAt: minutesAgo(200) }),
    v({ status: "IN_REVIEW" }),
    v({ status: "IN_REVIEW" }),
    v({ status: "CHANGES_REQUESTED", hasPendingUpload: true }),
    v({ status: "REJECTED" }),
    v({ status: "APPROVED" }),
    v({ status: "DRAFT", deletedAt: now }),
  ];

  it("counts match the rows of each filter", () => {
    const counts = countByFilter(videos, now);
    for (const key of ["all", "in-review", "changes", "live", "drafts"] as const) {
      expect(counts[key]).toBe(listFor(videos, key, now).length);
    }
    expect(counts).toEqual({ all: 10, "in-review": 2, changes: 1, live: 1, drafts: 3 });
  });

  it("puts Uploading, Processing and Rejected only under All, and Ready to submit under Drafts", () => {
    const keys = (f: Filter) => listFor(videos, f, now).map((x) => displayStatus(x, now).key);
    expect(keys("drafts").sort()).toEqual(["draft", "ready-to-submit", "upload-unfinished"]);
    for (const f of ["in-review", "changes", "live", "drafts"] as const) {
      expect(keys(f)).not.toContain("uploading");
      expect(keys(f)).not.toContain("processing");
      expect(keys(f)).not.toContain("rejected");
    }
  });

  it("keeps a Changes requested video with a new version under Changes requested", () => {
    expect(listFor(videos, "changes", now)).toHaveLength(1);
  });

  it("leaves soft-deleted videos out of every list and count", () => {
    expect(listFor(videos, "all", now).some((x) => x.deletedAt)).toBe(false);
  });

  it("reads the status from the address, and anything unknown means All", () => {
    expect(parseFilter("changes")).toBe("changes");
    expect(parseFilter(["live", "x"])).toBe("live");
    expect(parseFilter("nonsense")).toBe("all");
    expect(parseFilter(undefined)).toBe("all");
  });
});

describe("shortNote", () => {
  it("is null for nothing, whole when short, and cut with an ellipsis when long", () => {
    expect(shortNote(null)).toBeNull();
    expect(shortNote("   ")).toBeNull();
    expect(shortNote("Lovely work")).toBe("Lovely work");
    const long = "The audio is quiet from 2:10 to 3:40 because of the street noise and we would like it again";
    const out = shortNote(long, 60)!;
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(61);
  });
});

describe("what a creator may do", () => {
  it("edits details in a Draft, in Changes requested, and before submitting while uploading or processing", () => {
    expect(canEditDetails(v({ status: "DRAFT" }))).toBe(true);
    expect(canEditDetails(v({ status: "CHANGES_REQUESTED" }))).toBe(true);
    expect(canEditDetails(v({ status: "UPLOADING" }))).toBe(true);
    expect(canEditDetails(v({ status: "PROCESSING" }))).toBe(true);
    expect(canEditDetails(v({ status: "PROCESSING", submittedAt: now }))).toBe(false);
    for (const status of ["IN_REVIEW", "APPROVED", "REJECTED"] as const) expect(canEditDetails(v({ status }))).toBe(false);
    expect(canEditDetails(v({ status: "DRAFT", deletedAt: now }))).toBe(false);
  });

  it("uploads a new version only from Changes requested", () => {
    expect(canUploadNewVersion(v({ status: "CHANGES_REQUESTED" }))).toBe(true);
    for (const status of ["DRAFT", "UPLOADING", "PROCESSING", "IN_REVIEW", "REJECTED", "APPROVED"] as const) {
      expect(canUploadNewVersion(v({ status }))).toBe(false);
    }
  });

  it("deletes drafts only: a Draft, Ready to submit and an upload that didn't finish", () => {
    expect(canDelete(v({ status: "DRAFT" }), now)).toBe(true);
    expect(canDelete(v({ status: "PROCESSING", assetReadyAt: now }), now)).toBe(true);
    expect(canDelete(v({ status: "UPLOADING", uploadStartedAt: minutesAgo(200) }), now)).toBe(true);
    expect(canDelete(v({ status: "UPLOADING", uploadStartedAt: minutesAgo(5) }), now)).toBe(false);
    for (const status of ["PROCESSING", "IN_REVIEW", "CHANGES_REQUESTED", "REJECTED", "APPROVED"] as const) {
      expect(canDelete(v({ status }), now)).toBe(false);
    }
    expect(canDelete(v({ status: "DRAFT", deletedAt: now }), now)).toBe(false);
  });
});

describe("submitProblems", () => {
  const good = { title: "Visiting grandma", description: "We visit her.", proposedStage: "follow-it", topic: "family", languageCode: "arz" };
  const ok = { checklist: CHECKLIST_ITEMS.map(() => true), hostComplete: true, uploadStarted: true, hasReadyFile: false };

  it("has five checklist items", () => {
    expect(CHECKLIST_ITEMS).toHaveLength(5);
  });

  it("accepts a complete submission", () => {
    expect(submitProblems(good, ok)).toEqual([]);
  });

  it("names every missing item", () => {
    const fields = submitProblems({}, { checklist: [true, false, true, true, true], hostComplete: false, uploadStarted: false, hasReadyFile: false }).map(
      (p) => p.field,
    );
    expect(fields).toEqual(["title", "description", "proposedStage", "topic", "languageCode", "checklist", "host", "upload"]);
  });

  it("limits the title to 120 and the description to 1,000 characters", () => {
    expect(submitProblems({ ...good, title: "x".repeat(121) }, ok).map((p) => p.field)).toEqual(["title"]);
    expect(submitProblems({ ...good, title: "x".repeat(120) }, ok)).toEqual([]);
    expect(submitProblems({ ...good, description: "x".repeat(1001) }, ok).map((p) => p.field)).toEqual(["description"]);
    expect(submitProblems({ ...good, description: "x".repeat(1000) }, ok)).toEqual([]);
  });

  it("refuses a stage, topic or language that is not on the lists, and a language that is not open", () => {
    expect(submitProblems({ ...good, proposedStage: "expert" }, ok).map((p) => p.field)).toEqual(["proposedStage"]);
    expect(submitProblems({ ...good, topic: "cars" }, ok).map((p) => p.field)).toEqual(["topic"]);
    expect(submitProblems({ ...good, languageCode: "xx" }, ok).map((p) => p.field)).toEqual(["languageCode"]);
  });

  it("needs all five checklist items ticked, not four and not one unticked", () => {
    expect(submitProblems(good, { ...ok, checklist: [true, true, true, true] }).map((p) => p.field)).toEqual(["checklist"]);
    expect(submitProblems(good, { ...ok, checklist: [true, true, true, true, false] }).map((p) => p.field)).toEqual(["checklist"]);
  });

  it("lets a video in Changes requested resubmit details with a ready file and no new upload", () => {
    expect(submitProblems(good, { ...ok, uploadStarted: false, hasReadyFile: true })).toEqual([]);
  });

  it("writes every message in kind words", () => {
    const messages = submitProblems({}, { checklist: [], hostComplete: false, uploadStarted: false, hasReadyFile: false }).map((p) => p.message);
    for (const message of messages) expect(message).not.toMatch(/invalid|error|failed|must/i);
  });
});

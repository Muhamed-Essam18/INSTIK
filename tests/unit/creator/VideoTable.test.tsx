import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StatusFilters } from "@/components/creator/StatusFilters";
import { VideoTable } from "@/components/creator/VideoTable";
import type { CreatorVideo } from "@/lib/content/creator-reads";
import { rowsFor, shortDate } from "@/lib/creator/list";
import { countByFilter, type Filter } from "@/lib/creator/rules";

afterEach(cleanup);

const now = new Date("2026-11-13T12:00:00Z");
const day = (d: string) => new Date(`2026-${d}T10:00:00Z`);

const video = (extra: Partial<CreatorVideo> & Pick<CreatorVideo, "id" | "title" | "status">): CreatorVideo => ({
  languageCode: "arz",
  slug: extra.id,
  stage: null,
  proposedStage: "follow-it",
  topic: "family",
  description: null,
  access: "FULL",
  durationSeconds: null,
  hostSlug: "salma",
  createdAt: day("11-01"),
  updatedAt: day("11-10"),
  submittedAt: null,
  assetReadyAt: null,
  uploadStartedAt: null,
  hasAsset: false,
  hasPlayback: false,
  hasPendingUpload: false,
  hasPendingAsset: false,
  pendingReadyAt: null,
  pendingStartedAt: null,
  pendingFailure: null,
  latestNote: null,
  ...extra,
});

const videos: CreatorVideo[] = [
  video({ id: "a", title: "Visiting grandma on Friday", status: "PROCESSING", updatedAt: new Date("2026-11-13T09:00:00Z") }),
  video({ id: "b", title: "Taking the metro to work", status: "CHANGES_REQUESTED", updatedAt: day("11-12"), latestNote: "The audio is quiet from 2:10 to 3:40 because of the street noise and we would like it again" }),
  video({ id: "c", title: "Bargaining at the market", status: "IN_REVIEW", updatedAt: day("11-10"), proposedStage: "understand-it", latestNote: "Transcript being written" }),
  video({ id: "d", title: "A rainy day in Alexandria", status: "IN_REVIEW", updatedAt: day("11-09"), proposedStage: "hear-it" }),
  video({ id: "e", title: "At the café", status: "APPROVED", updatedAt: day("10-02"), stage: "follow-it" }),
  video({ id: "f", title: "Ordering koshary", status: "DRAFT", updatedAt: day("11-08") }),
  video({ id: "g", title: "Ready one", status: "PROCESSING", assetReadyAt: day("11-07"), updatedAt: day("11-07") }),
  video({ id: "h", title: "Not for learners", status: "REJECTED", updatedAt: day("09-01"), latestNote: "Not a fit" }),
  video({ id: "x", title: "Deleted draft", status: "DRAFT", updatedAt: day("11-13") }),
];
// A soft-deleted draft is already left out by the read; the rows and counts also leave out anything carrying deletedAt.
const withDeleted = [...videos.slice(0, -1), { ...videos.at(-1)!, deletedAt: now } as CreatorVideo];

function table(filter: Filter) {
  const rows = rowsFor(withDeleted, filter, now);
  render(<VideoTable rows={rows} filterLabel={filter === "all" ? "All" : filter} />);
  return rows;
}

describe("the rows", () => {
  it("lists every video newest update first, with stage, status, a shortened note or a dash, and the date", () => {
    const rows = table("all");
    expect(rows.map((r) => r.id)).toEqual(["a", "b", "c", "d", "f", "g", "e", "h"]);
    const body = screen.getAllByRole("row").slice(1);
    expect(body).toHaveLength(8);
    const metro = body.find((r) => within(r).queryByText("Taking the metro to work"))!;
    expect(within(metro).getByText("Follow it")).toBeTruthy();
    expect(within(metro).getByText("Changes requested")).toBeTruthy();
    expect(within(metro).getByText(/^The audio is quiet from 2:10/).textContent!.endsWith("…")).toBe(true);
    expect(within(metro).getByText("12 Nov")).toBeTruthy();
    const grandma = body.find((r) => within(r).queryByText("Visiting grandma on Friday"))!;
    expect(within(grandma).getByText("Today")).toBeTruthy();
    expect(within(grandma).getByText("Processing")).toBeTruthy();
    expect(within(grandma).getAllByText("—").length).toBeGreaterThanOrEqual(2); // no note, no views
  });

  it("shows the views slot as a dash unless the video is live, and a placeholder for a live one", () => {
    table("all");
    const live = screen.getAllByRole("row").find((r) => within(r).queryByText("At the café"))!;
    expect(within(live).getByText("Soon")).toBeTruthy();
    expect(screen.getAllByText("Soon")).toHaveLength(1);
  });

  it("opens the status page from each title", () => {
    table("all");
    expect(screen.getByRole("link", { name: "Taking the metro to work" }).getAttribute("href")).toBe("/creator/videos/b");
  });

  it("shows the proposed stage, else the final one, and a dash when there is neither", () => {
    const rows = rowsFor([video({ id: "p", title: "P", status: "DRAFT", proposedStage: null, stage: "hear-it" }), video({ id: "q", title: "Q", status: "DRAFT", proposedStage: null })], "all", now);
    expect(rows.find((r) => r.id === "p")!.stage).toBe("Hear it");
    expect(rows.find((r) => r.id === "q")!.stage).toBeNull();
  });

  it("calls an untitled draft Untitled video", () => {
    expect(rowsFor([video({ id: "u", title: "  ", status: "DRAFT" })], "all", now)[0].title).toBe("Untitled video");
  });
});

describe("the filters", () => {
  it("each count equals the rows of its filter", () => {
    const counts = countByFilter(withDeleted, now);
    for (const f of ["all", "in-review", "changes", "live", "drafts"] as const) expect(counts[f]).toBe(rowsFor(withDeleted, f, now).length);
    expect(counts).toEqual({ all: 8, "in-review": 2, changes: 1, live: 1, drafts: 2 });
  });

  it("puts Ready to submit under Drafts, and Processing and Rejected only under All", () => {
    expect(rowsFor(withDeleted, "drafts", now).map((r) => r.id).sort()).toEqual(["f", "g"]);
    for (const f of ["in-review", "changes", "live", "drafts"] as const) {
      const ids = rowsFor(withDeleted, f, now).map((r) => r.id);
      expect(ids).not.toContain("a");
      expect(ids).not.toContain("h");
    }
    expect(rowsFor(withDeleted, "all", now).map((r) => r.id)).toContain("h");
  });

  it("keeps a Changes requested video with a new version under Changes requested, with the new-version label", () => {
    const pending = [video({ id: "b", title: "Metro", status: "CHANGES_REQUESTED", hasPendingUpload: true, hasPendingAsset: true, pendingReadyAt: day("11-12") })];
    const rows = rowsFor(pending, "changes", now);
    expect(rows).toHaveLength(1);
    expect(rows[0].display.pending?.label).toBe("New version ready to submit");
    render(<VideoTable rows={rows} filterLabel="Changes requested" />);
    expect(screen.getByText("New version ready to submit")).toBeTruthy();
  });

  it("renders links with counts, marks the current one, and uses plain addresses", () => {
    const counts = countByFilter(withDeleted, now);
    render(<StatusFilters current="changes" counts={counts} />);
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual(["All8", "In review2", "Changes requested1", "Live1", "Drafts2"]);
    expect(links.filter((l) => l.getAttribute("aria-current") === "page").map((l) => l.textContent)).toEqual(["Changes requested1"]);
    expect(links[0].getAttribute("href")).toBe("/creator/videos");
    expect(links[2].getAttribute("href")).toBe("/creator/videos?status=changes");
  });
});

describe("empty and end of list", () => {
  it("shows a calm empty state that links to Upload a video", () => {
    render(<VideoTable rows={[]} filterLabel="All" />);
    expect(screen.getByText("You haven't made a video yet.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Upload a video" }).getAttribute("href")).toBe("/creator/upload");
  });

  it("says when a filter is empty", () => {
    render(<VideoTable rows={[]} filterLabel="Live" />);
    expect(screen.getByText("Nothing under Live right now.")).toBeTruthy();
  });

  it("has no pagination or load-more: the list simply ends", () => {
    table("all");
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText(/load more|next page|show more/i)).toBeNull();
  });
});

describe("shortDate", () => {
  it("says Today for today, else the day and month", () => {
    expect(shortDate(new Date("2026-11-13T01:00:00Z"), now)).toBe("Today");
    expect(shortDate(new Date("2026-11-12T23:00:00Z"), now)).toBe("12 Nov");
  });
});

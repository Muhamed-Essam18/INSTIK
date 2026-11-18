import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { QueueCounts } from "@/components/owner/QueueCounts";
import { QueueTable } from "@/components/owner/QueueTable";
import type { QueueRow } from "@/lib/review/service";

afterEach(cleanup);

const row = (extra: Partial<QueueRow> & Pick<QueueRow, "id" | "title">): QueueRow => ({
  creatorName: "Salma",
  stage: "hear-it",
  durationSeconds: 362,
  submittedAt: new Date("2026-11-09T10:00:00Z"),
  waiting: "4 days",
  badge: "Needs review",
  hasTranscript: false,
  ...extra,
});

const counts = { needsReview: 4, transcriptInProgress: 1, waitingOnCreator: 2, approvedThisMonth: 9 };

describe("QueueCounts", () => {
  it("shows the four counts and links Waiting on creator to the waiting list", () => {
    render(<QueueCounts counts={counts} />);
    const items = within(screen.getByRole("list", { name: "Queue counts" })).getAllByRole("listitem");
    expect(items).toHaveLength(4);
    expect(screen.getByText("Needs review").nextSibling?.textContent).toBe("4");
    expect(screen.getByText("Transcript in progress").nextSibling?.textContent).toBe("1");
    expect(screen.getByText("Approved this month").nextSibling?.textContent).toBe("9");
    const link = screen.getByRole("link", { name: /Waiting on creator: 2/ });
    expect(link.getAttribute("href")).toBe("/owner/waiting");
    expect(link.className).toContain("min-h-11");
  });
});

describe("QueueTable", () => {
  it("shows each video's details and the right button: Review before a transcript, Continue after", () => {
    render(
      <QueueTable
        rows={[
          row({ id: "a", title: "A rainy day in Alexandria" }),
          row({ id: "b", title: "Bargaining at the market", stage: "understand-it", badge: "Transcript in progress", hasTranscript: true, waiting: "Today" }),
        ]}
        list="review"
      />,
    );
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("Salma")).toBeTruthy();
    expect(within(rows[0]).getByText("Hear it")).toBeTruthy();
    expect(within(rows[0]).getByText("6 min")).toBeTruthy();
    expect(within(rows[0]).getByText("9 Nov")).toBeTruthy();
    expect(within(rows[0]).getByText("4 days")).toBeTruthy();
    expect(within(rows[0]).getByText("Needs review")).toBeTruthy();
    expect(within(rows[0]).getByRole("link", { name: "Review A rainy day in Alexandria" }).textContent).toBe("Review");
    expect(within(rows[0]).getByRole("link", { name: "Review A rainy day in Alexandria" }).getAttribute("href")).toBe("/owner/review/a");
    expect(within(rows[1]).getByText("Understand it")).toBeTruthy();
    expect(within(rows[1]).getByText("Today")).toBeTruthy();
    expect(within(rows[1]).getByRole("link", { name: /Continue/ }).textContent).toBe("Continue");
  });

  it("labels the waiting list's buttons View", () => {
    render(<QueueTable rows={[row({ id: "a", title: "T", badge: "Changes requested" })]} list="waiting" />);
    expect(screen.getByRole("link", { name: "View T" }).textContent).toBe("View");
    expect(screen.getByText("Changes requested")).toBeTruthy();
  });

  it("says Nothing waiting for an empty queue, and the counts can still be shown beside it", () => {
    render(
      <>
        <QueueCounts counts={{ needsReview: 0, transcriptInProgress: 0, waitingOnCreator: 1, approvedThisMonth: 3 }} />
        <QueueTable rows={[]} list="review" />
      </>,
    );
    expect(screen.getByText("Nothing waiting.")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText("Approved this month").nextSibling?.textContent).toBe("3");
  });

  it("has no infinite scroll or load more control", () => {
    render(<QueueTable rows={[row({ id: "a", title: "T" })]} list="review" />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText(/load more|show more/i)).toBeNull();
  });
});

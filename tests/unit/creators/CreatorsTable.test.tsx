import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CreatorsTable } from "@/components/owner/CreatorsTable";
import { CreatorStats } from "@/components/owner/CreatorStats";
import type { CreatorRow } from "@/lib/creators/rules";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
vi.mock("@/lib/creators/actions", () => ({ pauseCreator: vi.fn(), resumeCreator: vi.fn() }));
vi.mock("@/lib/invites/actions", () => ({ resendInvite: vi.fn() }));

afterEach(cleanup);

const row = (extra: Partial<CreatorRow> & Pick<CreatorRow, "id" | "name" | "status">): CreatorRow => ({
  kind: "creator",
  email: `${extra.id}@x.com`,
  expired: false,
  live: 0,
  inReview: 0,
  changes: 0,
  ...extra,
});

describe("CreatorsTable", () => {
  const rows = [
    row({ id: "u1", name: "Omar", status: "Active", live: 12, inReview: 2, changes: 1 }),
    row({ id: "u2", name: "Youssef", status: "Paused", live: 3 }),
    row({ id: "i1", name: "Hana", status: "Invited", kind: "invitee" }),
    row({ id: "i2", name: "Old", status: "Invited", kind: "invitee", expired: true }),
  ];

  it("shows Pause for Active, Resume for Paused and Resend for Invited, with the status badges", () => {
    render(<CreatorsTable rows={rows} />);
    const [, omar, youssef, hana] = screen.getAllByRole("row");
    expect(within(omar).getByText("Active")).toBeTruthy();
    expect(within(omar).getByRole("button", { name: "Pause Omar" })).toBeTruthy();
    expect(within(youssef).getByText("Paused")).toBeTruthy();
    expect(within(youssef).getByRole("button", { name: "Resume Youssef" })).toBeTruthy();
    expect(within(hana).getByText("Invited")).toBeTruthy();
    expect(within(hana).getByRole("button", { name: "Resend the invitation to Hana" })).toBeTruthy();
    expect(within(hana).queryByRole("button", { name: /Pause/ })).toBeNull();
  });

  it("shows the counts for creators and dashes for people who have not joined, and an Expired mark", () => {
    render(<CreatorsTable rows={rows} />);
    const [, omar, , hana, old] = screen.getAllByRole("row");
    expect(within(omar).getAllByRole("cell").map((c) => c.textContent).slice(1, 4)).toEqual(["12", "2", "1"]);
    expect(within(hana).getAllByRole("cell").map((c) => c.textContent).slice(1, 4)).toEqual(["—", "—", "—"]);
    expect(within(old).getByText("Expired")).toBeTruthy();
    expect(within(hana).queryByText("Expired")).toBeNull();
  });

  it("links a creator to their page and has no earnings or counted-views columns", () => {
    render(<CreatorsTable rows={rows} />);
    expect(screen.getByRole("link", { name: "Omar" }).getAttribute("href")).toBe("/owner/creators/u1");
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Creator", "Status", "Videos live", "In review", "Changes requested", "Actions"]);
    expect(document.body.textContent).not.toMatch(/earning|counted views|€/i);
  });

  it("asks for a calm confirmation before pausing", async () => {
    render(<CreatorsTable rows={[row({ id: "u1", name: "Omar", status: "Active" })]} />);
    const pause = screen.getByRole("button", { name: "Pause Omar" });
    pause.click();
    expect(await screen.findByText("They won't be able to upload or submit. Their live videos stay up.")).toBeTruthy();
  });

  it("says so when there are no creators", () => {
    render(<CreatorsTable rows={[]} />);
    expect(screen.getByText(/No creators yet/)).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("makes every action a 44px target", () => {
    render(<CreatorsTable rows={rows} />);
    for (const button of screen.getAllByRole("button")) expect(button.className).toContain("min-h-11");
  });
});

describe("CreatorStats", () => {
  it("shows counts and dates and nothing about earnings or views", () => {
    render(
      <CreatorStats
        stats={{
          id: "u1",
          name: "Omar",
          email: "o@x.com",
          status: "Active",
          counts: { live: 4, inReview: 2, changes: 1, rejected: 0, drafts: 3 },
          approvedThisMonth: 2,
          joinedAt: new Date("2026-10-01T10:00:00Z"),
          lastUploadAt: null,
        }}
      />,
    );
    const list = within(screen.getByRole("list", { name: "Videos by status" }));
    expect(list.getAllByRole("listitem")).toHaveLength(6);
    expect(list.getByText("Approved this month").nextSibling?.textContent).toBe("2");
    expect(screen.getByText("1 Oct")).toBeTruthy();
    expect(screen.getByText("No uploads yet")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/earning|views|€/i);
  });
});

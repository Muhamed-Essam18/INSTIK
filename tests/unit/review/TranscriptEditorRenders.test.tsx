import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TranscriptEditor } from "@/components/owner/TranscriptEditor";
import type { SegmentView } from "@/lib/review/service";

const renders = vi.hoisted(() => ({ count: 0, router: { refresh: () => {} } }));
// Next gives the same router object on every call, so the mock does too.
vi.mock("next/navigation", () => ({ useRouter: () => renders.router }));
vi.mock("@/lib/review/actions", () => ({ saveSegment: vi.fn(), deleteSegment: vi.fn(), previewVtt: vi.fn(), importVtt: vi.fn(), addGlossaryEntry: vi.fn(), updateGlossaryEntry: vi.fn() }));
// A stand-in row that counts how often it renders. The real row is wrapped in `memo` the same way.
vi.mock("@/components/owner/SegmentRow", async () => {
  const { memo } = await import("react");
  return {
    SegmentRow: memo(function Row() {
      renders.count += 1;
      return <div data-testid="row" />;
    }),
  };
});

afterEach(cleanup);

const segments: SegmentView[] = Array.from({ length: 500 }, (_, i) => ({
  id: `s${i}`,
  position: i + 1,
  start: i * 2,
  end: i * 2 + 1.5,
  script: "كلام",
  transliteration: "",
  english: "",
  revision: 0,
  links: [],
}));

describe("the editor with 500 segments", () => {
  it("re-renders no existing row when a segment is added", () => {
    render(<TranscriptEditor videoId="v1" segments={segments} entries={{}} lang="arz" dir="rtl" scriptLabel="Arabic" readOnly={false} onCount={() => {}} />);
    expect(screen.getAllByTestId("row")).toHaveLength(500);
    expect(renders.count).toBe(500);
    fireEvent.click(screen.getByRole("button", { name: "Add segment" }));
    expect(screen.getAllByTestId("row")).toHaveLength(501);
    // Only the new row rendered: the 500 unchanged rows were skipped.
    expect(renders.count).toBe(501);
  });
});

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { VideoCard } from "@/components/library/VideoCard";
import type { LibraryVideo } from "@/lib/content/search";

afterEach(cleanup);

const video: LibraryVideo = {
  slug: "at-the-cafe",
  title: "At the café",
  stage: "follow-it",
  stageLabel: "Follow it",
  topic: "food",
  minutes: 8,
  hostName: "Salma",
  hostSlug: "salma",
  searchKey: "at the cafe salma",
  watched: false,
};

describe("VideoCard", () => {
  it("is one link to the watch page with stage, title, length and host", () => {
    render(<VideoCard languageSlug="arabic-egyptian" video={video} />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/learn/arabic-egyptian/watch/at-the-cafe");
    expect(link.textContent).toContain("Follow it");
    expect(link.textContent).toContain("At the café");
    expect(link.textContent).toContain("8 min · with Salma");
  });

  it("shows the Watched label only when watched", () => {
    const { rerender } = render(<VideoCard languageSlug="arabic-egyptian" video={video} />);
    expect(screen.queryByText("Watched")).toBeNull();
    rerender(<VideoCard languageSlug="arabic-egyptian" video={{ ...video, watched: true }} />);
    expect(screen.getByText("Watched")).toBeTruthy();
  });
});

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HostVideoList } from "@/components/host/HostVideoList";
import { VideoCard } from "@/components/library/VideoCard";
import type { LibraryVideo } from "@/lib/content/search";

afterEach(cleanup);

const video = (over: Partial<LibraryVideo> = {}): LibraryVideo => ({
  slug: "a-day-at-a-wedding",
  title: "A day at a wedding",
  stage: "follow-it",
  stageLabel: "Follow it",
  topic: "food",
  minutes: 8,
  hostName: "Salma",
  hostSlug: "salma",
  searchKey: "a day at a wedding",
  watched: false,
  access: "full",
  ...over,
});

describe("VideoCard locked marker", () => {
  it("shows no marker on a free card", () => {
    render(<VideoCard languageSlug="arabic-egyptian" video={video({ access: "free" })} />);
    expect(screen.queryByText("Full access")).toBeNull();
  });

  it("shows no marker on a full-access card for a learner with access (not locked)", () => {
    render(<VideoCard languageSlug="arabic-egyptian" video={video({ locked: false })} />);
    expect(screen.queryByText("Full access")).toBeNull();
  });

  it("shows the marker and keeps title, host, stage and length", () => {
    render(<VideoCard languageSlug="arabic-egyptian" video={video({ locked: true })} />);
    expect(screen.getByText("Full access")).toBeTruthy();
    expect(screen.getByText("A day at a wedding")).toBeTruthy();
    expect(screen.getByText("8 min · with Salma")).toBeTruthy();
    expect(screen.getByText("Follow it")).toBeTruthy();
  });

  it("is still a link to the watch page", () => {
    render(<VideoCard languageSlug="arabic-egyptian" video={video({ locked: true })} />);
    expect(screen.getByRole("link").getAttribute("href")).toBe("/learn/arabic-egyptian/watch/a-day-at-a-wedding");
  });

  it("the prop overrides the video's flag", () => {
    render(<VideoCard languageSlug="arabic-egyptian" video={video({ locked: false })} locked />);
    expect(screen.getByText("Full access")).toBeTruthy();
  });

  it("marks the lock icon as decorative so the word is read once", () => {
    const { container } = render(<VideoCard languageSlug="arabic-egyptian" video={video({ locked: true })} />);
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("host page list", () => {
  it("marks the locked videos and leaves the free ones plain", () => {
    render(
      <HostVideoList
        languageSlug="arabic-egyptian"
        hostName="Salma"
        videos={[video({ locked: true }), video({ slug: "at-the-cafe", title: "At the café", access: "free", locked: false })]}
      />,
    );
    expect(screen.getAllByText("Full access")).toHaveLength(1);
    expect(screen.getByText("At the café")).toBeTruthy();
  });

  it("says kindly when a host has no videos yet", () => {
    render(<HostVideoList languageSlug="arabic-egyptian" hostName="Salma" videos={[]} />);
    expect(screen.getByText(/first videos are on the way/)).toBeTruthy();
  });
});

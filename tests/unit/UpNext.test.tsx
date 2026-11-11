import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { UpNext } from "@/components/watch/UpNext";
import type { LibraryVideo } from "@/lib/content/search";

afterEach(cleanup);

const video = (slug: string, title: string, host: string): LibraryVideo => ({
  slug,
  title,
  stage: "follow-it",
  stageLabel: "Follow it",
  topic: "food",
  minutes: 7,
  hostName: host,
  hostSlug: host.toLowerCase(),
  searchKey: slug,
  watched: false,
  access: "free",
});

const closing = "That's all for Up next. Pick one when you're ready, or finish for today.";

describe("UpNext", () => {
  it("shows the heading, the autoplay switch, one card per video each with its host, and the closing line", () => {
    const { container } = render(
      <UpNext languageSlug="arabic-egyptian" videos={[video("bread", "Buying bread", "Omar"), video("corniche", "A walk", "Salma")]} />,
    );
    expect(screen.getByRole("heading", { name: "Up next" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Autoplay next/ })).toBeTruthy();
    const cards = screen.getAllByRole("link").filter((a) => a.getAttribute("href")?.includes("/watch/"));
    expect(cards).toHaveLength(2);
    expect(cards[0].textContent).toContain("with Omar");
    expect(cards[1].textContent).toContain("with Salma");
    expect(container.textContent).toContain(closing);
  });

  it("links 'finish for today' to Done for today", () => {
    render(<UpNext languageSlug="arabic-egyptian" videos={[video("bread", "Buying bread", "Omar")]} />);
    expect(screen.getByRole("link", { name: "finish for today" }).getAttribute("href")).toBe("/learn/arabic-egyptian/done");
  });

  it("shows a kind message and the same closing line when there is nothing at this stage", () => {
    const { container } = render(<UpNext languageSlug="arabic-egyptian" videos={[]} />);
    expect(screen.getByText("More videos at this stage are on the way.")).toBeTruthy();
    expect(container.textContent).toContain(closing);
    expect(screen.getByRole("link", { name: "finish for today" })).toBeTruthy();
  });

  it("has no load-more control", () => {
    render(<UpNext languageSlug="arabic-egyptian" videos={[video("bread", "Buying bread", "Omar")]} />);
    expect(screen.queryByRole("button", { name: /more/i })).toBeNull();
  });
});

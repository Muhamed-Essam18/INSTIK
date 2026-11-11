import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LibraryBrowser } from "@/components/library/LibraryBrowser";
import type { LibraryVideo } from "@/lib/content/search";
import type { StageSlug, TopicSlug } from "@/lib/content/taxonomy";
import { normalizeForSearch } from "@/lib/text/normalize";

afterEach(cleanup);

function make(slug: string, title: string, titleAr: string, stage: StageSlug, stageLabel: string, topic: TopicSlug, host: string): LibraryVideo {
  return {
    slug,
    title,
    stage,
    stageLabel,
    topic,
    minutes: 5,
    hostName: host,
    hostSlug: host.toLowerCase(),
    searchKey: normalizeForSearch(`${title} ${titleAr} ${host}`),
    watched: false,
    access: "free",
  };
}

const videos = [
  make("family", "My family", "أُسْرَتِي", "hear-it", "Hear it", "family", "Salma"),
  make("cafe", "At the café", "في الكَافِيه", "follow-it", "Follow it", "food", "Salma"),
  make("bread", "Buying bread", "العِيش", "follow-it", "Follow it", "food", "Omar"),
  make("corniche", "A walk", "الكُورْنِيش", "follow-it", "Follow it", "getting-around", "Salma"),
  make("microbus", "Taking a microbus", "المِيكْروباص", "follow-it", "Follow it", "getting-around", "Omar"),
  make("ramadan", "Ramadan nights", "رَمَضَان", "understand-it", "Understand it", "culture", "Salma"),
];

const setup = () => render(<LibraryBrowser languageSlug="arabic-egyptian" videos={videos} />);
const cards = () => screen.queryAllByRole("listitem");
const status = () => screen.getByRole("status").textContent;
const press = (group: string, name: string) =>
  fireEvent.click(within(screen.getByRole("group", { name: group })).getByRole("button", { name }));
const search = (value: string) => fireEvent.change(screen.getByLabelText("Search videos"), { target: { value } });

describe("LibraryBrowser filters", () => {
  it("starts on Follow it with the count line and the end message", () => {
    setup();
    expect(cards()).toHaveLength(4);
    expect(status()).toBe("4 videos at Follow it. Your stage is Follow it.");
    expect(screen.getByRole("button", { name: "Follow it" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("That's everything for this stage. New videos arrive every week.")).toBeTruthy();
  });

  it("switches stage and sets aria-pressed", () => {
    setup();
    press("Stage", "Hear it");
    expect(cards()).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Hear it" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Follow it" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("shows the empty message for a stage with no videos", () => {
    setup();
    press("Stage", "Join in");
    expect(cards()).toHaveLength(0);
    expect(status()).toBe("No videos at Join in yet. They are on the way.");
  });

  it("narrows by topic and clears it when pressed again", () => {
    setup();
    press("Topic", "Food");
    expect(cards()).toHaveLength(2);
    press("Topic", "Food");
    expect(cards()).toHaveLength(4);
  });

  it("has no load-more control and ends with the end message", () => {
    const { container } = setup();
    expect(screen.queryByRole("button", { name: /more/i })).toBeNull();
    expect(container.lastElementChild?.textContent).toContain("That's everything");
  });
});

describe("LibraryBrowser search", () => {
  it("searches all stages and shows each card's stage", () => {
    setup();
    press("Topic", "Food");
    search("family");
    expect(cards()).toHaveLength(1);
    expect(cards()[0].textContent).toContain("Hear it");
    expect(status()).toBe('1 video match "family".');
    expect(screen.getByText("That's everything that matches.")).toBeTruthy();
  });

  it("finds Arabic without tashkeel and with another alef", () => {
    setup();
    search("الكافيه");
    expect(cards()).toHaveLength(1);
    search("اسرتي");
    expect(cards()[0].textContent).toContain("My family");
    search("أسرتي");
    expect(cards()[0].textContent).toContain("My family");
  });

  it("returns to the stage and topic view when cleared", () => {
    setup();
    press("Stage", "Understand it");
    search("cafe");
    expect(cards()).toHaveLength(1);
    search("");
    expect(cards()).toHaveLength(1);
    expect(cards()[0].textContent).toContain("Ramadan nights");
  });

  it("shows a kind message and a working Clear search button when nothing matches", () => {
    setup();
    search("zzz");
    expect(status()).toBe('Nothing matches "zzz". Try a shorter word.');
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(cards()).toHaveLength(4);
    expect((screen.getByLabelText("Search videos") as HTMLInputElement).value).toBe("");
  });
});

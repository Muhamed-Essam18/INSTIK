import { describe, expect, it } from "vitest";
import { normalizeForSearch } from "@/lib/text/normalize";
import { filterVideos, type LibraryVideo } from "@/lib/content/search";

function make(slug: string, title: string, titleArabic: string, stage: LibraryVideo["stage"], topic: LibraryVideo["topic"], host: string, hostAr: string): LibraryVideo {
  return {
    slug,
    title,
    stage,
    stageLabel: stage,
    topic,
    minutes: 5,
    hostName: host,
    hostSlug: host.toLowerCase(),
    searchKey: normalizeForSearch([title, titleArabic, host, hostAr].join(" ")),
    watched: false,
  };
}

const videos = [
  make("cafe", "At the café", "في الكَافِيه", "follow-it", "food", "Salma", "سلمى"),
  make("family", "My family", "أُسْرَتِي", "hear-it", "family", "Salma", "سلمى"),
  make("microbus", "Taking a microbus", "رُكُوب المِيكْروباص", "follow-it", "getting-around", "Omar", "عمر"),
];

const base = { stage: "follow-it" as const, topic: null, query: "" };
const slugs = (list: LibraryVideo[]) => list.map((v) => v.slug);

describe("filterVideos", () => {
  it("uses stage and topic when the query is empty or only whitespace", () => {
    expect(slugs(filterVideos(videos, base))).toEqual(["cafe", "microbus"]);
    expect(slugs(filterVideos(videos, { ...base, query: "   " }))).toEqual(["cafe", "microbus"]);
    expect(slugs(filterVideos(videos, { ...base, topic: "food" }))).toEqual(["cafe"]);
  });

  it("treats a query of only tashkeel as empty", () => {
    expect(slugs(filterVideos(videos, { ...base, query: "َُ" }))).toEqual(["cafe", "microbus"]);
  });

  it("searches all stages and topics when the query is not empty", () => {
    expect(slugs(filterVideos(videos, { ...base, topic: "food", query: "family" }))).toEqual(["family"]);
  });

  it("needs every term to match", () => {
    expect(slugs(filterVideos(videos, { ...base, query: "taking microbus" }))).toEqual(["microbus"]);
    expect(slugs(filterVideos(videos, { ...base, query: "taking family" }))).toEqual([]);
  });

  it("matches Latin text ignoring accents and case", () => {
    expect(slugs(filterVideos(videos, { ...base, query: "CAFE" }))).toEqual(["cafe"]);
  });

  it("matches Arabic with or without tashkeel", () => {
    expect(slugs(filterVideos(videos, { ...base, query: "الكافيه" }))).toEqual(["cafe"]);
    expect(slugs(filterVideos(videos, { ...base, query: "الكَافِيه" }))).toEqual(["cafe"]);
  });

  it("matches alef variants", () => {
    for (const a of ["أ", "إ", "ا", "آ"]) {
      expect(slugs(filterVideos(videos, { ...base, query: `${a}سرتي` }))).toEqual(["family"]);
    }
  });

  it("matches host names in Latin and Arabic", () => {
    expect(slugs(filterVideos(videos, { ...base, query: "omar" }))).toEqual(["microbus"]);
    expect(slugs(filterVideos(videos, { ...base, query: "سلمي" }))).toEqual(["cafe", "family"]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(filterVideos(videos, { ...base, query: "zzz" })).toEqual([]);
  });
});

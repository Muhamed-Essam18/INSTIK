import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HostHero } from "@/components/host/HostHero";
import { OtherHosts } from "@/components/host/OtherHosts";
import type { PublicHost } from "@/lib/content/mappers";
import { getLanguageBySlug } from "@/lib/languages";

afterEach(cleanup);

const language = getLanguageBySlug("arabic-egyptian")!;
const salma: PublicHost = {
  slug: "salma",
  name: "Salma",
  nameArabic: "سلمى",
  story: "I grew up by the sea.",
  topics: ["Alexandria", "Food"],
  photo: null,
  order: 1,
};
const omar: PublicHost = { ...salma, slug: "omar", name: "Omar", nameArabic: "عمر", topics: ["Markets", "Transport"], order: 2 };

describe("HostHero", () => {
  it("shows the names, story and topics, with Arabic tagged rtl", () => {
    render(<HostHero language={language} host={salma} helloHref="/learn/arabic-egyptian/watch/my-family" first />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Salma");
    const arabic = screen.getByText("سلمى");
    expect(arabic.getAttribute("lang")).toBe("arz");
    expect(arabic.getAttribute("dir")).toBe("rtl");
    expect(screen.getByText("I grew up by the sea.")).toBeTruthy();
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Alexandria", "Food"]);
    expect(screen.getByText("Host · Egyptian Arabic")).toBeTruthy();
  });

  it("explains the photo placeholder", () => {
    render(<HostHero language={language} host={salma} />);
    expect(screen.getByText("Photo coming soon")).toBeTruthy();
  });

  it("links the say-hello action to the given video, and leaves it out without one", () => {
    const { rerender } = render(<HostHero language={language} host={salma} helloHref="/learn/arabic-egyptian/watch/my-family" />);
    expect(screen.getByRole("link", { name: "Watch Salma say hello" }).getAttribute("href")).toBe(
      "/learn/arabic-egyptian/watch/my-family",
    );
    rerender(<HostHero language={language} host={salma} />);
    expect(screen.queryByRole("link", { name: /say hello/ })).toBeNull();
  });
});

describe("HostHero for a new creator", () => {
  const fresh: PublicHost = { slug: "new-creator", name: "New Creator", nameArabic: null, story: "", topics: [], photo: null, order: 3 };

  it("leaves out the Arabic name and the topics when there are none", () => {
    render(<HostHero language={language} host={fresh} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("New Creator");
    expect(screen.queryByLabelText("Topics")).toBeNull();
    expect(document.querySelector("[lang=\"arz\"]")).toBeNull();
  });

  it("shows a calm placeholder instead of an empty story", () => {
    render(<HostHero language={language} host={fresh} />);
    expect(screen.getByText("Their story is coming soon.")).toBeTruthy();
  });

  it("treats a story of only spaces as empty and keeps a real story as written", () => {
    const { rerender } = render(<HostHero language={language} host={{ ...fresh, story: "   " }} />);
    expect(screen.getByText("Their story is coming soon.")).toBeTruthy();
    rerender(<HostHero language={language} host={{ ...fresh, story: "I teach by cooking." }} />);
    expect(screen.getByText("I teach by cooking.")).toBeTruthy();
    expect(screen.queryByText("Their story is coming soon.")).toBeNull();
  });
});

describe("OtherHosts", () => {
  it("links to each other host and always shows the joining-soon box", () => {
    render(<OtherHosts languageSlug="arabic-egyptian" hosts={[omar]} />);
    expect(screen.getByRole("link", { name: /Omar/ }).getAttribute("href")).toBe("/learn/arabic-egyptian/hosts/omar");
    expect(screen.getByText("More hosts joining soon")).toBeTruthy();
  });

  it("shows only the joining-soon box with no other hosts", () => {
    render(<OtherHosts languageSlug="arabic-egyptian" hosts={[]} />);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.getByText("More hosts joining soon")).toBeTruthy();
  });
});

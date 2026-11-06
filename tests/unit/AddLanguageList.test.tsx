import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AddLanguageList } from "@/components/settings/AddLanguageList";
import type { Language } from "@/lib/languages.schema";
import { languagesToOffer } from "@/lib/learner/profile-rules";

const base: Pick<Language, "nativeName" | "direction" | "fonts" | "transcriptLayers"> = {
  nativeName: "x",
  direction: "ltr",
  fonts: { ui: "sans", transcript: "sans" },
  transcriptLayers: ["script", "english"],
};
const arabic: Language = { ...base, code: "arz", slug: "arabic-egyptian", name: "Arabic", variety: "Egyptian", script: "arabic", status: "available" };
const french: Language = { ...base, code: "fr", slug: "french", name: "French", script: "latin", status: "available" };
const spanish: Language = { ...base, code: "es", slug: "spanish", name: "Spanish", script: "latin", status: "coming-soon" };

afterEach(cleanup);

describe("AddLanguageList", () => {
  const offers = languagesToOffer([arabic, french, spanish], [{ languageCode: "arz" }]);

  it("offers available languages the learner does not have as choices", () => {
    render(<AddLanguageList offers={offers} value={undefined} onChoose={() => {}} />);
    expect(screen.getAllByRole("radio").map((r) => r.textContent)).toEqual(["French"]);
  });

  it("shows owned languages as Added and not selectable", () => {
    render(<AddLanguageList offers={offers} value={undefined} onChoose={() => {}} />);
    expect(screen.getByText("Egyptian Arabic")).toBeTruthy();
    expect(screen.getByText("Added")).toBeTruthy();
    expect(screen.queryByRole("radio", { name: /Egyptian Arabic/ })).toBeNull();
  });

  it("shows unavailable languages with a link to the waitlist", () => {
    render(<AddLanguageList offers={offers} value={undefined} onChoose={() => {}} />);
    const link = screen.getByRole("link", { name: "Join the waitlist" });
    expect(link.getAttribute("href")).toBe("/#waitlist");
    expect(screen.queryByRole("radio", { name: /Spanish/ })).toBeNull();
  });

  it("reports the chosen language", () => {
    const onChoose = vi.fn();
    render(<AddLanguageList offers={offers} value={undefined} onChoose={onChoose} />);
    fireEvent.click(screen.getByRole("radio", { name: "French" }));
    expect(onChoose).toHaveBeenCalledWith("fr");
  });

  it("says so when there is nothing new to add", () => {
    const none = languagesToOffer([arabic, spanish], [{ languageCode: "arz" }]);
    render(<AddLanguageList offers={none} value={undefined} onChoose={() => {}} />);
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.getByText(/nothing new to add yet/)).toBeTruthy();
  });
});

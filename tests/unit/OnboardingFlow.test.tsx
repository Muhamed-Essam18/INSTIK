import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/actions", () => ({ requestEmailLink: vi.fn(), signInWithGoogle: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import type { Language } from "@/lib/languages.schema";
import { ONBOARDING_KEY } from "@/lib/onboarding/draft-storage";
import { resetStoredMemory } from "@/lib/player/preferences";

const base: Pick<Language, "nativeName" | "direction" | "fonts" | "transcriptLayers"> = {
  nativeName: "x",
  direction: "ltr",
  fonts: { ui: "sans", transcript: "sans" },
  transcriptLayers: ["script", "english"],
};
const languages: Language[] = [
  {
    ...base,
    code: "arz",
    slug: "arabic-egyptian",
    name: "Arabic",
    variety: "Egyptian",
    description: "The Arabic of Cairo",
    script: "arabic",
    status: "available",
  },
  { ...base, code: "es", slug: "spanish", name: "Spanish", script: "latin", status: "coming-soon" },
];

const stored = () => JSON.parse(window.localStorage.getItem(ONBOARDING_KEY) ?? "null");
const renderFlow = (props: Partial<React.ComponentProps<typeof OnboardingFlow>> = {}) =>
  render(<OnboardingFlow languages={languages} signedIn={false} {...props} />);

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  resetStoredMemory();
});
afterEach(cleanup);

describe("OnboardingFlow", () => {
  it("opens on step 1 with the progress and the language list", () => {
    renderFlow();
    expect(screen.getByText("Step 1 of 4")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "What do you want to pick up?" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /Egyptian Arabic/ })).toBeTruthy();
    expect(screen.getByText("Available")).toBeTruthy();
  });

  it("dims languages that are not available and links them to the waitlist", () => {
    renderFlow();
    expect(screen.queryByRole("radio", { name: /Spanish/ })).toBeNull();
    const links = screen.getAllByRole("link", { name: "Join the waitlist" });
    expect(links).toHaveLength(2); // Spanish and "Something else"
    for (const link of links) expect(link.getAttribute("href")).toBe("/#waitlist");
    expect(screen.getByText("Something else")).toBeTruthy();
  });

  it("choosing a language moves to step 2 and keeps the choice", () => {
    renderFlow();
    fireEvent.click(screen.getByRole("radio", { name: /Egyptian Arabic/ }));
    expect(screen.getByText("Step 2 of 4")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "How much Egyptian Arabic do you know?" })).toBeTruthy();
    expect(stored().language).toBe("arz");
  });

  it("shows the four levels with their learner stage and preselects the first", () => {
    renderFlow();
    fireEvent.click(screen.getByRole("radio", { name: /Egyptian Arabic/ }));
    const group = screen.getByRole("radiogroup", { name: "Your level" });
    expect(group.querySelectorAll('[role="radio"]')).toHaveLength(4);
    expect(screen.getByRole("radio", { name: /None at all/ }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: /slow, simple talk/ }).textContent).toContain("Follow it");
    expect(screen.getByRole("radio", { name: /everyday talk/ }).textContent).toContain("Understand it");
    expect(document.body.textContent).not.toMatch(/Superbeginner|Beginner|Intermediate|Advanced/);
  });

  it("Continue saves the preselected level and 20 minutes even when nothing was touched", () => {
    renderFlow();
    fireEvent.click(screen.getByRole("radio", { name: /Egyptian Arabic/ }));
    expect(stored().level).toBeUndefined();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(stored().level).toBe("none");
    expect(screen.getByText("Step 3 of 4")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "20 min" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(stored().minutes).toBe(20);
    expect(screen.getByText("Step 4 of 4")).toBeTruthy();
  });

  it("offers exactly 10, 20, 30 and 60 minutes with one selected, and says there are no streaks", () => {
    window.localStorage.setItem(ONBOARDING_KEY, JSON.stringify({ step: 3, language: "arz", level: "few" }));
    renderFlow();
    const labels = screen.getAllByRole("radio").map((r) => r.textContent);
    expect(labels).toEqual(["10 min", "20 min", "30 min", "60 min"]);
    fireEvent.click(screen.getByRole("radio", { name: "30 min" }));
    expect(screen.getAllByRole("radio").filter((r) => r.getAttribute("aria-checked") === "true")).toHaveLength(1);
    expect(screen.getByText(/No streaks, nothing to lose/)).toBeTruthy();
  });

  it("Back keeps the earlier choices selected", () => {
    renderFlow();
    fireEvent.click(screen.getByRole("radio", { name: /Egyptian Arabic/ }));
    fireEvent.click(screen.getByRole("radio", { name: /Some words and phrases/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("radio", { name: "60 min" }));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("radio", { name: /Some words and phrases/ }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("radio", { name: /Egyptian Arabic/ }).getAttribute("aria-checked")).toBe("true");
  });

  it("restores the step and the choices after a reload", () => {
    window.localStorage.setItem(
      ONBOARDING_KEY,
      JSON.stringify({ step: 3, language: "arz", level: "slow", minutes: 60 }),
    );
    renderFlow();
    expect(screen.getByText("Step 3 of 4")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "60 min" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("radio", { name: /slow, simple talk/ }).getAttribute("aria-checked")).toBe("true");
  });

  it("does not let a stored step skip an unanswered question", () => {
    window.localStorage.setItem(ONBOARDING_KEY, JSON.stringify({ step: 4 }));
    renderFlow();
    expect(screen.getByText("Step 1 of 4")).toBeTruthy();
  });

  it("starts at the level question for the language of the page the learner was going to", () => {
    renderFlow({ preferredLanguage: "arz", returnTo: "/learn/arabic-egyptian/watch/at-the-cafe" });
    expect(screen.getByText("Step 2 of 4")).toBeTruthy();
  });

  it("offers an optional listening check that never blocks Continue or changes the level", () => {
    renderFlow();
    fireEvent.click(screen.getByRole("radio", { name: /Egyptian Arabic/ }));
    fireEvent.click(screen.getByRole("radio", { name: /I can follow slow/ }));
    expect(screen.getByText(/It's optional and there's no score/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try a short listening check" }));
    expect(screen.getByRole("status").textContent).toMatch(/listening check is coming/);
    expect(screen.getByRole("radio", { name: /I can follow slow/ }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("Step 3 of 4")).toBeTruthy();
    expect(stored().level).toBe("slow");
  });

  it("options are radios in a radiogroup and arrow keys move the selection", () => {
    renderFlow();
    fireEvent.click(screen.getByRole("radio", { name: /Egyptian Arabic/ }));
    const first = screen.getByRole("radio", { name: /None at all/ });
    expect(first.getAttribute("tabindex")).toBe("0");
    expect(screen.getByRole("radio", { name: /Some words/ }).getAttribute("tabindex")).toBe("-1");
    fireEvent.keyDown(first, { key: "ArrowDown" });
    expect(screen.getByRole("radio", { name: /Some words/ }).getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: /Some words/ }));
  });

  it("moves focus to the new step's heading", () => {
    renderFlow();
    fireEvent.click(screen.getByRole("radio", { name: /Egyptian Arabic/ }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1 }));
  });

  it("step 4 shows the sign-in form, no password and no Start watching while signed out", () => {
    window.localStorage.setItem(
      ONBOARDING_KEY,
      JSON.stringify({ step: 4, language: "arz", level: "few", minutes: 30 }),
    );
    const { container } = renderFlow();
    expect(screen.getByRole("heading", { name: "Save your hours" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeTruthy();
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(container.querySelector('input[type="password"]')).toBeNull();
    expect(screen.queryByRole("link", { name: "Start watching" })).toBeNull();
  });

  it("step 4 shows Start watching once signed in", () => {
    window.localStorage.setItem(
      ONBOARDING_KEY,
      JSON.stringify({ step: 4, language: "arz", level: "few", minutes: 30 }),
    );
    renderFlow({ signedIn: true });
    expect(screen.getByRole("link", { name: "Start watching" }).getAttribute("href")).toBe("/onboarding/finish");
    expect(screen.queryByLabelText("Email")).toBeNull();
  });
});

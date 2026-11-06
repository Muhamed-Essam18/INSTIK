import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ completeOnboarding: vi.fn(), replace: vi.fn() }));
vi.mock("@/lib/learner/actions", () => ({ completeOnboarding: mocks.completeOnboarding }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace, push: vi.fn() }) }));

import { FinishOnboarding } from "@/components/onboarding/FinishOnboarding";
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
  { ...base, code: "arz", slug: "arabic-egyptian", name: "Arabic", script: "arabic", status: "available" },
];
const draft = { step: 4, language: "arz", level: "few", minutes: 30 };
const input = { languageCode: "arz", stage: "HEAR_IT", minutesPerDay: 30 };

const renderFinish = (props: Partial<React.ComponentProps<typeof FinishOnboarding>> = {}) =>
  render(<FinishOnboarding languages={languages} existingCodes={[]} {...props} />);

beforeEach(() => {
  mocks.completeOnboarding.mockReset();
  mocks.replace.mockReset();
  window.localStorage.clear();
  resetStoredMemory();
});
afterEach(cleanup);

describe("FinishOnboarding", () => {
  it("creates the profile from the saved choices, clears them and goes to the return address", async () => {
    window.localStorage.setItem(ONBOARDING_KEY, JSON.stringify(draft));
    mocks.completeOnboarding.mockResolvedValue({ ok: true });
    renderFinish({ returnTo: "/learn/arabic-egyptian/watch/at-the-cafe" });
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/learn/arabic-egyptian/watch/at-the-cafe"));
    expect(mocks.completeOnboarding).toHaveBeenCalledTimes(1);
    expect(mocks.completeOnboarding).toHaveBeenCalledWith({ ...input, replaceExisting: false });
    expect(window.localStorage.getItem(ONBOARDING_KEY)).toBeNull();
  });

  it("lands in the Library of the chosen language when there is no return address", async () => {
    window.localStorage.setItem(ONBOARDING_KEY, JSON.stringify(draft));
    mocks.completeOnboarding.mockResolvedValue({ ok: true });
    renderFinish();
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/learn/arabic-egyptian"));
  });

  it("asks before replacing an existing profile; Keep mine makes no second call", async () => {
    window.localStorage.setItem(ONBOARDING_KEY, JSON.stringify(draft));
    mocks.completeOnboarding.mockResolvedValue({ ok: false, code: "exists" });
    renderFinish({ existingCodes: ["arz"] });
    expect(await screen.findByText("Keep your current choices, or use these?")).toBeTruthy();
    expect(mocks.replace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Keep mine" }));
    expect(mocks.completeOnboarding).toHaveBeenCalledTimes(1);
    expect(mocks.replace).toHaveBeenCalledWith("/learn/arabic-egyptian");
    expect(window.localStorage.getItem(ONBOARDING_KEY)).toBeNull();
  });

  it("Use these replaces the profile", async () => {
    window.localStorage.setItem(ONBOARDING_KEY, JSON.stringify(draft));
    mocks.completeOnboarding.mockResolvedValueOnce({ ok: false, code: "exists" }).mockResolvedValueOnce({ ok: true });
    renderFinish({ existingCodes: ["arz"] });
    fireEvent.click(await screen.findByRole("button", { name: "Use these" }));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalled());
    expect(mocks.completeOnboarding).toHaveBeenLastCalledWith({ ...input, replaceExisting: true });
  });

  it("with no saved choices and no profile, goes to onboarding to ask the questions once", async () => {
    renderFinish({ returnTo: "/learn/arabic-egyptian/watch/x" });
    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledWith("/onboarding?returnTo=%2Flearn%2Farabic-egyptian%2Fwatch%2Fx"),
    );
    expect(mocks.completeOnboarding).not.toHaveBeenCalled();
  });

  it("with no saved choices but an existing profile, just carries on", async () => {
    renderFinish({ existingCodes: ["arz"], returnTo: "/settings" });
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/settings"));
    expect(mocks.completeOnboarding).not.toHaveBeenCalled();
  });

  it("keeps the saved choices and shows a kind retry message on failure", async () => {
    window.localStorage.setItem(ONBOARDING_KEY, JSON.stringify(draft));
    mocks.completeOnboarding.mockRejectedValue(new Error("down"));
    renderFinish();
    expect((await screen.findByRole("alert")).textContent).toMatch(/Nothing is lost/);
    expect(window.localStorage.getItem(ONBOARDING_KEY)).not.toBeNull();
    mocks.completeOnboarding.mockResolvedValue({ ok: true });
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/learn/arabic-egyptian"));
  });

  it("calls the action only once even when rendered twice in strict mode", async () => {
    window.localStorage.setItem(ONBOARDING_KEY, JSON.stringify(draft));
    mocks.completeOnboarding.mockResolvedValue({ ok: true });
    render(
      <StrictMode>
        <FinishOnboarding languages={languages} existingCodes={[]} />
      </StrictMode>,
    );
    await waitFor(() => expect(mocks.replace).toHaveBeenCalled());
    expect(mocks.completeOnboarding).toHaveBeenCalledTimes(1);
  });
});

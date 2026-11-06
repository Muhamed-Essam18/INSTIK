import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ saveLayers: vi.fn(), saveAnswer: vi.fn() }));
vi.mock("@/lib/learner/preference-actions", () => mocks);

import { useAccountAnswer } from "@/hooks/useAccountAnswer";
import { useAccountLayers } from "@/hooks/useAccountLayers";
import { DEFAULT_LAYERS } from "@/lib/player/preferences";

const allowed = ["script", "tashkeel", "transliteration", "english"];

beforeEach(() => {
  mocks.saveLayers.mockReset().mockResolvedValue({ ok: true });
  mocks.saveAnswer.mockReset().mockResolvedValue({ ok: true });
});

describe("useAccountLayers", () => {
  const setup = (initial = DEFAULT_LAYERS) =>
    renderHook(() => useAccountLayers({ initial, languageCode: "arz", allowed }));

  it("starts from the value the server read from the account", () => {
    const { result } = setup({ ...DEFAULT_LAYERS, english: true });
    expect(result.current[0].english).toBe(true);
    expect(result.current[2]).toBe(false);
  });

  it("updates at once and saves the full layers for the language", async () => {
    const { result } = setup();
    await act(async () => result.current[1]({ ...DEFAULT_LAYERS, english: true }));
    expect(result.current[0].english).toBe(true);
    expect(mocks.saveLayers).toHaveBeenCalledWith({ languageCode: "arz", layers: { ...DEFAULT_LAYERS, english: true } });
  });

  it("sends only the layers the language uses", async () => {
    const { result } = renderHook(() =>
      useAccountLayers({ initial: DEFAULT_LAYERS, languageCode: "es", allowed: ["script", "english"] }),
    );
    await act(async () => result.current[1]({ ...DEFAULT_LAYERS, english: true }));
    expect(mocks.saveLayers).toHaveBeenCalledWith({ languageCode: "es", layers: { script: true, english: true } });
  });

  it("keeps the change on screen when saving fails, flags it, and clears the flag on the next success", async () => {
    mocks.saveLayers.mockRejectedValueOnce(new Error("offline"));
    const { result } = setup();
    await act(async () => result.current[1]({ ...DEFAULT_LAYERS, english: true }));
    expect(result.current[0].english).toBe(true);
    expect(result.current[2]).toBe(true);

    await act(async () => result.current[1]({ ...DEFAULT_LAYERS, english: true, tashkeel: false }));
    expect(mocks.saveLayers).toHaveBeenLastCalledWith({
      languageCode: "arz",
      layers: { script: true, tashkeel: false, transliteration: true, english: true },
    });
    expect(result.current[2]).toBe(false);
  });

  it("treats a refused save as a failure too", async () => {
    mocks.saveLayers.mockResolvedValueOnce({ ok: false, code: "no-profile" });
    const { result } = setup();
    await act(async () => result.current[1]({ ...DEFAULT_LAYERS, english: true }));
    expect(result.current[2]).toBe(true);
  });
});

describe("useAccountAnswer", () => {
  const setup = (initial?: "mostly") => renderHook(() => useAccountAnswer({ initial, languageCode: "arz", videoSlug: "at-the-cafe" }));

  it("starts from the account's answer, or none", () => {
    expect(setup("mostly").result.current[0]).toBe("mostly");
    expect(setup().result.current[0]).toBeUndefined();
  });

  it("shows a new answer at once and saves it, replacing the old one", async () => {
    const { result } = setup("mostly");
    await act(async () => result.current[1]("not-yet"));
    expect(result.current[0]).toBe("not-yet");
    expect(mocks.saveAnswer).toHaveBeenCalledWith({ languageCode: "arz", videoSlug: "at-the-cafe", answer: "not-yet" });
  });

  it("keeps the answer on screen and flags a failed save", async () => {
    mocks.saveAnswer.mockRejectedValueOnce(new Error("offline"));
    const { result } = setup();
    await act(async () => result.current[1]("some"));
    expect(result.current[0]).toBe("some");
    expect(result.current[2]).toBe(true);
    await act(async () => result.current[1]("mostly"));
    expect(result.current[2]).toBe(false);
  });
});

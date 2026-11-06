import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ importDevicePreferences: vi.fn() }));
vi.mock("@/lib/learner/preference-actions", () => ({ importDevicePreferences: mocks.importDevicePreferences }));

import { DeviceImport } from "@/components/shell/DeviceImport";
import { clearDeviceChoices } from "@/lib/player/device-import";
import { layersKey, resetStoredMemory, understoodKey, writeStored } from "@/lib/player/preferences";

const languages = [
  { slug: "arabic-egyptian", code: "arz" },
  { slug: "spanish", code: "es" },
];
const layers = { script: true, tashkeel: false, transliteration: true, english: true };

beforeEach(() => {
  mocks.importDevicePreferences.mockReset();
  window.localStorage.clear();
  resetStoredMemory();
});
afterEach(cleanup);

const stored = (key: string) => window.localStorage.getItem(key);

describe("DeviceImport", () => {
  it("does nothing when the device holds no choices", async () => {
    render(<DeviceImport languages={languages} />);
    await Promise.resolve();
    expect(mocks.importDevicePreferences).not.toHaveBeenCalled();
  });

  it("sends the device choices once and removes the ones that moved", async () => {
    writeStored(layersKey("arabic-egyptian"), layers);
    writeStored(understoodKey("arabic-egyptian", "at-the-cafe"), "mostly");
    mocks.importDevicePreferences.mockResolvedValue({
      ok: true,
      imported: { layers: 1, answers: 1 },
      remove: { layers: ["arz"], answers: [{ languageCode: "arz", videoSlug: "at-the-cafe" }] },
    });
    render(<DeviceImport languages={languages} />);
    await waitFor(() => expect(stored(layersKey("arabic-egyptian"))).toBeNull());
    expect(mocks.importDevicePreferences).toHaveBeenCalledTimes(1);
    expect(mocks.importDevicePreferences).toHaveBeenCalledWith({
      layers: { arz: layers },
      answers: { arz: { "at-the-cafe": "mostly" } },
    });
    expect(stored(understoodKey("arabic-egyptian", "at-the-cafe"))).toBeNull();
  });

  it("keeps a choice the account could not take yet (no profile for that language)", async () => {
    writeStored(layersKey("arabic-egyptian"), layers);
    writeStored(layersKey("spanish"), layers);
    mocks.importDevicePreferences.mockResolvedValue({
      ok: true,
      imported: { layers: 1, answers: 0 },
      remove: { layers: ["arz"], answers: [] },
    });
    render(<DeviceImport languages={languages} />);
    await waitFor(() => expect(stored(layersKey("arabic-egyptian"))).toBeNull());
    expect(stored(layersKey("spanish"))).not.toBeNull();
  });

  it("keeps everything on the device when the import fails, so the next load tries again", async () => {
    writeStored(layersKey("arabic-egyptian"), layers);
    mocks.importDevicePreferences.mockRejectedValue(new Error("offline"));
    render(<DeviceImport languages={languages} />);
    await waitFor(() => expect(mocks.importDevicePreferences).toHaveBeenCalled());
    await Promise.resolve();
    expect(stored(layersKey("arabic-egyptian"))).not.toBeNull();

    cleanup();
    mocks.importDevicePreferences.mockResolvedValue({
      ok: true,
      imported: { layers: 1, answers: 0 },
      remove: { layers: ["arz"], answers: [] },
    });
    render(<DeviceImport languages={languages} />);
    await waitFor(() => expect(stored(layersKey("arabic-egyptian"))).toBeNull());
  });

  it("keeps everything when the server refuses the import", async () => {
    writeStored(layersKey("arabic-egyptian"), layers);
    mocks.importDevicePreferences.mockResolvedValue({ ok: false, code: "invalid" });
    render(<DeviceImport languages={languages} />);
    await waitFor(() => expect(mocks.importDevicePreferences).toHaveBeenCalled());
    await Promise.resolve();
    expect(stored(layersKey("arabic-egyptian"))).not.toBeNull();
  });

  it("calls the server only once even when rendered twice", async () => {
    writeStored(layersKey("arabic-egyptian"), layers);
    mocks.importDevicePreferences.mockResolvedValue({ ok: true, imported: { layers: 0, answers: 0 }, remove: { layers: [], answers: [] } });
    const { rerender } = render(<DeviceImport languages={languages} />);
    rerender(<DeviceImport languages={languages} />);
    await waitFor(() => expect(mocks.importDevicePreferences).toHaveBeenCalledTimes(1));
  });
});

describe("privacy on a shared device (FR-031, Story 6 scenario 5)", () => {
  it("after a sign-out a second learner signing in receives nothing, including choices that could not be moved", async () => {
    // The first learner has choices for a language they have no profile for; the import keeps them.
    writeStored(layersKey("spanish"), layers);
    writeStored(understoodKey("spanish", "hola"), "some");
    mocks.importDevicePreferences.mockResolvedValue({
      ok: true,
      imported: { layers: 0, answers: 0 },
      remove: { layers: [], answers: [] },
    });
    render(<DeviceImport languages={languages} />);
    await waitFor(() => expect(mocks.importDevicePreferences).toHaveBeenCalledTimes(1));
    expect(stored(layersKey("spanish"))).not.toBeNull(); // still on the device while signed in

    // The first learner signs out: the account menu clears everything.
    clearDeviceChoices();
    cleanup();

    // A second learner signs in on the same device: there is nothing left to import.
    mocks.importDevicePreferences.mockClear();
    render(<DeviceImport languages={languages} />);
    await Promise.resolve();
    expect(mocks.importDevicePreferences).not.toHaveBeenCalled();
    expect(window.localStorage.length).toBe(0);
  });
});

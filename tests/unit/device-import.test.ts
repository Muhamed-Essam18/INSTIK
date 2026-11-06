import { beforeEach, describe, expect, it } from "vitest";
import {
  clearDeviceChoices,
  collectDeviceChoices,
  mergeDeviceChoices,
  removeDeviceKeys,
  type MergeInput,
} from "@/lib/player/device-import";
import { layersKey, resetStoredMemory, understoodKey, writeStored } from "@/lib/player/preferences";

const languages = {
  arz: { layers: ["script", "tashkeel", "transliteration", "english"], videos: ["at-the-cafe", "my-family"] },
  es: { layers: ["script", "english"], videos: ["hola"] },
};

const input = (over: Partial<MergeInput> = {}): MergeInput => ({
  device: { layers: {}, answers: {} },
  profiles: ["arz"],
  accountLayers: new Set(),
  accountAnswers: new Set(),
  languages,
  ...over,
});

describe("mergeDeviceChoices: layers", () => {
  it("takes the device value where the account has none", () => {
    const r = mergeDeviceChoices(input({ device: { layers: { arz: { english: true, tashkeel: false } }, answers: {} } }));
    expect(r.save.layers).toEqual({ arz: { english: true, tashkeel: false } });
    expect(r.remove.layers).toEqual(["arz"]);
  });

  it("lets the account win and still clears the device copy", () => {
    const r = mergeDeviceChoices(
      input({ accountLayers: new Set(["arz"]), device: { layers: { arz: { english: true } }, answers: {} } }),
    );
    expect(r.save.layers).toEqual({});
    expect(r.remove.layers).toEqual(["arz"]);
  });

  it("keeps values for a language with no profile on the device for now", () => {
    const r = mergeDeviceChoices(input({ profiles: [], device: { layers: { arz: { english: true } }, answers: {} } }));
    expect(r.save.layers).toEqual({});
    expect(r.remove.layers).toEqual([]);
    expect(r.keep.layers).toEqual(["arz"]);
  });

  it("drops layer names the language does not use and values that are not true or false", () => {
    const r = mergeDeviceChoices(
      input({
        profiles: ["es"],
        device: { layers: { es: { script: false, tashkeel: true, english: "yes" as unknown as boolean } }, answers: {} },
      }),
    );
    expect(r.save.layers).toEqual({ es: { script: false } });
  });

  it("drops a language the product does not know", () => {
    const r = mergeDeviceChoices(input({ device: { layers: { zz: { english: true } }, answers: {} } }));
    expect(r.save.layers).toEqual({});
    expect(r.remove.layers).toEqual(["zz"]);
  });

  it("removes a device copy with nothing valid in it", () => {
    const r = mergeDeviceChoices(input({ device: { layers: { arz: {} } , answers: {} } }));
    expect(r.save.layers).toEqual({});
    expect(r.remove.layers).toEqual(["arz"]);
  });
});

describe("mergeDeviceChoices: answers", () => {
  it("imports a device answer where the account has none", () => {
    const r = mergeDeviceChoices(input({ device: { layers: {}, answers: { arz: { "at-the-cafe": "mostly" } } } }));
    expect(r.save.answers).toEqual([{ languageCode: "arz", videoSlug: "at-the-cafe", answer: "mostly" }]);
    expect(r.remove.answers).toEqual([{ languageCode: "arz", videoSlug: "at-the-cafe" }]);
  });

  it("lets an existing account answer win without deleting anything from the account", () => {
    const r = mergeDeviceChoices(
      input({
        accountAnswers: new Set(["arz:at-the-cafe"]),
        device: { layers: {}, answers: { arz: { "at-the-cafe": "not-yet", "my-family": "some" } } },
      }),
    );
    expect(r.save.answers).toEqual([{ languageCode: "arz", videoSlug: "my-family", answer: "some" }]);
    expect(r.remove.answers).toEqual([
      { languageCode: "arz", videoSlug: "at-the-cafe" },
      { languageCode: "arz", videoSlug: "my-family" },
    ]);
  });

  it("keeps answers for a language with no profile", () => {
    const r = mergeDeviceChoices(input({ profiles: [], device: { layers: {}, answers: { arz: { "at-the-cafe": "some" } } } }));
    expect(r.save.answers).toEqual([]);
    expect(r.keep.answers).toEqual([{ languageCode: "arz", videoSlug: "at-the-cafe" }]);
    expect(r.remove.answers).toEqual([]);
  });

  it("drops unknown videos and invalid answers", () => {
    const r = mergeDeviceChoices(
      input({
        device: { layers: {}, answers: { arz: { nope: "mostly", "my-family": "perfect" as never } } },
      }),
    );
    expect(r.save.answers).toEqual([]);
    expect(r.remove.answers).toEqual([
      { languageCode: "arz", videoSlug: "nope" },
      { languageCode: "arz", videoSlug: "my-family" },
    ]);
  });

  it("gives the same result when run twice", () => {
    const args = input({
      device: { layers: { arz: { english: true } }, answers: { arz: { "at-the-cafe": "mostly" } } },
    });
    expect(mergeDeviceChoices(args)).toEqual(mergeDeviceChoices(args));
  });
});

describe("device storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetStoredMemory();
  });

  const all = [
    { slug: "arabic-egyptian", code: "arz" },
    { slug: "spanish", code: "es" },
  ];

  it("collects the old layer and answer keys, keyed by language code", () => {
    writeStored(layersKey("arabic-egyptian"), { script: true, tashkeel: false, transliteration: true, english: true });
    writeStored(understoodKey("arabic-egyptian", "at-the-cafe"), "mostly");
    writeStored(understoodKey("spanish", "hola"), "some");
    writeStored("instik:v1:autoplay", true);
    const device = collectDeviceChoices(all);
    expect(device.layers).toEqual({
      arz: { script: true, tashkeel: false, transliteration: true, english: true },
    });
    expect(device.answers).toEqual({ arz: { "at-the-cafe": "mostly" }, es: { hola: "some" } });
  });

  it("ignores corrupt values, unknown languages and unrelated keys", () => {
    window.localStorage.setItem(layersKey("arabic-egyptian"), "{broken");
    window.localStorage.setItem(understoodKey("arabic-egyptian", "x"), JSON.stringify("perfect"));
    window.localStorage.setItem(understoodKey("klingon", "x"), JSON.stringify("some"));
    window.localStorage.setItem("something-else", "1");
    expect(collectDeviceChoices(all)).toEqual({ layers: {}, answers: {} });
  });

  it("removes exactly the named keys", () => {
    writeStored(layersKey("arabic-egyptian"), { script: true, tashkeel: true, transliteration: true, english: false });
    writeStored(understoodKey("arabic-egyptian", "at-the-cafe"), "mostly");
    writeStored(understoodKey("arabic-egyptian", "my-family"), "some");
    removeDeviceKeys(all, {
      layers: ["arz"],
      answers: [{ languageCode: "arz", videoSlug: "at-the-cafe" }],
    });
    expect(window.localStorage.getItem(layersKey("arabic-egyptian"))).toBeNull();
    expect(window.localStorage.getItem(understoodKey("arabic-egyptian", "at-the-cafe"))).toBeNull();
    expect(window.localStorage.getItem(understoodKey("arabic-egyptian", "my-family"))).not.toBeNull();
  });
});

describe("clearDeviceChoices (sign-out)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetStoredMemory();
  });

  it("removes every layers key and every answer key, including ones kept for a language with no profile", () => {
    writeStored(layersKey("arabic-egyptian"), { script: true, tashkeel: true, transliteration: true, english: false });
    writeStored(layersKey("spanish"), { script: true, tashkeel: true, transliteration: true, english: false });
    writeStored(understoodKey("arabic-egyptian", "at-the-cafe"), "mostly");
    writeStored(understoodKey("spanish", "hola"), "some");
    clearDeviceChoices();
    expect(window.localStorage.length).toBe(0);
  });

  it("leaves unrelated keys untouched", () => {
    writeStored("instik:v1:autoplay", true);
    writeStored(layersKey("arabic-egyptian"), { script: true, tashkeel: true, transliteration: true, english: false });
    window.localStorage.setItem("other-site-data", "keep");
    clearDeviceChoices();
    expect(window.localStorage.getItem("instik:v1:autoplay")).toBe("true");
    expect(window.localStorage.getItem("other-site-data")).toBe("keep");
    expect(window.localStorage.getItem(layersKey("arabic-egyptian"))).toBeNull();
  });

  it("does not throw when storage is unavailable", () => {
    const original = Object.getOwnPropertyDescriptor(window, "localStorage")!;
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("blocked");
      },
    });
    expect(() => clearDeviceChoices()).not.toThrow();
    Object.defineProperty(window, "localStorage", original);
  });
});

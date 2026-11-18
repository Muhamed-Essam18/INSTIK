import { describe, expect, it } from "vitest";
import { findExisting, glossaryKey, markLinked, newEntryKey, type GlossaryRow } from "@/lib/review/glossary";
import { ForbiddenError } from "@/lib/roles/forbidden";
import { creatorActor, learnerActor, owner, setupReview, video } from "../../helpers/review-memory";

const donya: GlossaryRow = { id: "g1", entryKey: "donya", word: "دُنْيا", base: "دنيا", transliteration: "donya", english: "world" };

describe("markLinked", () => {
  it("marks matched words with their entry, whatever the tashkeel", () => {
    const { segments, entries } = markLinked("الدنيا حلوة دُنْيا", [donya]);
    expect(segments.filter((s) => s.entryId).map((s) => s.text)).toEqual(["دُنْيا"]);
    expect(Object.keys(entries)).toEqual(["donya"]);
    expect(segments.map((s) => s.text).join("")).toBe("الدنيا حلوة دُنْيا");
  });
  it("returns nothing marked when nothing matches", () => {
    expect(markLinked("كلام", [donya]).entries).toEqual({});
  });
});

describe("keys", () => {
  it("strips tashkeel for the key and finds the existing entry", () => {
    expect(glossaryKey("دُنْيا")).toBe("دنيا");
    expect(findExisting("دنيا", [donya])).toBe(donya);
    expect(findExisting("شمس", [donya])).toBeUndefined();
  });
  it("generates an entry key that is not already taken", () => {
    const answers = ["a", "a", "b"];
    expect(newEntryKey([{ ...donya, entryKey: "owner-a" }], () => answers.shift()!)).toBe("owner-b");
  });
});

describe("addGlossaryEntry", () => {
  const add = { videoId: "v1", word: "شَمْس", transliteration: "shams", english: "sun" };

  it("adds a word the glossary does not have, with a generated unique key", async () => {
    const t = setupReview({ videos: [video({ id: "v1" })], glossary: [donya] });
    const r = await t.service.addGlossaryEntry(owner, add);
    expect(r.ok && r.entry).toMatchObject({ word: "شَمْس", transliteration: "shams", english: "sun" });
    expect(r.ok && r.entry.entryKey).toMatch(/^owner-/);
    expect(t.state.glossary).toHaveLength(2);
  });

  it("refuses a word whose tashkeel-stripped key already exists and returns the existing entry", async () => {
    const t = setupReview({ videos: [video({ id: "v1" })], glossary: [donya] });
    const r = await t.service.addGlossaryEntry(owner, { ...add, word: "دنيا" });
    expect(r).toMatchObject({ ok: false, reason: "exists", entry: { id: "g1" } });
    expect(t.state.glossary).toHaveLength(1);
  });

  it("refuses empty or oversized input", async () => {
    const t = setupReview({ videos: [video({ id: "v1" })] });
    expect(await t.service.addGlossaryEntry(owner, { ...add, english: " " })).toMatchObject({ ok: false, reason: "invalid" });
    expect(await t.service.addGlossaryEntry(owner, { ...add, word: "ا".repeat(101) })).toMatchObject({ ok: false, reason: "invalid" });
    expect(t.state.glossary).toHaveLength(0);
  });
});

describe("updateGlossaryEntry", () => {
  it("corrects only the transliteration and the English", async () => {
    const t = setupReview({ videos: [video({ id: "v1" })], glossary: [donya] });
    expect(await t.service.updateGlossaryEntry(owner, { videoId: "v1", entryId: "g1", transliteration: "dunya", english: "life" })).toEqual({ ok: true });
    expect(t.state.glossary[0]).toMatchObject({ word: "دُنْيا", base: "دنيا", entryKey: "donya", transliteration: "dunya", english: "life" });
  });
  it("says so when the entry does not exist", async () => {
    const t = setupReview({ videos: [video({ id: "v1" })] });
    expect(await t.service.updateGlossaryEntry(owner, { videoId: "v1", entryId: "zzz", transliteration: "a", english: "b" })).toMatchObject({ ok: false, reason: "no-entry" });
  });
});

describe("a creator is refused", () => {
  it("for add and update", async () => {
    const t = setupReview({ videos: [video({ id: "v1" })], glossary: [donya] });
    for (const actor of [creatorActor, learnerActor]) {
      await expect(t.service.addGlossaryEntry(actor, { videoId: "v1", word: "شمس", transliteration: "s", english: "sun" })).rejects.toBeInstanceOf(ForbiddenError);
      await expect(t.service.updateGlossaryEntry(actor, { videoId: "v1", entryId: "g1", transliteration: "s", english: "sun" })).rejects.toBeInstanceOf(ForbiddenError);
    }
    expect(t.state.glossary).toHaveLength(1);
  });
});

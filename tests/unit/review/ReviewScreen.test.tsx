import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReviewWorkspace } from "@/components/owner/ReviewWorkspace";
import type { SegmentView } from "@/lib/review/service";

const nav = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => nav }));
const actions = vi.hoisted(() => ({
  setChecklist: vi.fn(),
  setClassification: vi.fn(),
  saveSegment: vi.fn(),
  deleteSegment: vi.fn(),
  previewVtt: vi.fn(),
  importVtt: vi.fn(),
  addGlossaryEntry: vi.fn(),
  updateGlossaryEntry: vi.fn(),
  decide: vi.fn(),
}));
vi.mock("@/lib/review/actions", () => actions);

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  nav.refresh.mockClear();
  for (const fn of Object.values(actions)) fn.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const ticked = { stageFits: true, audio: true, realPeople: true, safe: true, transcript: true };
const none = { stageFits: false, audio: false, realPeople: false, safe: false, transcript: false };
const seg = (extra: Partial<SegmentView> & Pick<SegmentView, "id">): SegmentView => ({
  position: 1,
  start: 4,
  end: 11,
  script: "الدُّنْيا بِتْمَطَّر",
  transliteration: "id-donya",
  english: "It's raining",
  revision: 0,
  links: [],
  ...extra,
});

const renderIt = (extra: Partial<Parameters<typeof ReviewWorkspace>[0]> = {}) =>
  render(
    <ReviewWorkspace
      videoId="v1"
      player={<div>player</div>}
      checks={none}
      stage="hear-it"
      access="FULL"
      segments={[]}
      entries={{}}
      lang="arz"
      dir="rtl"
      scriptLabel="Egyptian Arabic, with tashkeel"
      creatorName="Salma"
      readOnly={false}
      {...extra}
    />,
  );

const typeInto = (name: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(name), { target: { value } });

describe("the review workspace", () => {
  it("shows the five checklist items from the design, and the stage pre-filled from the proposal", () => {
    renderIt({ stage: "follow-it" });
    expect(screen.getAllByRole("checkbox")).toHaveLength(5);
    for (const text of [/The stage fits/, /Clear audio, no background music/, /A real person, real place/, /Nothing unsafe, offensive or off-brand/, /Transcript written and checked/]) {
      expect(screen.getByText(text)).toBeTruthy();
    }
    expect((screen.getByLabelText("Stage") as HTMLSelectElement).value).toBe("follow-it");
    expect((screen.getByLabelText(/Access/) as HTMLSelectElement).value).toBe("FULL");
    expect(screen.getByText("Instik decides")).toBeTruthy();
  });

  it("saves a tick and says Saved", async () => {
    actions.setChecklist.mockResolvedValue({ ok: true });
    renderIt();
    fireEvent.click(screen.getByLabelText(/Clear audio/));
    await waitFor(() => expect(actions.setChecklist).toHaveBeenCalledWith({ videoId: "v1", key: "audio", checked: true }));
    await waitFor(() => expect(screen.getAllByText("Saved").length).toBeGreaterThan(0));
  });

  it("undoes a tick that did not save, with a plain message", async () => {
    actions.setChecklist.mockResolvedValue({ ok: false, kind: "not-in-review", message: "This video isn't waiting for review any more." });
    renderIt();
    fireEvent.click(screen.getByLabelText(/Clear audio/));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/isn't waiting for review/));
    expect((screen.getByLabelText(/Clear audio/) as HTMLInputElement).checked).toBe(false);
  });

  it("saves stage and access on change", async () => {
    actions.setClassification.mockResolvedValue({ ok: true });
    renderIt();
    fireEvent.change(screen.getByLabelText("Stage"), { target: { value: "join-in" } });
    await waitFor(() => expect(actions.setClassification).toHaveBeenCalledWith({ videoId: "v1", stage: "join-in", access: "FULL" }));
    fireEvent.change(screen.getByLabelText(/Access/), { target: { value: "FREE" } });
    await waitFor(() => expect(actions.setClassification).toHaveBeenLastCalledWith({ videoId: "v1", stage: "join-in", access: "FREE" }));
  });

  it("Arabic inputs carry dir=rtl and lang=arz, and every control is labelled and 44px or more", () => {
    renderIt({ segments: [seg({ id: "s1" })] });
    const arabic = screen.getByLabelText("Egyptian Arabic, with tashkeel");
    expect(arabic.getAttribute("dir")).toBe("rtl");
    expect(arabic.getAttribute("lang")).toBe("arz");
    for (const control of [...screen.getAllByRole("button"), ...screen.getAllByRole("checkbox")]) {
      const name = control.getAttribute("aria-label") || control.textContent || control.closest("label")?.textContent;
      expect(name?.trim(), control.outerHTML).toBeTruthy();
    }
    for (const input of screen.getAllByRole("textbox")) expect(input.getAttribute("aria-label") ?? input.closest("label"), input.outerHTML).toBeTruthy();
    for (const button of screen.getAllByRole("button")) expect(button.className, button.textContent ?? "").toMatch(/min-h-11|h-\[44px\]/);
  });
});

describe("autosave of a segment", () => {
  it("shows Not saved yet at once, then Saved after the save, sending the revision it started from", async () => {
    actions.saveSegment.mockResolvedValue({ ok: true, segment: seg({ id: "s1", revision: 1, english: "Raining" }), entries: {} });
    renderIt({ segments: [seg({ id: "s1" })] });
    typeInto("English", "Raining");
    expect(screen.getByText("Not saved yet")).toBeTruthy();
    expect(actions.saveSegment).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });
    expect(actions.saveSegment).toHaveBeenCalledWith(expect.objectContaining({ videoId: "v1", segmentId: "s1", revision: 0, start: 4, end: 11, english: "Raining" }));
    await waitFor(() => expect(screen.getAllByText("Saved").length).toBeGreaterThan(0));
  });

  it("does not save an invalid segment and says why, calmly", async () => {
    renderIt({ segments: [seg({ id: "s1" })] });
    typeInto("End of segment 1", "0:02");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });
    expect(actions.saveSegment).not.toHaveBeenCalled();
    expect(screen.getByText("The start needs to come before the end.")).toBeTruthy();
    expect(screen.getByText("Not saved yet")).toBeTruthy();
  });

  it("shows a conflict message with a reload button that refreshes the data", async () => {
    actions.saveSegment.mockResolvedValue({ ok: false, kind: "conflict", message: "Someone else changed this just now. Reload this segment to see their version." });
    renderIt({ segments: [seg({ id: "s1" })] });
    typeInto("English", "Mine");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/Someone else changed this/));
    fireEvent.click(screen.getByRole("button", { name: "Reload this segment" }));
    expect(nav.refresh).toHaveBeenCalled();
  });

  it("adds a new segment after the last one and saves it once it is valid", async () => {
    actions.saveSegment.mockResolvedValue({ ok: true, segment: seg({ id: "new1", start: 11, end: 14, script: "كلام" }), entries: {} });
    renderIt({ segments: [seg({ id: "s1" })] });
    fireEvent.click(screen.getByRole("button", { name: "Add segment" }));
    expect(screen.getByText("Segment 2", { exact: false })).toBeTruthy();
    const inputs = screen.getAllByLabelText("Egyptian Arabic, with tashkeel");
    fireEvent.change(inputs[1], { target: { value: "كلام" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });
    expect(actions.saveSegment).toHaveBeenCalledWith(expect.objectContaining({ segmentId: undefined, start: 11, end: 14, script: "كلام" }));
  });
});

describe("the no-tashkeel reminder", () => {
  it("shows for a bare script, goes away with tashkeel, and never blocks saving", async () => {
    actions.saveSegment.mockResolvedValue({ ok: true, segment: seg({ id: "s1", revision: 1, script: "الدنيا بتمطر" }), entries: {} });
    renderIt({ segments: [seg({ id: "s1", script: "الدنيا بتمطر" })] });
    expect(screen.getByText("Add the vowel marks if you can. Learners rely on them.")).toBeTruthy();
    typeInto("Egyptian Arabic, with tashkeel", "الدُّنْيا بِتْمَطَّر");
    expect(screen.queryByText(/Add the vowel marks/)).toBeNull();
    typeInto("Egyptian Arabic, with tashkeel", "الدنيا");
    expect(screen.getByText(/Add the vowel marks/)).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });
    expect(actions.saveSegment).toHaveBeenCalledWith(expect.objectContaining({ script: "الدنيا" }));
  });
});

describe("words and the glossary", () => {
  it("offers a saved segment's words, marks matched ones, and adds an unmatched one", async () => {
    actions.addGlossaryEntry.mockResolvedValue({
      ok: true,
      entry: { id: "g2", entryKey: "owner-x", word: "بِتْمَطَّر", base: "بِتْمَطَّر", transliteration: "bitmattar", english: "it rains" },
    });
    const entries = { donya: { id: "g1", entryKey: "donya", word: "الدُّنْيا", base: "دنيا", transliteration: "donya", english: "world" } };
    renderIt({ segments: [seg({ id: "s1" })], entries });
    expect(screen.getByRole("button", { name: /Glossary word: الدُّنْيا/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Add to glossary: بِتْمَطَّر/ }));
    const form = screen.getByRole("form", { name: /Add .* to the glossary/ });
    const [translit, english] = Array.from(form.querySelectorAll("input"));
    fireEvent.change(translit, { target: { value: "bitmattar" } });
    fireEvent.change(english, { target: { value: "it rains" } });
    fireEvent.click(screen.getByRole("button", { name: "Add to glossary" }));
    await waitFor(() => expect(actions.addGlossaryEntry).toHaveBeenCalledWith({ videoId: "v1", word: "بِتْمَطَّر", transliteration: "bitmattar", english: "it rains" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Glossary word: بِتْمَطَّر/ })).toBeTruthy());
  });

  it("shows the existing entry when the word is already there", async () => {
    actions.addGlossaryEntry.mockResolvedValue({
      ok: false,
      kind: "exists",
      message: "That word is already in the glossary.",
      entry: { id: "g9", entryKey: "k", word: "بتمطر", base: "بتمطر", transliteration: "bitmattar", english: "it rains" },
    });
    renderIt({ segments: [seg({ id: "s1" })] });
    fireEvent.click(screen.getByRole("button", { name: /Add to glossary: بِتْمَطَّر/ }));
    const form = screen.getByRole("form", { name: /Add .* to the glossary/ });
    const [translit, english] = Array.from(form.querySelectorAll("input"));
    fireEvent.change(translit, { target: { value: "x" } });
    fireEvent.change(english, { target: { value: "y" } });
    fireEvent.click(screen.getByRole("button", { name: "Add to glossary" }));
    await waitFor(() => expect(screen.getByText("That word is already in the glossary.")).toBeTruthy());
  });
});

describe("the decision bar in the workspace", () => {
  it("keeps Approve disabled until everything is ticked and a segment exists, with the reason beside it", () => {
    renderIt({ segments: [seg({ id: "s1" })], checks: { ...ticked, transcript: false } });
    const approve = screen.getByRole("button", { name: "Approve and publish" }) as HTMLButtonElement;
    expect(approve.disabled).toBe(true);
    expect(document.getElementById(approve.getAttribute("aria-describedby")!)?.textContent).toMatch(/Approve unlocks when every checklist item is ticked/);
  });

  it("enables Approve when all are ticked and a segment exists, and not without a segment", () => {
    renderIt({ segments: [seg({ id: "s1" })], checks: ticked });
    expect((screen.getByRole("button", { name: "Approve and publish" }) as HTMLButtonElement).disabled).toBe(false);
    cleanup();
    renderIt({ segments: [], checks: ticked });
    expect((screen.getByRole("button", { name: "Approve and publish" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("is read-only for a video waiting on its creator: no decision bar, every control off", () => {
    renderIt({ segments: [seg({ id: "s1" })], checks: ticked, readOnly: true, readOnlyNote: <p>Waiting on Salma.</p> });
    expect(screen.queryByRole("button", { name: "Approve and publish" })).toBeNull();
    expect(screen.getByText("Waiting on Salma.")).toBeTruthy();
    for (const box of screen.getAllByRole("checkbox")) expect((box as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText("Stage") as HTMLSelectElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Add segment" })).toBeNull();
  });
});

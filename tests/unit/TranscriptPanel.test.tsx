import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Profiler, useEffect } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Layers } from "@/lib/player/preferences";
import { PlaybackProvider, usePlayback } from "@/components/player/PlaybackProvider";
import { TranscriptPanel } from "@/components/transcript/TranscriptPanel";
import type { TranscriptView } from "@/lib/content/transcript";
import { getLanguageBySlug } from "@/lib/languages";
import { FakeMedia } from "../helpers/fake-media";

vi.mock("next/navigation", () => import("../helpers/next-navigation"));

const actions = vi.hoisted(() => ({ saveLayers: vi.fn() }));
vi.mock("@/lib/learner/preference-actions", () => ({ saveLayers: actions.saveLayers, saveAnswer: vi.fn() }));

const language = getLanguageBySlug("arabic-egyptian")!;

const view: TranscriptView = {
  lines: [
    { start: 2, end: 4, segments: [{ text: "صَباح الخَيْر!" }], transliteration: "ṣabāḥ el-khēr!", english: "Good morning!" },
    { start: 5, end: 8, segments: [{ text: "قَهْوَة سُخْنَة." }], transliteration: "ahwa sokhna.", english: "Hot coffee." },
    { start: 9.5, end: 12, segments: [{ text: "شُكْرًا." }], transliteration: "shukran.", english: "Thank you." },
  ],
  entries: {},
};

function Registrar({ media }: { media: FakeMedia }) {
  const { setMedia } = usePlayback();
  useEffect(() => {
    setMedia(media);
  }, [media, setMedia]);
  return null;
}

function setup(
  media = new FakeMedia(),
  transcript: TranscriptView | null = view,
  onRender?: () => void,
  initialLayers?: Layers,
) {
  const panel = <TranscriptPanel language={language} view={transcript ?? undefined} initialLayers={initialLayers} />;
  render(
    <PlaybackProvider>
      <Registrar media={media} />
      {onRender ? (
        <Profiler id="panel" onRender={onRender}>
          {panel}
        </Profiler>
      ) : (
        panel
      )}
    </PlaybackProvider>,
  );
  return media;
}

const rows = () => screen.getAllByRole("listitem");
const currentRows = () => rows().filter((row) => row.getAttribute("aria-current") === "true");

let scrollTo: ReturnType<typeof vi.fn>;
beforeEach(() => {
  actions.saveLayers.mockReset();
  actions.saveLayers.mockResolvedValue({ ok: true });
  scrollTo = vi.fn();
  Element.prototype.scrollTo = scrollTo as unknown as typeof Element.prototype.scrollTo;
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
});
afterEach(cleanup);

describe("TranscriptPanel highlight", () => {
  it("highlights the line whose start has been reached, and only that one", async () => {
    const media = setup();
    expect(currentRows()).toHaveLength(0); // before the first line
    await act(async () => media.tick(2));
    expect(currentRows()).toEqual([rows()[0]]);
    await act(async () => media.tick(5.4));
    expect(currentRows()).toEqual([rows()[1]]);
  });

  it("follows seeking by any means", async () => {
    const media = setup();
    await act(async () => media.seek(10));
    expect(currentRows()).toEqual([rows()[2]]);
    await act(async () => media.seek(0));
    expect(currentRows()).toHaveLength(0);
  });

  it("keeps the last line highlighted after the end, and the previous one through a gap", async () => {
    const media = setup();
    await act(async () => media.tick(8.5));
    expect(currentRows()).toEqual([rows()[1]]);
    await act(async () => media.tick(500));
    expect(currentRows()).toEqual([rows()[2]]);
  });

  it("only re-renders when the current line changes", async () => {
    const onRender = vi.fn();
    const media = setup(new FakeMedia(), view, onRender);
    await act(async () => media.tick(2.1));
    const after = onRender.mock.calls.length;
    await act(async () => {
      media.tick(2.5);
      media.tick(3.2);
      media.tick(3.9);
    });
    expect(onRender.mock.calls.length).toBe(after);
    await act(async () => media.tick(5.1));
    expect(onRender.mock.calls.length).toBeGreaterThan(after);
  });
});

describe("TranscriptPanel jumping", () => {
  it("clicking a line (its text) seeks to its start and keeps the paused state", async () => {
    const media = setup();
    media.paused = true;
    await act(async () => fireEvent.click(screen.getByText("قَهْوَة سُخْنَة.")));
    expect(media.currentTime).toBe(5);
    expect(media.paused).toBe(true);
    expect(media.play).not.toHaveBeenCalled();
  });

  it("has a real button per line that seeks (keyboard and screen reader route)", async () => {
    const media = setup();
    const button = within(rows()[2]).getByRole("button", { name: /0:09/ });
    await act(async () => fireEvent.click(button));
    expect(media.currentTime).toBe(9.5);
  });

  it("marks the new line as current after a jump", async () => {
    const media = setup();
    await act(async () => {
      fireEvent.click(within(rows()[1]).getByRole("button", { name: /0:05/ }));
      media.seek(media.currentTime);
    });
    expect(currentRows()).toEqual([rows()[1]]);
  });
});

describe("TranscriptPanel scrolling", () => {
  it("scrolls the list container, never the window, smoothly by default", async () => {
    const windowScroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const media = setup();
    await act(async () => media.tick(5));
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo.mock.calls[0][0]).toMatchObject({ behavior: "smooth" });
    expect(windowScroll).not.toHaveBeenCalled();
  });

  it("scrolls instantly when the learner prefers reduced motion", async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    const media = setup();
    await act(async () => media.tick(5));
    expect(scrollTo.mock.calls[0][0]).toMatchObject({ behavior: "auto" });
  });
});

describe("TranscriptPanel content", () => {
  it("shows a note when there is no transcript, without lines or toggles", () => {
    setup(new FakeMedia(), null);
    expect(screen.getByText("The transcript is on its way.")).toBeTruthy();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.queryByRole("group", { name: "Show in transcript" })).toBeNull();
  });

  it("marks the Arabic as right-to-left Arabic, and the other layers as left-to-right", () => {
    setup();
    const arabic = screen.getByText("صَباح الخَيْر!");
    expect(arabic.getAttribute("dir")).toBe("rtl");
    expect(arabic.getAttribute("lang")).toBe("arz");
    expect(screen.getByText("ṣabāḥ el-khēr!").getAttribute("dir")).toBe("ltr");
  });
});

describe("TranscriptPanel layers", () => {
  const toggle = (name: string) => fireEvent.click(screen.getByRole("button", { name }));

  it("starts with the defaults: Arabic with tashkeel and transliteration on, English off", () => {
    setup();
    expect(screen.getByText("صَباح الخَيْر!")).toBeTruthy();
    expect(screen.getByText("ṣabāḥ el-khēr!")).toBeTruthy();
    expect(screen.queryByText("Good morning!")).toBeNull();
  });

  it("shows English when it is switched on", async () => {
    setup();
    await act(async () => toggle("English"));
    expect(screen.getByText("Good morning!")).toBeTruthy();
  });

  it("hides vowel marks when Tashkeel is off, and brings them back", async () => {
    setup();
    await act(async () => toggle("Tashkeel"));
    expect(screen.getByText("صباح الخير!")).toBeTruthy();
    expect(screen.queryByText("صَباح الخَيْر!")).toBeNull();
    await act(async () => toggle("Tashkeel"));
    expect(screen.getByText("صَباح الخَيْر!")).toBeTruthy();
    expect(view.lines[0].segments[0].text).toBe("صَباح الخَيْر!"); // the data itself is never changed
  });

  it("hides the Arabic when Arabic is off", async () => {
    setup();
    await act(async () => toggle("Arabic"));
    expect(screen.queryByText("صَباح الخَيْر!")).toBeNull();
    expect(screen.getByText("ṣabāḥ el-khēr!")).toBeTruthy();
  });

  it("with every layer off, each line shows only its time and a hint", async () => {
    setup();
    await act(async () => toggle("Arabic"));
    await act(async () => toggle("Transliteration"));
    expect(screen.getAllByText("Switch a layer on to read along.")).toHaveLength(3);
    expect(screen.queryByText("ṣabāḥ el-khēr!")).toBeNull();
    expect(screen.getAllByRole("button", { name: /Jump to/ })).toHaveLength(3);
  });

  it("starts from the layers saved on the account", () => {
    setup(new FakeMedia(), view, undefined, { script: true, tashkeel: false, transliteration: false, english: true });
    expect(screen.getByText("Good morning!")).toBeTruthy();
    expect(screen.getByText("صباح الخير!")).toBeTruthy();
    expect(screen.queryByText("ṣabāḥ el-khēr!")).toBeNull();
  });

  it("shows the defaults when the account has no saved layers", () => {
    setup();
    expect(screen.getByText("ṣabāḥ el-khēr!")).toBeTruthy();
    expect(screen.queryByText("Good morning!")).toBeNull();
  });

  it("saves a change to the account for this language", async () => {
    setup();
    await act(async () => toggle("English"));
    expect(actions.saveLayers).toHaveBeenCalledWith({
      languageCode: "arz",
      layers: { script: true, tashkeel: true, transliteration: true, english: true },
    });
  });

  it("never touches this device's storage", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    setup();
    await act(async () => toggle("English"));
    expect(setItem).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("keeps the change on screen and shows a quiet note when saving fails, then clears it on the next save", async () => {
    actions.saveLayers.mockRejectedValueOnce(new Error("offline"));
    setup();
    await act(async () => toggle("English"));
    expect(screen.getByText("Good morning!")).toBeTruthy();
    expect(screen.getByText("Couldn't save that just now. We'll try again on your next change.")).toBeTruthy();
    await act(async () => toggle("Transliteration"));
    expect(actions.saveLayers).toHaveBeenLastCalledWith({
      languageCode: "arz",
      layers: { script: true, tashkeel: true, transliteration: false, english: true },
    });
    expect(screen.queryByText(/Couldn't save that just now/)).toBeNull();
  });

  it("server-rendered HTML shows the layers from the account", () => {
    const html = renderToString(
      <PlaybackProvider>
        <TranscriptPanel
          language={language}
          view={view}
          initialLayers={{ script: false, tashkeel: false, transliteration: false, english: true }}
        />
      </PlaybackProvider>,
    );
    expect(html).toContain("Good morning!");
    expect(html).not.toContain("ṣabāḥ el-khēr!");
  });
});

describe("TranscriptPanel words", () => {
  const wordView: TranscriptView = {
    lines: [
      {
        start: 2,
        end: 4,
        segments: [{ text: "قَهْوَة " }, { text: "سُخْنَة", entryId: "sokhna" }, { text: "." }],
        transliteration: "ahwa sokhna.",
        english: "Hot coffee.",
      },
      {
        start: 5,
        end: 8,
        segments: [{ text: "سُخْنَة", entryId: "sokhna" }, { text: " " }, { text: "سُخْنَة", entryId: "sokhna" }, { text: "؟" }],
        transliteration: "sokhna sokhna?",
        english: "Hot hot?",
      },
    ],
    entries: { sokhna: { word: "سُخْنَة", transliteration: "sokhna", english: "hot" } },
  };
  const setupWords = () => setup(new FakeMedia(), wordView);
  const wordButtons = () => screen.getAllByRole("button", { name: "سُخْنَة" });

  it("renders linked words as buttons and other words as plain text", () => {
    setupWords();
    expect(wordButtons()).toHaveLength(3);
    const plain = screen.getByText(/قَهْوَة/);
    expect(plain.closest("button")).toBeNull();
    expect(plain.getAttribute("role")).toBeNull();
  });

  it("keeps punctuation outside the word button", () => {
    setupWords();
    for (const button of wordButtons()) expect(button.textContent).toBe("سُخْنَة");
  });

  it("opens a card for a tapped word without seeking", async () => {
    const media = setupWords();
    await act(async () => fireEvent.click(wordButtons()[0]));
    const card = screen.getByRole("dialog", { name: "Word: hot" });
    expect(card).toBeTruthy();
    expect(within(card).getByText("sokhna")).toBeTruthy();
    expect(media.currentTime).toBe(0);
  });

  it("closes the card when the same word is tapped again", async () => {
    setupWords();
    await act(async () => fireEvent.click(wordButtons()[0]));
    await act(async () => fireEvent.click(wordButtons()[0]));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("replaces the card when another word is tapped, and the same word twice opens the same entry", async () => {
    setupWords();
    await act(async () => fireEvent.click(wordButtons()[1]));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    await act(async () => fireEvent.click(wordButtons()[2]));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("dialog", { name: "Word: hot" })).toBeTruthy();
  });

  it("still opens with tashkeel in the card when Tashkeel is off", async () => {
    setupWords();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Tashkeel" })));
    const stripped = screen.getAllByRole("button", { name: "سخنة" });
    expect(stripped).toHaveLength(3);
    await act(async () => fireEvent.click(stripped[0]));
    expect(within(screen.getByRole("dialog")).getByText("سُخْنَة")).toBeTruthy();
  });

  it("works from the keyboard: Escape closes and focus returns to the word", async () => {
    setupWords();
    const first = wordButtons()[0];
    first.focus();
    await act(async () => fireEvent.click(first)); // Enter and Space on a button fire click
    expect(screen.getByRole("dialog")).toBeTruthy();
    await act(async () => fireEvent.keyDown(document, { key: "Escape" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(wordButtons()[0]);
  });

  it("does not nest buttons: a word button is never inside another button", () => {
    setupWords();
    for (const button of screen.getAllByRole("button")) expect(button.parentElement?.closest("button")).toBeNull();
  });
});

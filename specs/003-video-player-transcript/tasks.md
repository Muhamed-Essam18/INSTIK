---

description: "Task list for Video Player and Interactive Transcript"
---

# Tasks: Video Player and Interactive Transcript

**Input**: Design documents from `/specs/003-video-player-transcript/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included. Constitution principle IX requires tests for core logic (transcript sync, Arabic handling, content validation) and the plan lists them. Write each test first and see it fail.

**Organization**: Grouped by user story. The transcript content format (US2) and Up next (US6) bring their own data work, so the data tasks sit inside those stories rather than in a separate phase.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: US1 Watch with simple controls (P1), US2 Interactive transcript (P1), US3 Transcript layers (P1), US4 Tap a word (P2), US5 Understanding check (P2), US6 Up next (P2)

## Path Conventions

Single Next.js app: `src/`, `tests/unit/`, `content/`, `public/`, `scripts/` at the repository root. Before writing Next.js code, read the relevant guide in `node_modules/next/dist/docs/` (AGENTS.md). Nothing in a render path may read `window`, `document`, `localStorage`, `matchMedia`, `Date` or randomness (plan research 15); browser reads go in effects or event handlers.

---

## Phase 1: Setup

- [X] T001 Confirm the baseline is green: run `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` from the repo root and note any pre-existing failure
- [X] T002 Add the Mux player: run `npm install @mux/mux-player-react` (version 3.14.1 or later; its peers allow React 19), confirm `package.json` and `package-lock.json` changed only for this package and its dependencies, and that `npm run typecheck` still passes
- [X] T003 [P] Create `scripts/make-sample-clip.mjs` that runs ffmpeg to produce `public/sample/sample-clip.mp4`: 30 seconds, 640×360, H.264 video from a generated test pattern with a visible moving element, AAC audio from a quiet generated tone, low bitrate, `-movflags +faststart`, no third-party footage and no burned-in text; document at the top of the file how to run it without installing ffmpeg globally (a throwaway `npx ffmpeg-static` copy, not added to `package.json`). Run it, commit the resulting mp4 (target under 0.5 MB), and check its duration is 30 s

---

## Phase 2: Foundational (blocks all user stories)

**Purpose**: Small pure modules, the storage hook and the playback context that several stories share

- [X] T004 [P] Extend `tests/unit/normalize.test.ts` with `stripTashkeel`: removes marks U+064B–U+065F, U+0670, U+06D6–U+06ED and tatweel U+0640, leaves letters and punctuation (including the Arabic question mark) untouched, does not fold alef/ya/ta marbuta, does not mutate input
- [X] T005 Add `stripTashkeel(text)` to `src/lib/text/normalize.ts` and make `normalizeForSearch` build on it without changing its results; make T004 and the existing normalize tests pass
- [X] T006 [P] Write failing tests in `tests/unit/format.test.ts` for `formatClock(seconds)` ("0:00", "2:14", "62:05", NaN and negative → "0:00") and `formatLength(seconds)` ("45 s", "8 min", "8 min 40 s", "1 min 1 s"); implement both in `src/lib/player/format.ts`
- [X] T007 [P] Write failing tests in `tests/unit/source.test.ts` for `resolveSource(playbackId)` in `src/lib/player/source.ts`: undefined, `""` and whitespace → `{ kind: "none" }`; ids starting with `sample-` → `{ kind: "sample", src: "/sample/sample-clip.mp4" }`; any other id → `{ kind: "mux", playbackId }`; then implement it
- [X] T008 [P] Write failing tests in `tests/unit/cue-index.test.ts` for `findCueIndex(cues, time)` in `src/lib/player/cue-index.ts`: returns the index of the last cue whose `start` is at or before `time`; `-1` before the first cue and for an empty list; the last cue stays current after its end; gaps keep the previous cue; exact start boundary is inclusive; works for 1, 2 and 500 cues; then implement it with binary search
- [X] T009 [P] Write failing tests in `tests/unit/preferences.test.ts` and implement `src/lib/player/preferences.ts`: key builders `layersKey(language)` → `instik:v1:<language>:layers`, `understoodKey(language, video)` → `instik:v1:<language>:understood:<video>`, `AUTOPLAY_KEY` = `instik:v1:autoplay`, `AUTOPLAY_NEXT_KEY` = `instik:v1:autoplay-next`; zod schemas: layers `{ script, tashkeel, transliteration, english }` all boolean, understood `"mostly" | "some" | "not-yet"`, autoplay boolean; `DEFAULT_LAYERS` = `{ script: true, tashkeel: true, transliteration: true, english: false }`; plain function `readStored(key, schema)` that returns the parsed value or `undefined` for missing, invalid JSON, wrong shape or a throwing `localStorage`; `writeStored(key, value)` that never throws
- [X] T010 Write failing tests in `tests/unit/useStoredValue.test.tsx` and implement `src/hooks/useStoredValue.ts` (`"use client"`): `useStoredValue(key, schema, defaultValue)` returns `[value, setValue, ready]`; the first render always returns `defaultValue` with `ready` false (assert with `renderToString` that server output equals the default); after mount it reads storage, applies a valid different value and sets `ready`; invalid or corrupt stored data keeps the default; `setValue` updates state and writes, but never writes before `ready`; a throwing `localStorage` leaves the in-memory value working (depends on T009)
- [X] T011 [P] Widen `src/components/TargetText.tsx`: `children` becomes `ReactNode` and an optional `className` is appended to the existing classes; extend `tests/unit/TargetText.test.tsx` for element children and the extra class; existing behaviour unchanged
- [X] T012 [P] Make `playbackId` optional in `src/lib/content/schema.ts` (when present: non-empty string; absent means the player shows its placeholder), update `tests/unit/content.schema.test.ts` (absent is valid, `""` is rejected), and add a short "amended in spec 003" note to the playback id row in `specs/002-content-and-library/data-model.md`
- [X] T013 Create `src/components/player/PlaybackProvider.tsx` (`"use client"`): a context that receives server-rendered `children` and exposes `media` (the registered element or `null`), `setMedia(element | null)` for a ref callback, and `seekTo(seconds)` (sets `currentTime`, no-op without media); define and export the minimal `PlayableMedia` interface (`currentTime`, `duration`, `paused`, `playbackRate`, `play()`, `pause()`, `addEventListener`, `removeEventListener`) that both `HTMLVideoElement` and the Mux element satisfy; add a `usePlayback()` hook that throws a clear error outside the provider; the check-focus registration and end-of-video behaviour are added in US5 and US6

**Checkpoint**: Pure helpers, storage hook, `TargetText` and the provider are ready

---

## Phase 3: User Story 1 - Watch a video with simple controls (Priority: P1) 🎯 MVP

**Goal**: A real player page: video with stage badge, working controls, title and length line, host card, and the friendly placeholder and error states.

**Independent Test**: Open `/learn/arabic-egyptian/watch/at-the-cafe`; play, pause, back 5 seconds, cycle speeds, full screen, drag the slider, follow the host card; remove a playback id and see the placeholder.

### Tests for User Story 1

- [X] T014 [P] [US1] Write failing tests in `tests/unit/PlayerControls.test.tsx` using a fake media element that implements `PlayableMedia` and emits events: Play/Pause button label flips with `play`/`pause` events and calls `play()`/`pause()`; "Back 5 seconds" sets `currentTime` to `max(0, time − 5)` (1:10 → 1:05, 0:03 → 0:00); speed button label shows the current speed and cycles 1× → 0.9× → 0.75× → 1× setting `playbackRate`; the slider is labelled, has a text value like "2:14 of 8:40", and changing it seeks; the clock shows `m:ss / m:ss`; full screen button is absent when `document.fullscreenEnabled` is false and present when true; every control is a button or slider with an accessible name
- [X] T015 [P] [US1] Write failing tests in `tests/unit/VideoPlayer.test.tsx`: a `sample-` id renders a `<video>` with `src="/sample/sample-clip.mp4"`, does not autoplay, shows a "Sample" badge and the stage badge text; an absent id renders the placeholder "This video is on its way." with no controls; a media `error` event shows the kind message and a link to the Library; the big Play button appears before playback starts and disappears once playing; the Mux branch is not rendered on the server (assert `renderToString` output has no `mux-player`) (stub `HTMLMediaElement.prototype.play`/`pause`)

### Implementation for User Story 1

- [X] T016 [US1] Create `src/components/player/PlayerControls.tsx` (`"use client"`) per `contracts/player-page.md`: Play/Pause, Back 5 seconds (icon from the design), `m:ss / m:ss` clock via `formatClock`, speed pill, full screen button, and the seek slider (`<input type="range">`, `aria-valuetext` "2:14 of 8:40"); all targets at least 44px high; coral only as a fill with ink label; full screen requested on the wrapper element, button shown only after mount when `document.fullscreenEnabled` is true; state comes from the media element's events (`play`, `pause`, `timeupdate`, `durationchange`, `ratechange`); makes T014 pass (depends on T005–T007, T013)
- [X] T017 [US1] Create `src/components/player/VideoPlayer.tsx` (`"use client"`) per `contracts/player-page.md`: 16:9 ink rounded wrapper; stage badge top right (teal pill, ink label); "Sample" badge top left for the sample source; uses `resolveSource`; sample → native `<video preload="metadata" playsInline>` registered through `setMedia`; mux → `MuxPlayer` from `@mux/mux-player-react/lazy` rendered only after mount with `--controls: none`, `nohotkeys`, `playsInline`, `streamType="on-demand"`, registered through `setMedia`; none → placeholder with no controls; `error` event → kind message with a link back to the Library; never autoplays on load; makes T015 pass (depends on T007, T013, T016)
- [X] T018 [P] [US1] Create `src/components/watch/HostCard.tsx` (Server Component): link to `hostPath` showing a round initial (sun for the first host, teal otherwise, as `HostHero`), "Your host" and the name; matches the card in `docs/design/Player.dc.html`
- [X] T019 [US1] Rewrite `src/components/screens/WatchScreen.tsx` (async Server Component, still rendered inside Suspense by the page): resolve language, video and host (`notFound()` if missing); layout per contract: video column with `PlaybackProvider` wrapping `VideoPlayer`, then the title row (`h1` title, line from `formatLength` and `stageLabel`: "{Stage} · {length} · {variety} {name}") and `HostCard`; leave room for the transcript aside; remove the old `PlaceholderPage` use (depends on T016–T018)
- [X] T020 [US1] Update `tests/unit/route-links.test.tsx` for the new watch page (host card link, Done link no longer from here until US6 adds it) so the link-graph test still reaches every route, and run the full test suite

**Checkpoint**: The player page plays the sample clip and handles the placeholder and error states; US1 is demoable

---

## Phase 4: User Story 2 - Follow along in the interactive transcript (Priority: P1)

**Goal**: Transcript built from the `.vtt` file with the new three-layer format; the current line follows playback; clicking a line jumps the video.

**Independent Test**: Play `at-the-cafe`; the highlight moves with the clip; click earlier and later lines; the video jumps; `colours-at-the-market` (no transcript) shows "The transcript is on its way."

### Tests for User Story 2

- [X] T021 [P] [US2] Write failing tests in `tests/unit/transcript.test.ts` for `parseTranscript(layers, cues)`: with layers `["script","tashkeel","transliteration","english"]` each cue must have exactly 3 lines (script, transliteration, english) — the layers list minus `tashkeel`; `-` becomes `null` for transliteration and english; the script line must be non-empty and not `-`; wrong line counts report `line N: expected 3 lines (script, transliteration, english), found M`; a two-layer language (`["script","english"]`) expects 2 lines; returns `{ start, end, script, transliteration, english }` with `null` for missing layers
- [X] T022 [P] [US2] Write failing tests in `tests/unit/glossary-link.test.ts` for `linkWords(script, entries)`: key = `word` with tashkeel, tatweel and surrounding punctuation removed, no letter folding (alef variants do not match each other); words with an entry become segments `{ text, entryId }`, everything else `{ text }` (plain text, not tappable); punctuation such as the Arabic question mark and full stop stays outside the linked word; the longest multi-word entry wins ("min faḍlak" style phrases); the same word twice links both occurrences; spacing between words is preserved so joining all segment texts equals the original line; two entries with the same key fail with `ambiguous` listing both ids
- [X] T023 [P] [US2] Extend `tests/unit/content.validate.test.ts`: a transcript cue with the wrong number of lines fails naming the file and line; a first line of `-` fails; ambiguous glossary entries fail with `glossary.json: word: ambiguous`; a missing `playbackId` is allowed; `validateLanguageContent` now takes the language's `transcriptLayers` in its options
- [X] T024 [P] [US2] Write failing tests in `tests/unit/TranscriptPanel.test.tsx` using a fake media element and the provider: the line whose start has been reached is highlighted (`aria-current="true"`) and the previous one is not; seeking (`seeked` event) moves the highlight; before the first line nothing is highlighted; after the last line the last stays highlighted; the highlight only re-renders when the line changes (count renders with a spy); clicking a line calls `seekTo` with its start and keeps the paused/playing state; the list container's `scrollTo` is called (never `window.scrollTo`) when the current line changes, with `behavior: "auto"` when `matchMedia("(prefers-reduced-motion: reduce)")` matches and `"smooth"` otherwise; a missing transcript renders "The transcript is on its way." and no toggles

### Implementation for User Story 2

- [X] T025 [P] [US2] Implement `parseTranscript` in `src/lib/content/transcript.ts` (types `TranscriptLine`) to make T021 pass
- [X] T026 [P] [US2] Implement `linkWords` and the ambiguity check in `src/lib/content/glossary-link.ts` using `stripTashkeel` from `src/lib/text/normalize.ts` (types `Segment`, `GlossaryEntry` reuse from `src/lib/content/schema.ts`) to make T022 pass
- [X] T027 [US2] Update `src/lib/content/validate.ts`, `src/lib/content/load.ts` and `src/lib/content/index.ts`: validation takes the language's `transcriptLayers` from `src/lib/languages.ts`, runs `parseTranscript` on every parsed `.vtt` (problems are reported as `<file>: transcript: <message>`) and the glossary ambiguity check; `LanguageContent.transcripts` becomes `Record<slug, TranscriptLine[]>`; add `getTranscriptView(language, videoSlug)` returning `{ lines: [{ start, end, segments, transliteration, english }], entries }` with only the glossary entries that are linked, or `undefined` when there is no transcript; make T023 pass and keep `tests/unit/content.validate.test.ts` and `tests/unit/content.real.test.ts` green (depends on T025, T026)
- [X] T028 [US2] Update the sample content to the new format: rewrite `content/arabic-egyptian/videos/my-family.vtt` and `at-the-cafe.vtt` so every cue has three lines (Arabic with tashkeel, transliteration, English), keeps `NOTE sample`, and all cue times end before 30 s; extend `content/arabic-egyptian/glossary.json` so every word the learner should be able to tap in those two transcripts has an entry (word with tashkeel, base, transliteration, English; no duplicates once tashkeel is removed); extend `tests/unit/content.real.test.ts` to assert both transcripts parse as three-layer lines and every glossary key is unique (depends on T027)
- [X] T029 [US2] Create `src/components/transcript/TranscriptPanel.tsx` (`"use client"`) and a small line component: props `languageSlug`, `language` (the plain language object), `view` (`TranscriptView | undefined`); an `aside` labelled "Transcript" with `h2`, the ordered list of lines (time via `formatClock`, Arabic via `TargetText` with the transcript variant and the line's segments as plain text for now, transliteration italic, English), the note "Tap any word for its meaning.", and "The transcript is on its way." when `view` is undefined; current line from `findCueIndex` computed from the media element's `timeupdate`, `seeking` and `seeked` events and stored in state only when the index changes; highlight with the design's coral-tint background and `aria-current="true"`; keep it visible by calling `scrollTo` on the list container only (instant under reduced motion, evaluated at that moment); each line's row is a real `button` that calls `seekTo(line.start)`; makes T024 pass (depends on T008, T011, T013)
- [X] T030 [US2] Wire the transcript into `src/components/screens/WatchScreen.tsx`: wide screens place the aside beside the video column (flex basis and max width 420–560px as in the design), phones place it below; fetch `getTranscriptView` on the server and pass it down; keep it inside the same `PlaybackProvider`

**Checkpoint**: Transcript follows playback and jumps on click; US1 and US2 both work

---

## Phase 5: User Story 3 - Choose which transcript layers to show (Priority: P1)

**Goal**: Four layer toggles remembered on this device, per language.

**Independent Test**: Toggle each layer; reload and open another video in the same language: same choices; private mode still works for the visit.

### Tests for User Story 3

- [X] T031 [P] [US3] Write failing tests in `tests/unit/LayerToggles.test.tsx`: renders a group "Show in transcript" with buttons Arabic, Tashkeel, Transliteration, English, each with `aria-pressed`; only layers the language has are shown (Spanish has no Transliteration or Tashkeel button); Tashkeel is `disabled` with an explanation while Arabic is off; pressing a toggle calls `onChange` with the new layers; every button is at least 44px high (class check)
- [X] T032 [P] [US3] Extend `tests/unit/TranscriptPanel.test.tsx`: first render uses `DEFAULT_LAYERS` (Arabic, Tashkeel, Transliteration on, English off); toggling English shows English text; toggling Tashkeel off shows the Arabic without vowel marks while the stored text prop is unchanged; Arabic off hides the Arabic block; all layers off shows each line's time and "Switch a layer on to read along."; a stored layers value is applied after mount; corrupt storage falls back to defaults; a throwing `localStorage` still lets toggles work for the visit; server-rendered HTML (`renderToString`) always shows the defaults

### Implementation for User Story 3

- [X] T033 [US3] Create `src/components/transcript/LayerToggles.tsx` (`"use client"` not needed if purely presentational; keep it a plain component used by the panel): pill buttons styled like the design's chips (ink fill when on, slate border when off), labels from the language's `transcriptLayers` (script → "Arabic" for Arabic-script languages, tashkeel → "Tashkeel", transliteration → "Transliteration", english → "English"); Tashkeel disabled while the script layer is off; makes T031 pass
- [X] T034 [US3] Integrate in `src/components/transcript/TranscriptPanel.tsx`: layers state from `useStoredValue(layersKey(languageSlug), layersSchema, DEFAULT_LAYERS)`; render only enabled layers; Arabic text goes through `stripTashkeel` at render when Tashkeel is off; show the all-layers-off hint; hide the toggles when there is no transcript; makes T032 pass (depends on T010, T029, T033)

**Checkpoint**: US1, US2 and US3 (all P1) work independently

---

## Phase 6: User Story 4 - Tap a word for its meaning (Priority: P2)

**Goal**: Linked words open a card with the entry; "Hear it" only when audio exists; unlinked words are inert.

**Independent Test**: Tap a linked word, read the card, close it each way; confirm unlinked words are plain text and no "Hear it" button shows for entries without audio.

### Tests for User Story 4

- [X] T035 [P] [US4] Write failing tests in `tests/unit/WordCard.test.tsx`: `role="dialog"` labelled `Word: <english>`; shows the word with tashkeel (`lang`/`dir` from the language), transliteration and English; "Hear it" button only when `audio` is set and pressing it calls the audio player without touching the media element; closes on Escape, on pointer or focus outside, and on `onClose`; focus returns to the word that opened it
- [X] T036 [P] [US4] Extend `tests/unit/TranscriptPanel.test.tsx`: segments with an `entryId` render as buttons, segments without render as plain text with no role; tapping a linked word opens its card near that line and does not seek; tapping the same word again closes it; opening another word replaces the first; with Tashkeel off the card still shows the word with tashkeel; keyboard: Enter/Space opens and Escape closes with focus back on the word; the same word twice in a line opens the same entry; punctuation is not inside the button

### Implementation for User Story 4

- [X] T037 [US4] Create `src/components/transcript/WordCard.tsx` (`"use client"`): dark card from the design (ink background, cream text, shadow-md, word in the transcript font via `TargetText`, transliteration italic, English semibold), optional round coral "Hear it" button (accessible name "Hear it") that creates and plays an `Audio` from the entry's `audio` URL inside the click handler and stops it on close and unmount; closes on Escape and outside pointer/focus; returns focus to the opener; makes T035 pass
- [X] T038 [US4] Update `src/components/transcript/TranscriptPanel.tsx`: render each linked segment as a real `button` (visible focus, underline or mark style from the design: sun-coloured background on the active word) and unlinked segments as plain text; keep the line row's own seek button separate from the word buttons (word buttons are not nested inside another button: make the seek target the time label and row background area, not a wrapping `<button>`); open `WordCard` below the line for the active word; makes T036 pass (depends on T034, T037)

**Checkpoint**: Words work without disturbing playback or sync

---

## Phase 7: User Story 5 - Say whether you followed it (Priority: P2)

**Goal**: Optional understanding check stored on this device; at the end of the video it is brought into view and focused.

**Independent Test**: Pick each answer, reload, same answer; let the clip end with autoplay off: the check scrolls into view and focuses "Mostly" with nothing selected.

### Tests for User Story 5

- [X] T039 [P] [US5] Write failing tests in `tests/unit/UnderstandingCheck.test.tsx`: shows the Arabic "فاهم؟" with `lang` and `dir` from the language, "Did you follow this one?" and "No score. It just helps us pick what's up next."; a group "How much did you understand" with buttons Mostly, Some of it, Not yet and none pressed at first; choosing one sets `aria-pressed`, choosing another changes it; a stored answer for that video is applied after mount and not for another video; invalid storage is ignored; a throwing `localStorage` does not break it; no score or total appears; it registers its first answer button with the provider
- [X] T040 [P] [US5] Write failing tests in `tests/unit/PlaybackProvider.test.tsx` for the end-of-video behaviour with a fake media element: `ended` with autoplay off scrolls the registered check into view (`behavior: "auto"` when reduced motion matches, `"smooth"` otherwise), focuses its first answer, selects nothing, and calls `document.exitFullscreen` first when `document.fullscreenElement` is set; `ended` with no registered check does nothing and does not throw

### Implementation for User Story 5

- [X] T041 [US5] Create `src/components/watch/UnderstandingCheck.tsx` (`"use client"`): card per the design (white, rounded-lg, shadow-sm), Arabic text via `TargetText`, the three answer buttons (44px, selected = teal fill with ink label, `aria-pressed`), state from `useStoredValue(understoodKey(languageSlug, videoSlug), understoodSchema, undefined)`; registers its first button and container with the provider; makes T039 pass (depends on T010, T011, T013)
- [X] T042 [US5] Extend `src/components/player/PlaybackProvider.tsx` with `registerCheck(container, firstButton)` and an `ended` listener on the registered media: when autoplay (read with `readStored(AUTOPLAY_KEY, ...)` at that moment) is not on, exit full screen if needed, scroll the check into view and focus its first answer; make T040 pass (depends on T009, T013)
- [X] T043 [US5] Add `UnderstandingCheck` to `src/components/screens/WatchScreen.tsx` under the title row and host card

**Checkpoint**: The check works and the end-of-video flow is in place

---

## Phase 8: User Story 6 - Choose what to watch next (Priority: P2)

**Goal**: Up next with two or three same-stage videos, a visible autoplay switch (off by default) and the closing line with a link to Done for today.

**Independent Test**: Open `at-the-cafe`; see up to three other Follow it videos; flip autoplay; reach the end line; link to Done for today; with autoplay on and the clip ended, the first Up next video opens.

### Tests for User Story 6

- [X] T044 [P] [US6] Write failing tests in `tests/unit/upnext.test.ts` for `getUpNext(videos, current, limit = 3)` in `src/lib/content/upnext.ts`: only the same stage, never the current video, library order starting after the current video and wrapping, at most three, fewer when fewer exist, empty when none
- [X] T045 [P] [US6] Write failing tests in `tests/unit/AutoplaySwitch.test.tsx`: a button labelled "Autoplay next" with `aria-pressed="false"` on first render and in server HTML; pressing toggles and writes `true` to storage; a stored `true` applies after mount; corrupt storage keeps it off; the switch track shows teal when on and slate when off; at least 44px high
- [X] T046 [P] [US6] Write failing tests in `tests/unit/UpNext.test.tsx` (render the Server Component): heading "Up next"; one `VideoCard` per video each showing its host; the closing line "That's all for Up next. Pick one when you're ready, or finish for today." with "finish for today" linking to `/learn/arabic-egyptian/done`; with no videos a kind message plus the same closing line; no "load more" control
- [X] T047 [P] [US6] Extend `tests/unit/PlaybackProvider.test.tsx` and `tests/unit/VideoPlayer.test.tsx`: with autoplay on, `ended` writes the next slug to `sessionStorage` under `instik:v1:autoplay-next`, calls `router.push(nextHref)` and does not scroll or focus the check; with autoplay off nothing navigates; the player reads and clears the `autoplay-next` flag after mount and calls `play()` (a rejected `play()` is swallowed and the play button stays); the flag is ignored when it names another video

### Implementation for User Story 6

- [X] T048 [P] [US6] Implement `getUpNext` in `src/lib/content/upnext.ts` and `getUpNextVideos(language, videoSlug)` in `src/lib/content/index.ts` (returns `LibraryVideo[]` via `getLibraryVideos`); make T044 pass
- [X] T049 [P] [US6] Create `src/components/watch/AutoplaySwitch.tsx` (`"use client"`): `button` with `aria-pressed` and the visible label "Autoplay next" plus the track and knob from the design; state from `useStoredValue(AUTOPLAY_KEY, autoplaySchema, false)`; makes T045 pass (depends on T010)
- [X] T050 [P] [US6] Create `src/components/watch/UpNext.tsx` (Server Component): `section` labelled "Up next" with `h2`, the `AutoplaySwitch`, a two-column grid of `VideoCard`s (one column on phones), and the closing paragraph with the link from `donePath`; makes T046 pass
- [X] T051 [US6] Extend `src/components/player/PlaybackProvider.tsx` (accepts `nextHref` and `nextSlug` props): on `ended` with autoplay on, set the `sessionStorage` flag and `router.push(nextHref)`; and extend `src/components/player/VideoPlayer.tsx` to read and clear the flag after mount (only when it names this video) and call `play()`; make T047 pass (depends on T042, T017)
- [X] T052 [US6] Add `UpNext` to `src/components/screens/WatchScreen.tsx` below the understanding check, pass `nextHref`/`nextSlug` (first Up next video, if any) to `PlaybackProvider`, and update `tests/unit/route-links.test.tsx` so the watch pages link to Done for today and other watch pages and the link graph still reaches every route

**Checkpoint**: All six stories work independently

---

## Phase 9: Polish & Cross-Cutting

- [X] T053 [P] Review every new component against `docs/design/Player.dc.html` and the tokens: no hard-coded colours or sizes that a token covers, 44px targets, visible focus, contrast ≥ 4.5:1 (coral only as a fill with ink label, `coral-text` for text), brand voice in all new strings, no internal level names; fix deviations
- [X] T054 [P] Add a "Video playback" note to `README.md`: sample clip regeneration (`scripts/make-sample-clip.mjs`), the `sample-` id rule, and that real Mux ids go in the video JSON `playbackId`
- [X] T055 Run `npm run lint`, `npm run typecheck`, `npm test` and `npm run build`; fix every failure
- [X] T056 Walk through `specs/003-video-player-transcript/quickstart.md` sections 2–7 in a real browser with extensions that edit pages turned off: defect checks in a scratch copy, player, transcript, words, check, Up next, a clean console (no errors, no hydration or Suspense/params warnings) across first load, layer changes, opening a word, the check and full screen, 320px width with no sideways scroll, and keyboard-only operation; fix anything that deviates **Done with two gaps:** the automation browser refused full screen ("not granted"; the code does call it on the player wrapper and tolerates the refusal), and no real Mux playback id exists yet, so only the Mux branch is covered by a mocked test. Also found and fixed during this walkthrough: the previous video kept playing, hidden, after navigating away.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (1)** → **Foundational (2)** → **US1 (3)** → **US2 (4)** → **US3 (5)** → **US4 (6)**; **US5 (7)** needs US1 and the provider; **US6 (8)** needs US5 (shared `ended` handling) and US1; **Polish (9)** last.
- US3 and US4 both extend `TranscriptPanel.tsx`, so they run in sequence (US4 after US3). US5 and US6 both extend `PlaybackProvider.tsx` and `WatchScreen.tsx`, so they also run in sequence.

### Within stories

- Tests first and failing. T016 → T017 → T019 → T020. T025/T026 → T027 → T028 → T029 → T030. T033 → T034. T037 → T038. T041/T042 → T043. T048/T049/T050 → T051 → T052.

### Parallel opportunities

- Setup: T003 alongside T001/T002.
- Foundational: T004, T006, T007, T008, T009, T011, T012 together; T005 after T004; T010 after T009; T013 anytime.
- US1: T014 and T015 together; T018 alongside T016/T017.
- US2: T021, T022, T023, T024 together; T025 and T026 together.
- US3: T031 and T032 together.
- US4: T035 and T036 together.
- US5: T039 and T040 together.
- US6: T044, T045, T046, T047 together; T048, T049, T050 together.
- Polish: T053 and T054 together.

## Parallel Example: User Story 2

```text
Task: "Write failing tests in tests/unit/transcript.test.ts"
Task: "Write failing tests in tests/unit/glossary-link.test.ts"
Task: "Extend tests/unit/content.validate.test.ts"
Task: "Write failing tests in tests/unit/TranscriptPanel.test.tsx"
```

## Implementation Strategy

### MVP first

1. Phases 1 and 2, then US1: a working player page with the sample clip, controls, host card, placeholder and error states. **Stop and validate** against the design and quickstart section 3.
2. US2 and US3 complete the P1 set: the transcript follows playback and the layers are remembered.

### Incremental delivery

1. Words (US4), then the check (US5), then Up next with autoplay (US6), each validated with its quickstart section before the next.
2. Polish and the full gate run, including the real-browser console check.

## Notes

- Commit after each task or logical group.
- Never alter stored Arabic text; tashkeel stripping and matching are for display and linking only.
- The only new dependency is `@mux/mux-player-react`; if another seems needed, stop and state the reason first (constitution VII).
- The first render of every component that uses stored preferences must equal the server render; check this with `renderToString` in the component tests.

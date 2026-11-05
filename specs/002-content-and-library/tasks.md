---

description: "Task list for Content and Library"
---

# Tasks: Content and Library

**Input**: Design documents from `/specs/002-content-and-library/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included. The constitution (principle IX) requires tests for core logic (Arabic normalisation, content validation) and the plan lists them. Write each test first and see it fail.

**Organization**: Grouped by user story. Phases run in dependency order: the Library and host pages need the content layer (US4) and sample content (US5), so those come first even though the Library is the headline screen.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: US1 Browse the Library (P1), US2 Filter and search (P1), US3 Host page (P2), US4 Content files and validation (P1), US5 Egyptian Arabic sample content (P2)

## Path Conventions

Single Next.js app: `src/`, `tests/unit/`, `content/` at the repository root. Before writing any Next.js code read the relevant guide in `node_modules/next/dist/docs/` (AGENTS.md).

---

## Phase 1: Setup

- [X] T001 Confirm the baseline is green before changes: run `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` from the repo root and note any pre-existing failure
- [X] T002 Create the empty folders `content/arabic-egyptian/hosts/`, `content/arabic-egyptian/videos/`, `src/lib/content/`, `src/lib/text/`, `src/components/library/` and `src/components/host/` (files arrive in later tasks)

---

## Phase 2: Foundational (blocks all user stories)

**Purpose**: Small shared pieces every story uses

- [X] T003 [P] Create `src/lib/content/taxonomy.ts`: stages `hear-it`/"Hear it" (1), `follow-it`/"Follow it" (2), `understand-it`/"Understand it" (3), `join-in`/"Join in" (4); topics `daily-life`/"Daily life", `food`/"Food", `family`/"Family", `getting-around`/"Getting around", `culture`/"Culture"; export the slug unions, ordered arrays and `stageLabel`/`topicLabel` helpers. No internal level names anywhere
- [X] T004 [P] Write failing tests in `tests/unit/normalize.test.ts`: tashkeel removed (U+064B–U+065F, U+0670, U+06D6–U+06ED), tatweel U+0640 removed, أ إ آ ٱ → ا, ى → ي, ة → ه, Latin accents and case folded ("Café" → "cafe"), whitespace collapsed and trimmed, only-tashkeel input → empty string, input is not mutated
- [X] T005 Implement `normalizeForSearch(text: string): string` in `src/lib/text/normalize.ts` per research.md decision 5 (NFKD → strip combining marks → strip tatweel → map alef/ya/ta marbuta variants → lowercase → collapse whitespace → trim); make T004 pass
- [X] T006 [P] Add `hostPath(slug, host)` → `/learn/${slug}/hosts/${host}` and `watchVideoPath(slug, video)` → `/learn/${slug}/watch/${video}` to `src/lib/routes.ts`, and extend `tests/unit/routes.test.ts` with both builders
- [X] T007 Update `src/components/shell/MainNav.tsx` so Hosts is `aria-current="page"` for `/hosts` and any `/hosts/...` path (Library stays exact match; watch pages mark nothing); extend `tests/unit/MainNav.test.tsx` with `/learn/arabic-egyptian/hosts/salma` marking Hosts and `/learn/arabic-egyptian/watch/at-the-cafe` marking nothing

**Checkpoint**: Taxonomy, normalisation and route builders ready

---

## Phase 3: User Story 4 - Author and validate content as files (Priority: P1)

**Goal**: Content files are loaded, validated and exposed as typed data; any defect fails the build with a message naming the file.

**Independent Test**: Unit tests for each defect type pass; with valid data the accessors return typed videos and hosts (shipped content arrives in US5).

### Tests for User Story 4

- [X] T008 [P] [US4] Write failing tests in `tests/unit/content.schema.test.ts` for the video, host and glossary schemas, quoting the constraints: video `title` non-empty; `slug` lowercase letters, digits, hyphens; `stage` one of `hear-it|follow-it|understand-it|join-in`; `topic` one of the five slugs; `durationSeconds` integer ≥ 1; `access` `free|full`; `playbackId` non-empty; optional `titleArabic`, `sample`; host `nameArabic` required, `topics` 1–6 non-empty strings, `photo` string or null or absent, `order` integer; glossary entry `id` `word` `base` `transliteration` `english` required, `audio` optional; unknown extra fields rejected; error text lists allowed values for stage, topic, access
- [X] T009 [P] [US4] Write failing tests in `tests/unit/vtt.test.ts`: valid file parses to cues; missing `WEBVTT` first line, malformed timestamp, end ≤ start, cues out of order or overlapping, and empty cue text each throw/return an error with line number; `NOTE` blocks are ignored; `MM:SS.mmm` and `HH:MM:SS.mmm` both accepted
- [X] T010 [P] [US4] Write failing tests in `tests/unit/content.validate.test.ts` (in-memory files): one test per defect: missing field; bad stage; bad topic; bad access; unknown host; duplicate slug; slug differs from file name; duplicate host `order`; host slug differs from file name; transcript with no video; malformed transcript; duplicate glossary id; malformed glossary or host file; `available` language with no folder; `coming-soon` language with no folder is allowed; video without transcript is allowed; every error names the file and starts with `Invalid content in content/<language>`

### Implementation for User Story 4

- [X] T011 [P] [US4] Implement strict zod schemas and types in `src/lib/content/schema.ts` per data-model.md (video, host, glossary file `{ sample?, entries[] }`), reusing taxonomy from T003
- [X] T012 [P] [US4] Implement `parseVtt(text)` in `src/lib/content/vtt.ts` returning cues `{start, end, text}` or a list of line-numbered errors per research.md decision 4
- [X] T013 [US4] Implement pure `validateLanguageContent(language, files)` in `src/lib/content/validate.ts` applying the schemas, VTT parser and the six cross-file rules in data-model.md; collect all problems and throw one `Error` formatted `Invalid content in content/<language>` + one `<file>: <field or rule>: <message>` line per problem (depends on T011, T012)
- [X] T014 [US4] Implement `src/lib/content/load.ts` (server-only): for each language in `src/lib/languages.ts` read `content/<slug>/` (`videos/*.json`, `videos/*.vtt`, `hosts/*.json`, `glossary.json`) with Node file APIs, tolerate a missing folder only for `coming-soon` languages, call `validateLanguageContent`, return typed data (depends on T013)
- [X] T015 [US4] Implement `src/lib/content/index.ts` accessors cached at module load: `getVideos(language)` (stage order then title), `getVideo(language, slug)`, `getHosts(language)` (by `order`), `getHost(language, slug)`, `getVideosByHost(language, hostSlug)`, `getGlossary(language)`; unknown slugs return `undefined` (depends on T014)

**Checkpoint**: T008–T010 pass; the content layer is complete and testable without any page

---

## Phase 4: User Story 5 - Egyptian Arabic sample content (Priority: P2)

**Goal**: Clearly marked sample content so every screen has something real to show.

**Independent Test**: `tests/unit/content.real.test.ts` loads the shipped files and passes; counts match the spec.

- [X] T016 [P] [US5] Create `content/arabic-egyptian/hosts/salma.json` (order 1, Latin "Salma", `nameArabic` "سلمى", topics `["Alexandria","Food","Family","The sea"]`, `photo` null) and `hosts/omar.json` (order 2, "Omar", `nameArabic` "عمر", topics `["Markets","Transport","Football"]`, `photo` null); stories start with "[Sample]"; both `"sample": true`
- [X] T017 [P] [US5] Create 8 video files in `content/arabic-egyptian/videos/`, each `"sample": true`, `access` mixed `free`/`full` (first video of each stage `free`), `playbackId` `sample-playback-id-<slug>`, `titleArabic` with tashkeel on at least `at-the-cafe`, `my-family`, `taking-a-microbus`: Hear it — `colours-at-the-market` (360s, daily-life, omar), `my-family` (300s, family, salma); Follow it — `at-the-cafe` (520s, food, salma), `buying-bread-at-the-bakery` (420s, food, omar), `a-walk-on-the-corniche` (660s, getting-around, salma), `taking-a-microbus` (540s, getting-around, omar); Understand it — `ramadan-nights` (840s, culture, salma), `a-day-at-a-wedding` (960s, culture, omar)
- [X] T018 [P] [US5] Create `content/arabic-egyptian/glossary.json` with `"sample": true` and entries (word with tashkeel, base, transliteration, English) for every distinct word in the two transcripts
- [X] T019 [P] [US5] Create `content/arabic-egyptian/videos/my-family.vtt` and `at-the-cafe.vtt`: `WEBVTT`, blank line, `NOTE sample`, then 3–5 short, simple Egyptian Arabic cues each with ordered, non-overlapping timestamps
- [X] T020 [US5] Write `tests/unit/content.real.test.ts` loading the shipped content: 8 videos (Hear it 2, Follow it 4, Understand it 2), 2 hosts, exactly 2 transcripts, every file has `sample` marking (JSON `sample: true`, VTT `NOTE sample`), at least one video has no transcript, the pick-up banner video (`at-the-cafe`) exists, and `getVideos` returns a non-empty list for `arabic-egyptian` (depends on T015–T019)

**Checkpoint**: Content builds; `npm test` and `npm run build` pass with sample content

---

## Phase 5: User Story 1 - Browse the Library and find a video (Priority: P1) 🎯 MVP

**Goal**: The Library screen with banner, stage and topic filters, count line, cards and end message, matching `docs/design/Library.dc.html`. (Search box and its behaviour arrive in US2.)

**Independent Test**: Open `/learn/arabic-egyptian`: banner, filters, 4 Follow-it cards, end message; select stages and topics; card links go to `/learn/arabic-egyptian/watch/<slug>`; no infinite scroll.

### Tests for User Story 1

- [X] T021 [P] [US1] Write failing tests in `tests/unit/VideoCard.test.tsx`: renders one link with `href` from `watchVideoPath`; shows stage chip, title, "N min · with Host"; host name always present; "Watched" label appears only when `watched` is true and takes no space otherwise
- [X] T022 [P] [US1] Write failing tests in `tests/unit/LibraryBrowser.test.tsx`: Follow it selected by default with 4 cards and count line "4 videos at Follow it. Your stage is Follow it."; selecting another stage swaps cards and sets `aria-pressed`; Join in shows "No videos at Join in yet. They are on the way." and no cards; selecting a topic narrows the list, pressing it again clears; the end message "That's everything for this stage. New videos arrive every week." is last; no "load more" control

### Implementation for User Story 1

- [X] T023 [P] [US1] Create `src/components/library/VideoCard.tsx` matching the card in `docs/design/Library.dc.html` using Tailwind tokens (24px radius, shadow-sm, 16:9 thumbnail placeholder alternating cream/coral-tint, teal stage chip with ink text); the whole card is a `next/link`; props `{ language, video, watched? }`
- [X] T024 [P] [US1] Create `src/components/library/FilterGroup.tsx`: labelled `role="group"` of pill buttons with `aria-pressed`, min 44px touch height, selected style ink fill / cream text (props: label, options, selected, onSelect)
- [X] T025 [P] [US1] Create `src/components/library/PickUpBanner.tsx` (server-safe) per the design: static position constant (134 s) with a comment that real history replaces it; reads title, host, total length from content; shows "2:14 of 8:40 · with Salma"; whole banner links to `watchVideoPath`; "Keep watching" action in a coral fill with ink label
- [X] T026 [US1] Create `src/lib/content/library.ts` building `LibraryVideo[]` for the client (`slug`, `title`, `stage`, `stageLabel`, `topic`, `minutes` = `max(1, floor(durationSeconds / 60))`, `hostName`, `hostSlug`, `searchKey` from `normalizeForSearch` over title, `titleArabic`, host name, host `nameArabic`, `watched: false`) (depends on T005, T015)
- [X] T027 [US1] Create `src/components/library/LibraryBrowser.tsx` (`"use client"`): state `stage` (default `follow-it`) and `topic`; renders Stage and Topic `FilterGroup`s, a polite live count line, the card grid and the end message; copy per `contracts/routes.md`; make T022 pass (depends on T023, T024)
- [X] T028 [US1] Replace `src/app/(shell)/learn/[language]/page.tsx` with the Library: `h1` "Library", `PickUpBanner`, `LibraryBrowser` fed from `library.ts`; metadata title `Library · Instik`; resolve the language through the existing helper and `notFound()` if unknown (depends on T025–T027)
- [X] T029 [US1] Create `src/app/(shell)/learn/[language]/watch/[video]/page.tsx`: `generateStaticParams` over available languages' videos (at least one param), `notFound()` for unknown video, placeholder content via `PlaceholderPage` with the video title and host ("The player is on its way."), back link to the Library, metadata `{Video title} · Instik`

**Checkpoint**: Library works with filters and links; US1 is demoable

---

## Phase 6: User Story 2 - Filter and search (Priority: P1)

**Goal**: Search ignoring tashkeel and letter variants; a non-empty search covers all stages and topics.

**Independent Test**: Type `cafe`, the Arabic title with and without tashkeel, and with `ا` / `أ` / `إ`; the same card appears; clearing the search restores the stage view.

### Tests for User Story 2

- [X] T030 [P] [US2] Write failing tests in `tests/unit/search.test.ts` for `filterVideos`: empty or whitespace query uses stage and topic; non-empty query ignores stage and topic and matches all videos; multi-word query needs every term; tashkeel-free and alef-variant Arabic queries match a title stored with tashkeel; "cafe" matches "At the café"; host name matches; no match returns an empty list; only-tashkeel query is treated as empty
- [X] T031 [P] [US2] Extend `tests/unit/LibraryBrowser.test.tsx`: typing a query shows cards from all stages with their stage chip and the count line `N videos match "{query}".`; clearing returns to the selected stage and topic; no matches shows `Nothing matches "{query}". Try a shorter word.` with a "Clear search" button that works; end message while searching is "That's everything that matches."

### Implementation for User Story 2

- [X] T032 [US2] Implement pure `filterVideos(videos, { stage, topic, query })` in `src/lib/content/search.ts` using `normalizeForSearch` on the query and splitting on spaces; make T030 pass (depends on T005, T026)
- [X] T033 [US2] Add the "Search videos" field (label above input, placeholder "Café, family, microbus…", type `search`, 48px high, border slate) and the results logic to `src/components/library/LibraryBrowser.tsx`: use `filterVideos`, search count line, empty-search message with "Clear search" button, search-mode end message; make T031 pass (depends on T027, T032)

**Checkpoint**: Search and filters work together; US1 and US2 both pass

---

## Phase 7: User Story 3 - Visit a host page (Priority: P2)

**Goal**: Host page matching `docs/design/Host.dc.html`, one URL per host, plus the `/hosts` redirect.

**Independent Test**: `/learn/arabic-egyptian/hosts/salma` and `/omar` render; `/hosts` redirects to Salma; `/hosts/nobody` is not found.

### Tests for User Story 3

- [X] T034 [P] [US3] Write failing tests in `tests/unit/HostHero.test.tsx`: `h1` is the Latin name; Arabic name inside an element with `lang="arz"` and `dir="rtl"`; story and topic chips shown; photo placeholder has accessible text when `photo` is null; "Watch {name} say hello" link points to the given video path, and is absent when no video is given
- [X] T035 [P] [US3] Write failing tests in `tests/unit/OtherHosts.test.tsx`: lists only the other hosts as links to `hostPath`; always shows the "More hosts joining soon" box; with a single host only the box shows

### Implementation for User Story 3

- [X] T036 [P] [US3] Create `src/components/host/HostHero.tsx`: 4:5 photo placeholder (sun fill for the first host, teal otherwise, text "Photo coming soon"), or the photo when set, "Host · Egyptian Arabic" label (from language data), `h1` name, Arabic name via `TargetText`, story at body-lg, topic chips, coral "Watch {name} say hello" action with play icon
- [X] T037 [P] [US3] Create `src/components/host/OtherHosts.tsx`: "Other hosts" section with round-initial chips (teal) linking to each other host with their topics line, and the dashed "More hosts joining soon" box
- [X] T038 [US3] Create `src/app/(shell)/learn/[language]/hosts/[host]/page.tsx`: `generateStaticParams` over all hosts, `notFound()` for unknown host, compose `HostHero`, the "Videos with {name}" grid reusing `VideoCard` (empty message "{name}'s first videos are on the way." when none), and `OtherHosts`; say-hello video is the host's lowest-stage video; metadata `{Name} · Instik` (depends on T023, T036, T037)
- [X] T039 [US3] Replace `src/app/(shell)/learn/[language]/hosts/page.tsx` with a `redirect()` to the first host's `hostPath` (by `order`); fails the build with a clear message if the language has no host

**Checkpoint**: All five stories work independently

---

## Phase 8: Polish & Cross-Cutting

- [X] T040 [P] Update `specs/001-app-foundation-shell/contracts/routes.md` notes: `/hosts` now redirects to the first host, `/hosts/{host}` and `/watch/{video}` exist, and the Hosts nav marker covers all `/hosts/...` paths
- [X] T041 [P] Add a short "Adding content" section to `README.md` pointing to `specs/002-content-and-library/contracts/content-files.md` (folder layout, sample marker, build fails on bad content)
- [X] T042 Review every new component against the Library and Host designs and the tokens: no hard-coded colours or sizes covered by a token, 44px targets, focus visible, contrast ≥ 4.5:1 (coral only as fill with ink label, `coral-text` for text), no internal level names in copy, brand voice in all new strings
- [X] T043 Run `npm run lint` (includes the accessibility rules from `eslint-config-next`), `npm run typecheck`, `npm test` and `npm run build`; fix every failure
- [ ] T044 Walk through `specs/002-content-and-library/quickstart.md` sections 2–6 (defect checks in a scratch copy, Library, host, links, sample content) including 320px width and keyboard-only passes; record anything that deviates and fix it

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (1)** → **Foundational (2)** → **US4 (3)** → **US5 (4)** → **US1 (5)** → **US2 (6)**; **US3 (7)** needs US5 and `VideoCard` from US1 (T023); **Polish (8)** last.
- US4 before US5 because the real-content test uses the loader; US5 before any page because pages render sample content.

### Within stories

- Tests first and failing, then implementation. T013 needs T011 and T012; T014 needs T013; T015 needs T014. T027 needs T023 and T024; T028 needs T025–T027. T033 needs T027 and T032.

### Parallel opportunities

- Phase 2: T003, T004, T006 together; T005 after T004; T007 after T006.
- US4: T008, T009, T010 together; then T011 and T012 together.
- US5: T016, T017, T018, T019 together.
- US1: T021, T022 together; T023, T024, T025 together.
- US2: T030 and T031 together.
- US3: T034, T035 together; T036 and T037 together.
- Polish: T040 and T041 together.

## Parallel Example: User Story 4

```text
Task: "Write failing tests in tests/unit/content.schema.test.ts"
Task: "Write failing tests in tests/unit/vtt.test.ts"
Task: "Write failing tests in tests/unit/content.validate.test.ts"
```

## Implementation Strategy

### MVP first

1. Phases 1–2, then US4 and US5 (content layer plus sample content).
2. US1 (Library with filters and cards). **Stop and validate** against the design and quickstart section 3 (without search).
3. US2 (search) completes the P1 set.

### Incremental delivery

1. Content layer → sample content → demo that the build fails on bad content.
2. Library → search → host pages, each checked against its quickstart section before moving on.
3. Polish and the full gate run.

## Notes

- Commit after each task or logical group.
- Never alter stored Arabic text; normalisation is for matching only.
- Do not add dependencies; if one seems needed, stop and state the reason first (constitution VII).

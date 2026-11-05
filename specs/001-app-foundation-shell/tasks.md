---

description: "Task list for App Foundation and Shell"
---

# Tasks: App Foundation and Shell

**Input**: Design documents from `/specs/001-app-foundation-shell/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/routes.md, contracts/languages.md, quickstart.md

**Tests**: Included. The constitution (Principle IX) requires tests for core logic, and plan.md
sets up Vitest. Async Server Components are verified through `next build` and the quickstart
walkthrough because Vitest cannot render them.

**Organization**: Tasks are grouped by user story. Before writing any Next.js code, read the
relevant guide in `node_modules/next/dist/docs/` (this version has breaking changes; see `AGENTS.md`).
`next.config.ts` has `cacheComponents` on: do not `await params` at the top level of a layout, and
wrap runtime-dependent hooks such as `usePathname` in `<Suspense>`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 = shell and navigation, US2 = Instik look, US3 = languages as data, US4 = Arabic in English
- Paths are relative to the repository root

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependencies, scripts and test runner

- [X] T001 Install `zod` as a runtime dependency with `npm install zod` (updates `package.json` and `package-lock.json`)
- [X] T002 Install dev dependencies with `npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom vite-tsconfig-paths` (updates `package.json` and `package-lock.json`)
- [X] T003 Add scripts `"test": "vitest run"` and `"typecheck": "tsc --noEmit"` to `package.json` (after T001, T002)
- [X] T004 [P] Create `vitest.config.mts` with the `tsconfigPaths()` and `react()` plugins and `test.environment: "jsdom"`, `test.include: ["tests/**/*.test.{ts,tsx}"]`, following `node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Design tokens, fonts, language data and route helpers that every story uses

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 [P] Replace `src/app/globals.css` with `@import "tailwindcss";` plus an `@theme` block built from `docs/design-tokens.json`: colours `cream #fff4e6`, `paper #ffffff`, `ink #1b2340`, `slate #5b6478`, `coral #ff6a4d`, `coral-text #c2412a`, `coral-tint #ffe1d6`, `teal #19a38f`, `teal-text #0f7566`, `sun #ffc83d`, `hairline #1b23401f`; font families `display`, `sans`, `arabic`, `naskh` pointing at the `next/font` CSS variables with the token fallback stacks; spacing aliases `space-1`…`space-16`; radii `radius-sm 8px`, `radius-md 14px`, `radius-lg 24px`, `radius-pill 999px`; shadows `shadow-sm` and `shadow-md`; text styles `display`, `title`, `heading`, `body-lg`, `body`, `label`, `caption`, `translit`, `arabic-ui`, `transcript` with the sizes, line heights and weights from the token file. Set `body` to cream background, ink text, `sans` family, 16px/24px. Remove the scaffold dark-mode media query and Geist variables. Leave the `@tailwindcss/turbopack` rule in `next.config.ts` untouched.
- [X] T006 [P] Create `content/languages.json` exactly as in `specs/001-app-foundation-shell/contracts/languages.md`: Egyptian Arabic (`code: "arz"`, `slug: "arabic-egyptian"`, `name: "Arabic"`, `variety: "Egyptian"`, `nativeName: "مصري"`, `script: "arabic"`, `direction: "rtl"`, `status: "available"`, `fonts: {ui: "arabic", transcript: "naskh"}`, all four transcript layers) and Spanish (`code: "es"`, `slug: "spanish"`, `status: "coming-soon"`, `direction: "ltr"`, `script: "latin"`)
- [X] T007 [P] Create `src/lib/languages.schema.ts` with a `zod` schema and exported `Language` type. Constraints, quoted from data-model.md: `slug` matches `^[a-z0-9]+(-[a-z0-9]+)*$` and is unique across the set; `code` is unique across the set; `direction` is `"rtl"` or `"ltr"`; `status` is `"available"` or `"coming-soon"`; `script` is `"arabic"` or `"latin"`; `fonts.ui` and `fonts.transcript` are one of `display`, `sans`, `arabic`, `naskh`; `transcriptLayers` is a non-empty list of `script`, `tashkeel`, `transliteration`, `english` with no repeats; `variety` is optional; at least one language has `status: "available"`; the file has a non-empty `languages` array. Error messages follow the table in contracts/languages.md.
- [X] T008 [P] Create `src/lib/routes.ts` with the screen table from data-model.md, path builders (`landingPath()`, `onboardingPath()`, `pricingPath()`, `libraryPath(slug)`, `watchPath(slug)`, `donePath(slug)`, `roadmapPath(slug)`, `hostsPath(slug)`) matching contracts/routes.md, and `languageSlugFromPathname(pathname)` returning the slug for `/learn/<slug>` and `/learn/<slug>/...` paths, otherwise `undefined`
- [X] T009 Create `src/lib/languages.ts` that imports `content/languages.json`, parses it with the schema from T007 at module load (so an invalid file fails `next build`), and exports `languages`, `defaultLanguage` (first available), `getLanguageBySlug(slug)` and `isAvailable(language)` (depends on T006, T007)
- [X] T010 Rewrite `src/app/layout.tsx` as the minimal root layout: `<html lang="en">`, load Nunito (700, 800), Inter, IBM Plex Sans Arabic (arabic subset, 500, 600) and Noto Naskh Arabic (arabic subset, 400) with `next/font/google` using `display: "swap"` and CSS variables matching T005, apply the variables and `antialiased` to `<html>`, `min-h-screen` on `<body>`, and set default metadata title `Instik — Your scroll time, but it counts.` (depends on T005)
- [X] T011 [P] Write `tests/unit/languages.schema.test.ts` covering the shipped file passing and each failure in contracts/languages.md: missing field, bad slug, bad direction, bad status, bad script, unknown font token, duplicate transcript layer, duplicate slug, duplicate code, no available language, empty array (depends on T007)
- [X] T012 [P] Write `tests/unit/languages.lookup.test.ts` covering `defaultLanguage` is Egyptian Arabic, `getLanguageBySlug("arabic-egyptian")` and `("spanish")` resolve, an unknown or differently cased slug returns `undefined`, and `isAvailable` (depends on T009)
- [X] T013 [P] Write `tests/unit/routes.test.ts` covering every path builder against the table in contracts/routes.md and `languageSlugFromPathname` for `/`, `/pricing`, `/learn/arabic-egyptian`, `/learn/arabic-egyptian/hosts` and `/learn` (depends on T008)

**Checkpoint**: `npm test` passes; tokens, fonts, language data and route helpers are ready

---

## Phase 3: User Story 1 - Move through every screen with a consistent shell (Priority: P1) 🎯 MVP

**Goal**: Every MVP screen exists as a placeholder inside one shared header and footer, reachable by links.

**Independent Test**: From `/`, follow links until all eight screens are visited; each shows the shared header and footer, one `h1`, a "coming soon" note, and the current Library, Roadmap or Hosts item marked current.

- [X] T014 [P] [US1] Create `src/components/PlaceholderPage.tsx`: a Server Component taking `title`, `note` and `backHref`/`backLabel`, rendering exactly one `h1` (`title` text style, `font-display`), one short brand-voice sentence, and a link back to a working page
- [X] T015 [P] [US1] Create `src/components/shell/SkipLink.tsx` (an `<a href="#main">Skip to main content</a>` that is visually hidden until focused) and `src/components/shell/Container.tsx` (the one shared page width and padding: `max-w-[1360px]`, centred, 16px side padding on phones and 32px on desktop), used by the header, `main` and footer so the width is defined in one place
- [X] T016 [P] [US1] Create `src/components/shell/HoursPill.tsx`: a link to the Roadmap showing the coral ring icon from `docs/design/Library.dc.html`, the label "Hours" and a dash (—) in place of a value; draw the ring empty (track only, no coral arc) so no progress is implied; it MUST NOT show any number or time; `aria-label` says hours are not tracked yet; takes the roadmap `href` as a prop
- [X] T017 [P] [US1] Create `src/components/shell/AccountButton.tsx`: a `<button type="button" aria-label="Your account">` with the ink circle from the design and a neutral placeholder glyph; no click action
- [X] T018 [P] [US1] Create `src/components/shell/Footer.tsx` (inside `Container` from T015): `<footer>` with the lowercase `instik` name, the text `Say it: in-STICK`, links to Hosts and Pricing, and About and Privacy as plain text (not links), per `docs/design/Landing.dc.html`; takes the hosts `href` as a prop
- [X] T019 [P] [US1] Create `src/components/shell/MainNav.tsx` (`"use client"`): `<nav aria-label="Main">` with Library, Roadmap and Hosts links built with `src/lib/routes.ts`; uses `usePathname()` and `languageSlugFromPathname` to pick the current language, falling back to `defaultLanguage.slug` outside language paths; sets `aria-current="page"` and the `coral-tint` pill on the current item using an exact section match only: Library when the path is `/learn/<slug>`, Roadmap when it is `/learn/<slug>/roadmap`, Hosts when it is `/learn/<slug>/hosts`; `/watch`, `/done` and all language-independent paths mark no item. Accept the default slug as a prop from the server so the client does not import the language data
- [X] T020 [US1] Create `src/components/shell/Header.tsx`: wordmark link to `/` (`instik`, Nunito 800, ink), `MainNav` inside `<Suspense>` with a non-marked fallback nav, a spacer, `HoursPill` and `AccountButton`, as in `docs/design/Library.dc.html`, laid out inside `Container` from T015 (depends on T015, T016, T017, T019)
- [X] T021 [US1] Create `src/components/shell/ShellFrame.tsx` rendering `SkipLink`, `Header`, `<main id="main" tabIndex={-1}>` (inside `Container`) around `children`, and `Footer`, passing `defaultLanguage.slug`-based hrefs from `src/lib/languages.ts`; then create `src/app/(shell)/layout.tsx` that renders `ShellFrame` around `children`. `ShellFrame` is the only place the header and footer are composed (depends on T015, T018, T020)
- [X] T022 [US1] Move the landing page: delete the scaffold `src/app/page.tsx` and create `src/app/(shell)/page.tsx` using `PlaceholderPage` ("Instik", tagline "Your scroll time, but it counts.", note that the page is on its way) with metadata title `Instik — Your scroll time, but it counts.`, plus a link to Library (depends on T014, T021)
- [X] T023 [P] [US1] Create `src/app/(shell)/onboarding/page.tsx` using `PlaceholderPage` (title "Get started", title metadata `Get started · Instik`) with a link back to `/` (depends on T014, T021)
- [X] T024 [P] [US1] Create `src/app/(shell)/pricing/page.tsx` using `PlaceholderPage` (title "Pricing", metadata `Pricing · Instik`) with a link back to `/` (depends on T014, T021)
- [X] T025 [P] [US1] Create `src/app/(shell)/learn/[language]/page.tsx` using `PlaceholderPage` (title "Library", metadata `Library · Instik`) with a link to Roadmap built from `roadmapPath`; do not read `params` here (depends on T014, T021)
- [X] T026 [P] [US1] Create `src/app/(shell)/learn/[language]/watch/page.tsx` using `PlaceholderPage` (title "Watch", metadata `Watch · Instik`) with a link to Library (depends on T014, T021)
- [X] T027 [P] [US1] Create `src/app/(shell)/learn/[language]/done/page.tsx` using `PlaceholderPage` (title "Done for today", note "That's enough for today. See you tomorrow.", metadata `Done for today · Instik`) with a link to Roadmap (depends on T014, T021)
- [X] T028 [P] [US1] Create `src/app/(shell)/learn/[language]/roadmap/page.tsx` using `PlaceholderPage` (title "Roadmap", metadata `Roadmap · Instik`) with a link to Library (depends on T014, T021)
- [X] T029 [P] [US1] Create `src/app/(shell)/learn/[language]/hosts/page.tsx` using `PlaceholderPage` (title "Hosts", metadata `Hosts · Instik`) with a link to Library (depends on T014, T021)
- [X] T030 [P] [US1] Write `tests/unit/MainNav.test.tsx` with `usePathname` mocked: Library, Roadmap and Hosts render with correct hrefs for the default language; on `/learn/arabic-egyptian` only Library has `aria-current="page"`; on `/learn/arabic-egyptian/roadmap` only Roadmap does; on `/learn/arabic-egyptian/hosts` only Hosts does; on `/learn/arabic-egyptian/watch`, `/learn/arabic-egyptian/done`, `/pricing` and `/` none do (depends on T019)
- [X] T031 [P] [US1] Write `tests/unit/PlaceholderPage.test.tsx` (renders exactly one `h1`, the note, and the back link) and `tests/unit/route-links.test.tsx` (SC-001): with `usePathname` mocked, render `ShellFrame` and each of the eight placeholder pages for `/`, `/onboarding`, `/pricing` and the five `/learn/arabic-egyptian` paths, collect every `href` from the rendered links, build a link graph, and assert that all eight screens are reachable from `/` by following links only and that no collected internal `href` points outside the routes in `src/lib/routes.ts`. The pages are synchronous and do not read `params`, so they render in Vitest (depends on T014, T021–T029)
- [X] T032 [US1] Run `npm run dev` and walk all eight screens from `/` using links only (quickstart.md section 4); confirm shared header and footer, unique titles, one `h1` each and no dead ends; fix any gaps found

**Checkpoint**: User Story 1 is fully functional and testable on its own (placeholder styling is token-based but not yet design-reviewed)

---

## Phase 4: User Story 2 - See the Instik look on every page (Priority: P1)

**Goal**: The shell matches the approved designs and meets the accessibility rules, so later screens only add content.

**Independent Test**: Compare the shell with `docs/design/Library.dc.html` and `Landing.dc.html` at 375px and 1280px; run a keyboard-only pass and an automated accessibility scan.

- [X] T033 [US2] Compare and adjust `src/components/shell/Header.tsx`, `MainNav.tsx`, `HoursPill.tsx` and `AccountButton.tsx` against `docs/design/Library.dc.html`: page width comes only from the shared `Container` (do not repeat width or padding values here), 24px gaps, nav links `px-3.5 py-2.5` with `radius-md` and label weight, pill `radius-pill` with `shadow-sm`, account button 44×44 round in ink with cream glyph, header bottom border `hairline`; use only token utilities, no hard-coded hex values
- [X] T034 [US2] Compare and adjust `src/components/shell/Footer.tsx` against `docs/design/Landing.dc.html`: wordmark in Nunito 800, `slate` text at 14px, flex-wrap with 24px gap, links in `slate`; ensure the footer text meets 4.5:1 contrast on cream
- [X] T035 [US2] Update `src/app/globals.css`: add a visible `:focus-visible` outline in `ink` (2px with offset) for all interactive elements, and a `@media (prefers-reduced-motion: reduce)` rule removing transitions and animations; limit any transitions in components to colour changes
- [X] T036 [US2] Update `src/components/shell/ShellFrame.tsx` and `src/components/PlaceholderPage.tsx` so `main` uses the shared `Container` (same width and padding as the header, no duplicated values), section spacing `space-12`, `title` style for the `h1`, and `body-lg` for the note
- [ ] T037 [US2] Verify touch targets and responsiveness: every nav link, the Hours pill, the account button, the skip link and in-page links are at least 44px tall; resize from 1280px to 320px with no horizontal scroll and a clean header wrap (quickstart.md section 5); block the font requests in the browser dev tools and confirm text stays readable in the fallback fonts and the layout holds (FR-019); fix any failures
- [ ] T038 [US2] Run a keyboard-only walkthrough (skip link first, then wordmark, nav, pill, account button; visible focus) and an automated accessibility scan on all eight screens; fix any contrast or semantics failures, and confirm coral is used only as a fill with ink labels

**Checkpoint**: User Stories 1 and 2 both work; the shell passes design and accessibility review

---

## Phase 5: User Story 3 - Languages as data, with language-scoped pages (Priority: P2)

**Goal**: Language pages resolve from the data file, coming-soon and unknown slugs are handled kindly, and bad data fails the build.

**Independent Test**: `/learn/arabic-egyptian` loads; `/learn/spanish` shows a coming-soon notice; `/learn/nope` is a 404 page; an added language works with no code change; an invalid file fails `npm run build`.

- [X] T039 [P] [US3] Create `src/components/ComingSoonNotice.tsx`: a Server Component showing the language name and "coming soon" in the brand voice, with a link back to `/`; no waitlist form (out of scope)
- [X] T040 [US3] Create `src/app/(shell)/learn/[language]/layout.tsx`: export `generateStaticParams` returning every slug from `languages` in `src/lib/languages.ts`; set `dynamicParams = false`; do not `await params` at the top level: pass the `params` promise to a child inside `<Suspense>` that awaits it, calls `notFound()` when `getLanguageBySlug` returns `undefined`, renders `ComingSoonNotice` instead of `children` when the language is not available, and otherwise renders `children`. Check `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md` for where `dynamicParams` may be exported (depends on T009, T039)
- [X] T041 [P] [US3] Create `src/app/not-found.tsx` rendering `ShellFrame` from T021 around its content (it sits outside the `(shell)` route group, so it does not get the layout automatically): `h1` "We can't find that page", a short brand-voice sentence and a link back to `/`. Do not copy the header or footer markup. Check `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/not-found.md`; if unmatched URLs such as `/nope` do not reach this file, add `global-not-found` as that page describes, also using `ShellFrame` (depends on T021)
- [X] T042 [US3] Verify routing behaviour from contracts/routes.md in `npm run build && npm run start`: `/learn/arabic-egyptian` and `/learn/arabic-egyptian/hosts` render; `/learn/spanish` shows the notice with status 200; `/learn/nope`, `/learn/ARABIC-EGYPTIAN` (slugs are lowercase only), `/learn` and `/nope` all return status 404 with the shared header and footer; fix any mismatch (depends on T040, T041)
- [X] T043 [US3] Verify invalid data fails the build (quickstart.md section 2): set a bad slug, then set both languages to `coming-soon`; confirm each fails `npm run build` with the message from contracts/languages.md; revert `content/languages.json`
- [X] T044 [US3] Verify a new language needs data only (quickstart.md section 3): add a temporary `french` coming-soon entry, rebuild, open `/learn/french`, then revert `content/languages.json`

**Checkpoint**: User Stories 1, 2 and 3 work independently

---

## Phase 6: User Story 4 - Arabic reads correctly inside the English interface (Priority: P2)

**Goal**: One shared component renders target-language text with its own direction, language code, fonts and size.

**Independent Test**: A sample Arabic line with tashkeel next to English renders right-to-left with every vowel mark visible, about 1.4× the English size, with `dir="rtl"` and `lang="arz"`; the surrounding page stays left-to-right.

- [X] T045 [P] [US4] Create `src/components/TargetText.tsx`: a Server Component with props `language: Language`, `children: string`, optional `variant: "ui" | "transcript"` (default `"ui"`). It renders one element with `dir={language.direction}`, `lang={language.code}`, `unicode-bidi: isolate`, the font family from `language.fonts.ui` or `.transcript`, and for `script: "arabic"` the `arabic-ui` text style (UI) or `transcript` style (transcript, Naskh 26px/48px); for `latin` it uses `body`. Children are passed through unchanged (no stripping of tashkeel)
- [X] T046 [P] [US4] Write `tests/unit/TargetText.test.tsx`: Egyptian Arabic renders `dir="rtl"` and `lang="arz"`; the `transcript` variant uses the Naskh class; Spanish renders `dir="ltr"` and `lang="es"`; the string `إزَّيَّك؟ عامل إيه النهارده؟` appears unchanged with all tashkeel marks; the same mechanism works for a synthetic `ltr` language (depends on T045)
- [ ] T047 [US4] Verify visually (quickstart.md section 6): temporarily render a `TargetText` sample beside English on a placeholder page, confirm right-to-left flow, no clipped or colliding vowel marks, balanced size and line height, header and surrounding text still left-to-right, then remove the sample. You are a native Egyptian Arabic reader, so this check counts as the Arabic-reader review required by SC-007; record the result in the task notes (depends on T045)

**Checkpoint**: All four user stories work independently

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final gates and cleanup

- [X] T048 Remove unused scaffold assets (`public/*.svg` not referenced anywhere, default favicon only if replaced) after confirming with a search that nothing references them
- [X] T049 Run `npm run lint`, `npm run typecheck`, `npm test` and `npm run build`; fix every failure
- [ ] T050 Run the complete `specs/001-app-foundation-shell/quickstart.md` and tick each success criterion SC-001 to SC-008 in `spec.md`; record any gaps as notes at the end of this file

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Setup; blocks all stories
- **US1 (Phase 3)**: depends on Foundational
- **US2 (Phase 4)**: depends on US1 (it refines the shell components)
- **US3 (Phase 5)**: depends on Foundational and on US1 for the shell and `[language]` pages (T021, T041)
- **US4 (Phase 6)**: depends only on Foundational (T005, T007, T009); can run in parallel with US1 to US3
- **Polish (Phase 7)**: depends on all stories

### Within Phases

- T001 and T002 before T003; T003 before running any test script
- T006 and T007 before T009; T005 before T010
- T014 to T019 before T020 (T015 supplies `Container` to T018 and T020); T020 before T021; T021 (`ShellFrame`) before every page and before T041
- Tests are written alongside their module and must pass before the phase checkpoint

### Parallel Opportunities

- Setup: T004 alongside T001 to T003
- Foundational: T005, T006, T007, T008 together; then T011, T012, T013 together
- US1: T014 to T019 together; then T023 to T029 together; T030 and T031 together (T031 also needs T021–T029 for the route-link test)
- US3: T039 and T041 together
- US4: T045 and T046 together, and the whole story alongside US1 to US3

## Parallel Example: User Story 1

```text
Task: "Create PlaceholderPage in src/components/PlaceholderPage.tsx"
Task: "Create SkipLink in src/components/shell/SkipLink.tsx"
Task: "Create HoursPill in src/components/shell/HoursPill.tsx"
Task: "Create AccountButton in src/components/shell/AccountButton.tsx"
Task: "Create Footer in src/components/shell/Footer.tsx"
Task: "Create MainNav in src/components/shell/MainNav.tsx"
```

## Implementation Strategy

### MVP First (User Stories 1 and 2)

1. Complete Phase 1 and Phase 2
2. Complete Phase 3 (US1) and validate the walkthrough
3. Complete Phase 4 (US2): the shell is the thing later specs build on, so it ships only after the look and accessibility pass
4. **STOP and VALIDATE**, then continue

### Incremental Delivery

1. Setup + Foundational: tokens, fonts, language data, route helpers
2. US1: navigable placeholders
3. US2: design-faithful and accessible shell
4. US3: language routing, coming-soon and not-found handling
5. US4: Arabic text component (can start any time after Foundational)
6. Polish and full quickstart

## Notes

- [P] tasks touch different files and have no unfinished dependencies
- Commit after each task or logical group, and keep changes small (constitution IX)
- Do not add anything outside the eight MVP screens and the not-found page (constitution I)
- Verification tasks (T032, T037, T038, T042 to T044, T047, T050) are manual or command checks; any fix they trigger belongs to the same story

## Implementation notes

- T001/T002: `@types/node` was raised from `^20` to `^22` in the same install because vitest 5 declares a peer range that excludes 20.
- T040: `dynamicParams` is not available with `cacheComponents` (see `dynamicParams.md`), so it is not exported. The layout also awaits `params` directly instead of inside `<Suspense>`: with the Suspense version `/learn/nope` streamed a not-found body with status 200, and the contract requires 404. The build passes and unknown slugs now return 404.
- T032: covered by `tests/unit/route-links.test.tsx` (link graph reaches all eight screens) plus `curl` status and title checks against `next start`; not done in a real browser.
- Task font variables are `--nf-*` (set by `next/font`) so the `@theme` tokens `--font-naskh` etc. do not reference themselves.
- NOT DONE, need a browser: T037 (touch targets, 320px, blocked fonts), T038 (keyboard walkthrough, axe scan), T047 (Arabic visual review, SC-007), and the visual parts of T050 (quickstart and ticking SC-001 to SC-008 in spec.md).

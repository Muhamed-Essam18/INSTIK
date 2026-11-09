---

description: "Task list for Marketing Pages"
---

# Tasks: Marketing Pages

**Input**: Design documents from `/specs/006-marketing-pages/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included. The constitution (IX) requires tests for core logic. Tests live in `tests/unit/<area>/` (Vitest includes `tests/**/*.test.{ts,tsx}`).

**Organization**: Grouped by user story. US1 and US2 are both P1; US1 delivers the landing page without the waitlist card and US2 adds the waitlist to it.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 to US5 from spec.md

**Before writing any Next.js code**: read the relevant guide in `node_modules/next/dist/docs/` (AGENTS.md). Use design tokens from `src/app/globals.css` only; coral is a fill with ink labels and `coral-text` for coral text.

---

## Phase 1: Setup

- [X] T001 [P] Add the Nunito ExtraBold font file (SIL OFL) at `src/assets/fonts/Nunito-ExtraBold.ttf`, with the licence text beside it in `src/assets/fonts/OFL.txt`; used only by the share image
- [X] T002 [P] Add French as a `coming-soon` entry in `content/languages.json` (code `fr`, slug `french`, name `French`, nativeName `Français`, script `latin`, direction `ltr`, fonts `sans`/`sans`, transcriptLayers `["script","english"]`), matching the Spanish entry; run the build-time schema to confirm it validates
- [X] T003 [P] Create `src/lib/site.ts` exporting `siteName` ("Instik"), `tagline` ("Your scroll time, but it counts."), and `siteUrl()` that returns `SITE_URL`, else `https://${VERCEL_PROJECT_PRODUCTION_URL}`, else `http://localhost:3000` (reads `process.env` directly; must not import `src/lib/env.ts`, so `next build` needs no secrets); document `SITE_URL` as an optional setting in `.env.example`
- [X] T004 [P] Extend `src/lib/routes.ts`: add `aboutPath = () => "/about"`, `privacyPath = () => "/privacy"`, `howItWorksPath = () => "/#how-it-works"`, `waitlistPath(code?: string)` returning `/#waitlist` or `/?language=<code>#waitlist`; add About, Privacy to the `screens` list
- [X] T005 Add the `WaitlistEntry` model to `prisma/schema.prisma` exactly as in data-model.md (`id` cuid, `languageCode`, `email`, `createdAt` default now, `@@unique([languageCode, email])`, `@@index([languageCode])`) and update the `SignInAttempt` comment to say it also holds the waitlist limit; run `npm run db:migrate -- --name waitlist` and commit the generated migration

---

## Phase 2: Foundational (blocks all user stories)

**Purpose**: the marketing frame, the session-aware call to action, and moving the existing placeholder routes.

- [X] T006 [P] Create `src/lib/marketing/start-destination.ts`: pure `startDestination(learner: unknown, defaultSlug: string): string` returning `onboardingPath()` when signed out and `libraryPath(defaultSlug)` when signed in
- [X] T007 [P] Create `tests/unit/marketing/start-destination.test.ts`: signed out gives `/onboarding`; signed in gives `/learn/arabic-egyptian`
- [X] T008 [P] Create `src/lib/marketing/copy.ts` with a typed `landing` object (all landing text from `docs/design/Landing.dc.html`: hero, pillars, how it works, four stages, Is this AI?, final call to action; the waitlist text is added in T031), a `nav` object (How it works, Hosts, Pricing), and the footer links; exact copy from the design, no internal level names, no streak or urgency wording
- [X] T009 [P] Create `tests/unit/marketing/brand-copy.test.ts` that walks every string in `src/lib/marketing/copy.ts` and fails on: "streak", "hurry", "limited time", "countdown", "Superbeginner", "Beginner", "Intermediate", "Advanced", and any `$`, `€` or `£` price
- [X] T010 Create `src/components/marketing/StartLink.tsx`: async server component that calls `getLearner()` from `src/lib/session.ts` and renders a link to `startDestination(...)` using the default language slug; export `StartLinkFallback` (plain link to onboarding) and a wrapper `StartCta` that renders `StartLink` inside `Suspense` with that fallback; takes `className` and `children`
- [X] T011 [P] Create `src/components/marketing/MarketingHeader.tsx`: wordmark link to `/`, nav (How it works → `howItWorksPath()`, Hosts → `hostsPath(defaultLanguage.slug)`, Pricing → `pricingPath()`), "Log in" link to `signInPath()` shown only to signed-out visitors (server component behind `Suspense`, empty fallback), and the "Start watching free" button via `StartCta`; layout and type per the design; 44px targets, visible focus
- [X] T012 [P] Create `src/components/marketing/MarketingFooter.tsx`: wordmark, "Say it: in-STICK", links About, Hosts, Pricing, Privacy (all real links via `src/lib/routes.ts`)
- [X] T013 Create `src/components/marketing/MarketingFrame.tsx` (skip link from `src/components/shell/SkipLink.tsx`, `MarketingHeader`, `<main id="main" tabIndex={-1}>`, `MarketingFooter`) and `src/app/(marketing)/layout.tsx` that renders it
- [X] T014 Move the routes: create `src/app/(marketing)/page.tsx` and `src/app/(marketing)/pricing/page.tsx` as temporary pages (title only), delete `src/app/(shell)/page.tsx` and `src/app/(shell)/pricing/page.tsx`, and confirm `/` and `/pricing` render inside the marketing frame and no route conflicts; keep a `<div id="waitlist" />` anchor until T030
- [X] T014a Update `tests/unit/public-pages-static.test.ts`: replace the removed `src/app/(shell)/page.tsx` and `src/app/(shell)/pricing` entries with `src/app/(marketing)` (all pages) and `src/components/marketing`; keep the rule that pages must not import `@/lib/session`, `@/auth` or `@/lib/db`, and allow that import only in `src/components/marketing/StartLink.tsx` and the header's log-in slot (named explicitly in the test)
- [X] T015 [P] Add `export const metadata = { robots: { index: false } }` (merging with any existing metadata) to the sign-in, onboarding and settings pages under `src/app/(shell)/`

**Checkpoint**: `npm run build` passes; `/`, `/pricing` use the marketing frame.

---

## Phase 3: User Story 1 - Understand Instik and start (Priority: P1) 🎯 MVP

**Goal**: The landing page matches the design (without the waitlist card) and every call to action routes correctly.

**Independent Test**: Quickstart scenarios 1 and 2.

- [X] T016 [P] [US1] Create `src/lib/marketing/stage-estimate.ts`: pure `stageEstimateLabel(language, stage)` returning `"[~X hours]"` when the language has no `roadmap`, when `roadmap.provisional` is true, or for `JOIN_IN`; otherwise `"about N hours"` using the stage's `upToHours`
- [X] T017 [P] [US1] Create `tests/unit/marketing/stage-estimate.test.ts`: provisional data gives the placeholder for all four stages; a non-provisional fixture gives "about 30 hours" for Hear it; `JOIN_IN` always placeholder; missing roadmap gives placeholder
- [X] T018 [P] [US1] Create `src/components/marketing/LandingHero.tsx` per the design: "Now teaching Egyptian Arabic" (built from `defaultLanguage`), the tagline as the single `h1`, supporting line, `StartCta` button, the "More languages coming. Join the waitlist for yours." link to `waitlistPath()`, and the sample card: Arabic line "القَهْوَة سُخْنَة" in an element with `dir="rtl"` and `lang="arz"` using the Arabic UI font at about 1.4× Latin size with tall line height, transliteration "il-ahwa sokhna.", translation "The coffee is hot.", the host-photo placeholder box and the hours badge "12 hours of Egyptian Arabic so far. Nice." (static sample, labelled as a sample only for assistive tech if needed)
- [X] T019 [P] [US1] Create `src/components/marketing/Pillars.tsx`: Real people (with "Meet the hosts" link to `hostsPath(defaultLanguage.slug)`), At your level, Counted, from `landing` copy
- [X] T020 [P] [US1] Create `src/components/marketing/HowItWorks.tsx` with `id="how-it-works"` and `scroll-margin-top`; heading "Pick it up the way you got your first language", three numbered steps
- [X] T021 [P] [US1] Create `src/components/marketing/Stages.tsx`: heading "Four stages. Honest estimates.", the line "Hours are estimates, not promises. Everyone moves at their own pace.", four cards (Hear it, Follow it, Understand it, Join in) with description and `stageEstimateLabel(defaultLanguage, stage)`
- [X] T022 [P] [US1] Create `src/components/marketing/IsThisAi.tsx` and `src/components/marketing/FinalCta.tsx` ("Same thumb. Different outcome." with `StartCta`); the "Is this AI?" answer is plain text under a heading
- [X] T023 [US1] Assemble `src/app/(marketing)/page.tsx` in design order: hero, pillars, how it works, stages, (waitlist slot, filled in T030), Is this AI?, final call to action; set page metadata title to the default and a 140 to 160 character description; ensure a single `h1`, no sideways scroll at 320px
- [ ] T024 [US1] Compare `/` with `docs/design/Landing.dc.html` at 375, 768 and 1440 px and fix any difference in layout, spacing, colour, type or copy; check contrast and keyboard order

**Checkpoint**: US1 works alone; CTAs go to onboarding signed out and the library signed in.

---

## Phase 4: User Story 2 - Join the waitlist for another language (Priority: P1)

**Goal**: A working waitlist with kind confirmation, duplicate-safe, reused by onboarding.

**Independent Test**: Quickstart scenarios 3, 4 and 5.

- [X] T025 [P] [US2] Create `src/lib/waitlist/options.ts`: `waitlistOptions(languages)` returning the `coming-soon` languages (`{ code, name }`) in data order followed by `{ code: "other", name: "Other" }`; and `isWaitlistCode(code, languages)`
- [X] T026 [P] [US2] Create `src/lib/waitlist/input.ts`: zod schema for `{ language, email, website }`; email uses `parseEmail` from `src/lib/auth/email.ts` (trimmed, lower-cased, "valid and at most 254 characters"); language must pass `isWaitlistCode`; `website` must be empty or absent, else flag `trap`; export `parseWaitlistInput(input)` returning `{ ok: true, language, email } | { ok: false, code: "invalid-email" | "invalid-language" } | { trap: true }`
- [X] T027 [P] [US2] Create `src/lib/waitlist/throttle-rules.ts`: pure `evaluateWaitlistThrottle({ visitorCountLastHour })` allowing at most 10 attempts per visitor per hour (`WAITLIST_LIMIT_PER_HOUR = 10`), returning `{ ok: true } | { ok: false, code: "too-many" }`
- [X] T028 [P] [US2] Create `tests/unit/waitlist/input.test.ts` (` Someone@Example.COM ` becomes `someone@example.com`; empty and malformed emails give `invalid-email`; a 255-character email is rejected; unknown language gives `invalid-language`; `other` and `fr` accepted; trap filled gives `trap`), `tests/unit/waitlist/options.test.ts` (Spanish, French, Other in that order; available languages excluded) and `tests/unit/waitlist/throttle-rules.test.ts` (10th allowed, 11th refused)
- [X] T029 [US2] Create `src/lib/waitlist/throttle.ts` (`server-only`): `checkAndRecordWaitlist(visitorId)` using the `SignInAttempt` table with key `waitlist:visitor:<sha256 of IP_HASH_SALT:visitorId>` over the last hour, then `evaluateWaitlistThrottle`, recording the attempt when allowed and deleting rows older than a day (mirror `src/lib/auth/throttle.ts`)
- [X] T030 [US2] Create `src/lib/waitlist/actions.ts` (`"use server"`): `joinWaitlist(input)` per `contracts/waitlist-action.md`: parse with T026 (trap returns `{ ok: true }` without saving), read the first `x-forwarded-for` value, apply T029, then `db().waitlistEntry.createMany({ data: [{ languageCode, email }], skipDuplicates: true })`; return `{ ok: true }` identically for new and repeated pairs; map failures to `invalid-email`, `invalid-language`, `too-many`, `failed`; never reveal duplicates
- [X] T031 [US2] Add the waitlist copy to `src/lib/marketing/copy.ts` (heading "Want another language?", body, labels, button "Join the waitlist", the note "We'll only use this to tell you when your language is ready." with link text "Privacy", and the five result messages from the contract)
- [X] T032 [US2] Create `src/components/marketing/WaitlistForm.tsx` (client): language `select` built from `waitlistOptions`, email input with label and `autocomplete="email"`, visually hidden trap input named `website` (`tabIndex={-1}`, `aria-hidden`, `autocomplete="off"`), submit button 48px high; reads `?language=` with `useSearchParams` to preselect (ignore unknown values); disables the button while sending (double press saves once); shows the warm confirmation on success in a `role="status"` region; on error shows the message in a `role="alert"` region and keeps both inputs; the note under the email field links to `privacyPath()`
- [X] T033 [US2] Create `src/components/marketing/WaitlistSection.tsx` (`id="waitlist"`, `scroll-margin-top`) wrapping the form in `Suspense` with a static form fallback, matching the design card; insert it into `src/app/(marketing)/page.tsx` after the stages and remove the temporary anchor from T014
- [X] T034 [P] [US2] Create `tests/unit/waitlist/WaitlistForm.test.tsx` with a stubbed `joinWaitlist`: preselects Spanish from `?language=es`, ignores `?language=zz`; success shows the confirmation; `invalid-email` shows its message and keeps the typed values; button disabled while pending; `failed` and `too-many` show their messages and keep the typed values; the trap field is not reachable by keyboard
- [X] T035 [US2] Update onboarding links: change `waitlistHref` in `src/lib/onboarding/copy.ts` to a function `waitlistHref(code?: string)` using `waitlistPath` from `src/lib/routes.ts`, and update `src/components/onboarding/LanguageStep.tsx` (per-language link passes `language.code`; "Something else" passes `other`) and `src/components/settings/AddLanguageList.tsx` the same way; update the two tests that expect the old link: `tests/unit/AddLanguageList.test.tsx` (line 37) and `tests/unit/OnboardingFlow.test.tsx` (line 57) now expect `/?language=<code>#waitlist` per language (`es`, `fr`) and `/?language=other#waitlist` for "Something else"
- [X] T036 [US2] Verify against the development database (quickstart scenarios 3 to 5): one row for a repeated pair in any letter case, a separate row for the same email with another language, the same confirmation each time, the eleventh quick attempt is refused

**Checkpoint**: US1 and US2 both work; the landing page is complete.

---

## Phase 5: User Story 3 - See what it costs (Priority: P2)

**Goal**: Pricing page matching the design with a working Monthly/Yearly switch and placeholder prices.

**Independent Test**: Quickstart scenarios 6 and 10.

- [X] T037 [P] [US3] Add `pricing` data to `src/lib/marketing/copy.ts`: headline "Start free. Stay because it works.", subline "No ads, no streak pressure, no tricks. Cancel any time.", Free card ("Free", "0 forever", the four items), Full access card (the five items, `priceMonthly = "[PRICE]"`, `priceYearly = "[PRICE]"`, `saving = "[Save X%]"`), and the four FAQ items with the exact answers from `docs/design/Pricing.dc.html` (the "Which languages are coming?" answer links to `waitlistPath()`)
- [X] T038 [P] [US3] Create `tests/unit/marketing/pricing-copy.test.ts`: the price and saving strings contain `[` and `]` (placeholders), no digit-currency pattern appears in any pricing string, Free has exactly four items and Full access exactly five, the FAQ has four items
- [X] T039 [P] [US3] Create `src/components/marketing/Faq.tsx` and `src/components/marketing/PlanCard.tsx` (presentational; Free and Full variants; the buttons are `StartCta` links labelled "Start watching free" and "Get full access")
- [X] T040 [US3] Create `src/components/marketing/PricingSwitch.tsx` (client): two pill buttons Monthly and Yearly with `aria-pressed`, starting on Monthly, in a group labelled "Billing period"; switches the Full access card's price and the period label ("per month" / "per year"); 44px targets and visible focus; no animation
- [X] T041 [US3] Build `src/app/(marketing)/pricing/page.tsx` per `docs/design/Pricing.dc.html`: headline as the `h1`, switch, Free card, Full access card with the saving placeholder, FAQ; set metadata title "Pricing" and a 140 to 160 character description; compare with the design at 375, 768 and 1440 px
- [X] T042 [P] [US3] Create `tests/unit/marketing/PricingSwitch.test.tsx`: Monthly is pressed at first and shows "per month"; pressing Yearly marks it pressed and shows "per year"; pressing Monthly restores it; both can be operated with the keyboard

**Checkpoint**: US3 works alone.

---

## Phase 6: User Story 4 - About and Privacy (Priority: P3)

**Goal**: Two simple pages in the brand voice.

**Independent Test**: Quickstart scenario 7.

- [X] T043 [P] [US4] Add `about` and `privacy` text to `src/lib/marketing/copy.ts`: About has the pronunciation "in-STICK", the method in plain words (learning by understanding; no drills, tests or streak panic; honest hours) and the hosts promise (real native speakers, named and visible on every video, no synthetic voices); Privacy is a short placeholder listing what is stored today (account email and name, language profile, watch hours and progress, waitlist emails used only to say when a language is ready, a salted hash of the visitor address used only for send limits), says a full policy is coming, and makes no legal or compliance claims
- [X] T044 [P] [US4] Create `src/components/marketing/Prose.tsx` (page heading as `h1`, readable measure of about 65 characters, token spacing and type)
- [X] T045 [P] [US4] Create `src/app/(marketing)/about/page.tsx` and `src/app/(marketing)/privacy/page.tsx` using `Prose`, each with its own title ("About", "Privacy") and a 140 to 160 character description; About ends with a `StartCta` button and a link to the hosts
- [X] T046 [P] [US4] Extend `tests/unit/marketing/brand-copy.test.ts` to cover the About and Privacy strings and to assert the Privacy text contains "waitlist" and "full policy" and none of "GDPR", "compliant", "certified"

**Checkpoint**: Footer links all resolve.

---

## Phase 7: User Story 5 - Sharing and search basics (Priority: P3)

**Goal**: Titles, descriptions, share image, sitemap and robots.

**Independent Test**: Quickstart scenario 8.

- [X] T047 [P] [US5] Update `src/app/layout.tsx` metadata: `metadataBase: new URL(siteUrl())`, `title: { default: "Instik — Your scroll time, but it counts.", template: "%s · Instik" }`, a default description, `openGraph` (siteName, type website, locale en) and `twitter: { card: "summary_large_image" }`; remove the old fixed `title`
- [X] T048 [P] [US5] Create `src/app/opengraph-image.tsx` (1200×630, `image/png`, `alt` export) with `ImageResponse` from `next/og`: cream `#fff4e6` background, ink `#1b2340` wordmark "instik" in the Nunito ExtraBold file read from `src/assets/fonts` (via `process.cwd()`), the tagline, a coral `#ff6a4d` accent shape; no photographs; values taken from `docs/design-tokens.json`
- [X] T049 [P] [US5] Create `src/app/sitemap.ts` returning exactly `/`, `/pricing`, `/about`, `/privacy` as absolute URLs from `siteUrl()`, and `src/app/robots.ts` per `contracts/routes-and-metadata.md` (allow `/`; disallow `/api/`, `/sign-in`, `/onboarding`, `/settings`, `/learn`; sitemap URL)
- [X] T050 [P] [US5] Create `tests/unit/marketing/seo.test.ts`: the sitemap has exactly the four marketing URLs and none of the disallowed paths; robots disallows the five paths and names the sitemap; `siteUrl()` uses `SITE_URL`, then the Vercel URL, then localhost; the root metadata template is `%s · Instik`
- [X] T051 [US5] Check every marketing page's rendered `<title>` and description are unique, and view `/opengraph-image` at 1200×630; confirm sign-in, onboarding and settings carry `noindex`

**Checkpoint**: All five stories complete.

---

## Phase 8: Polish & Cross-Cutting

- [ ] T052 Responsiveness and accessibility pass on `/`, `/pricing`, `/about`, `/privacy` at 320, 375, 768 and 1440 px: no sideways scroll, skip link first in tab order, visible focus, 44px targets, contrast at least 4.5:1, form and switch announced by a screen reader, reduced-motion respected
- [X] T053 Confirm hydration is clean (no console warnings) with the session-aware links, the waitlist's `useSearchParams` and the switch; confirm `/` and `/pricing` are prerendered in the `next build` output; measure the landing page on an emulated mid-range phone with throttled 4G (Lighthouse) and confirm the main content is readable within 2 seconds (SC-008), noting the result in quickstart.md
- [X] T054 Check no marketing page or component contains a streak, countdown, real price, internal level name or unqualified hour promise (SC-009), and every header and footer link resolves (SC-005)
- [X] T055 Run `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` (the build with no `.env.local`); fix anything that fails
- [ ] T056 Walk through all ten quickstart scenarios against the development database and note the result at the bottom of `specs/006-marketing-pages/quickstart.md`
- [ ] T057 Re-check the About, landing and Privacy copy against `docs/brand-guide.pdf` (it could not be rendered earlier) and fix voice differences

---

## Dependencies & Execution Order

- **Phase 1** has no dependencies; T001 to T004 run in parallel, T005 can run alongside them.
- **Phase 2** needs Phase 1 (routes, site, copy). T006 to T009 and T011, T012, T015 are parallel; T010 needs T006; T013 needs T011 and T012; T014 needs T013; T014a needs T010, T011 and T014.
- **US1** needs Phase 2. **US2** needs US1's page (T023) for T033 and needs T005 (model) for T030. **US3, US4** need only Phase 2 and can run in parallel with US1 and US2 (they touch different files, but all add to `copy.ts`, so merge those edits carefully). **US5** needs Phase 2 and T003; the metadata tests are independent of the other stories.
- **Polish** needs all stories.

### Within a story

Pure modules and their tests first, then components, then the page, then the design comparison.

## Parallel Opportunities

- Phase 1: T001, T002, T003, T004.
- Phase 2: T006, T007, T008, T009, T011, T012, T015.
- US1: T016 to T022 (seven files).
- US2: T025, T026, T027, T028 then T034.
- US3 to US5 can be split among people once Phase 2 is done.

## Implementation Strategy

1. **MVP**: Phases 1 and 2, then US1: a faithful landing page whose calls to action work. Stop and review against the design.
2. Add **US2** (waitlist), which also fixes onboarding's dead-end links. This completes both P1 stories.
3. Add **US3** (pricing), then **US4** and **US5** (P3) in either order.
4. Finish with Phase 8, including the brand-guide re-check.

## Notes

- Commit after each task or small group. Each phase ends at a working checkpoint.
- About and Privacy have no approved design; build them from the design system and note that in the commit (allowed for utility screens by `docs/product.md`).
- Prices, savings and hour estimates stay placeholders until product decides.

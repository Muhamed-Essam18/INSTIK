# Implementation Plan: App Foundation and Shell

**Branch**: `001-app-foundation-shell` | **Date**: 2026-11-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-app-foundation-shell/spec.md`

## Summary

Build the shared page shell, the Instik design tokens, the languages-as-data layer, a shared
target-language text component, and placeholder pages for all eight MVP screens in the existing
create-next-app project. The shell is a Server Component layout; only the navigation's
current-page marker is a client component. Language data lives in `content/languages.json`, is
validated by a schema when the app is built, and drives `generateStaticParams` for
`/learn/[language]`. Design tokens from `docs/design-tokens.json` become Tailwind v4 `@theme`
variables, so later screens use utilities and never hard-coded values. See [research.md](research.md)
for decisions.

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 19.3, Next.js 16.4.5 (App Router, `cacheComponents` and `partialPrefetching` enabled in `next.config.ts`)

**Primary Dependencies**: Tailwind CSS 4 via the existing `@tailwindcss/turbopack` rule, `next/font/google` (Nunito, Inter, IBM Plex Sans Arabic, Noto Naskh Arabic), `zod` for schema validation (new direct dependency)

**Storage**: Files only. `content/languages.json`. No database in this spec.

**Testing**: Vitest + React Testing Library (jsdom) for schema, helpers and synchronous components; `npm run lint`, `tsc --noEmit` and `next build` as gates. Async Server Components are checked through the build and the quickstart walkthrough because Vitest cannot render them.

**Target Platform**: Modern evergreen browsers, phone (320px) to desktop; deployed on Vercel

**Project Type**: Web application (single Next.js app)

**Performance Goals**: All pages in this spec are prerendered static shells; no client JavaScript beyond the navigation marker and Next runtime

**Constraints**: No horizontal scroll from 320px; contrast ≥ 4.5:1; touch targets ≥ 44px; no new route outside the eight MVP screens plus not-found; light theme only

**Scale/Scope**: 8 screens, 2 languages in data, about 12 components

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | How the plan complies |
|---|---|---|
| I. Product source of truth | Pass | Only the eight MVP screens plus not-found are built; Hosts nav goes to the host screen (clarified), no hosts index |
| II. Brand behaviours | Pass | Nothing in this spec adds feeds, streaks, notifications or autoplay; placeholder copy uses learner terms only |
| III. Honest hours | Pass (n/a) | Hours pill shows "Hours" with a dash and no number, so no tracking is implied |
| IV. Multi-language by design | Pass | `content/languages.json`, `/learn/[language]`, `TargetText` takes dir and lang from data |
| V. Arabic first-class | Pass | Fonts, 1.4× size and line height in tokens; display never alters stored tashkeel. Search normalisation is out of scope here |
| VI. Design fidelity | Pass | Tokens via Tailwind `@theme`; header/footer built from approved screens; skip link, semantic landmarks, 44px targets |
| VII. Stack discipline | Pass | One Next.js app, Server Components by default, one small client component. `zod` is the only new runtime dependency and is justified in research |
| VIII. Content as files | Pass | Language data is a file validated at build; invalid data fails the build |
| IX. Quality | Pass | Tests for schema validation and `TargetText`; lint, type-check, build gates |
| X. Privacy and security | Pass | No data collected, no secrets; slug input from URL is validated against data before use |

No violations; Complexity Tracking is not needed. Re-check after design: still passes (see end of
[data-model.md](data-model.md) and [contracts/routes.md](contracts/routes.md)).

## Project Structure

### Documentation (this feature)

```text
specs/001-app-foundation-shell/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── routes.md
│   └── languages.md
└── tasks.md             # created later by /speckit-tasks
```

### Source Code (repository root)

```text
content/
└── languages.json                 # Egyptian Arabic (available), Spanish (coming soon)

src/
├── app/
│   ├── layout.tsx                 # html/body, fonts, cream ground, skip link (replaces scaffold)
│   ├── globals.css                # Tailwind import + @theme tokens from design-tokens.json
│   ├── not-found.tsx              # friendly 404, rendered through ShellFrame
│   ├── (shell)/
│   │   ├── layout.tsx             # renders ShellFrame around children
│   │   ├── page.tsx               # Landing placeholder (/)
│   │   ├── onboarding/page.tsx
│   │   ├── pricing/page.tsx
│   │   └── learn/[language]/
│   │       ├── layout.tsx         # resolves language, coming-soon notice, notFound()
│   │       ├── page.tsx           # Library placeholder
│   │       ├── watch/page.tsx     # Player placeholder
│   │       ├── done/page.tsx      # Done for today placeholder
│   │       ├── roadmap/page.tsx
│   │       └── hosts/page.tsx     # Host placeholder
│   └── page.tsx                   # removed (moved into (shell))
├── components/
│   ├── shell/
│   │   ├── Header.tsx
│   │   ├── ShellFrame.tsx         # skip link + Header + <main id="main"> + Footer; used by (shell)/layout and not-found
│   │   ├── Container.tsx          # one shared page width and padding for header, main and footer
│   │   ├── MainNav.tsx            # client: exact-match current-section marker
│   │   ├── HoursPill.tsx          # "Hours" label with a dash, no value
│   │   ├── AccountButton.tsx
│   │   ├── Footer.tsx
│   │   └── SkipLink.tsx
│   ├── PlaceholderPage.tsx        # heading + "coming soon" note
│   └── TargetText.tsx             # dir, lang, font and size from language data
└── lib/
    ├── languages.ts               # load + validate content/languages.json, lookups
    ├── languages.schema.ts        # zod schema
    └── routes.ts                  # path builders for language-scoped routes

tests/
└── unit/
    ├── languages.schema.test.ts
    ├── languages.lookup.test.ts
    ├── routes.test.ts
    └── TargetText.test.tsx

vitest.config.mts
```

**Structure Decision**: Single Next.js app using the existing `src/` layout. A `(shell)` route group
holds every page so that the header and footer wrap them, while the root layout stays minimal and
`not-found.tsx` sits at the root and renders its content through the same `ShellFrame` component
that `(shell)/layout.tsx` uses, so the 404 page has the same header and footer. Language data is the only content file in
this spec; later specs add `content/<language>/...` beside it.

## Complexity Tracking

No constitution violations to justify.

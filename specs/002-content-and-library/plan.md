# Implementation Plan: Content and Library

**Branch**: `002-content-and-library` | **Date**: 2026-11-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-content-and-library/spec.md`

## Summary

Add the file-based content layer for each language (videos, transcripts, glossary, hosts), validated
with schemas and cross-file rules whenever the app is built, plus Egyptian Arabic sample content, the
Library screen and the host page. A server-only loader reads `content/<language>/` and returns typed,
checked data to Server Components. The Library is a Server Component page that hands a small,
pre-serialised list (with a precomputed normalised search key) to one client component that owns the
stage, topic and search state. Arabic normalisation is one pure, tested function. Host pages and a
placeholder `watch/[video]` page are statically generated from the content. No new dependencies.
Decisions are in [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 19.3, Next.js 16.4.5 (App Router, `cacheComponents` and `partialPrefetching` on)

**Primary Dependencies**: Existing only: `zod` (schemas), Tailwind 4 tokens, `next/font` setup from spec 001. The `.vtt` check is a small in-repo parser; no new runtime dependency.

**Storage**: Files under `content/<language>/`. No database.

**Testing**: Vitest + React Testing Library for normalisation, search/filter logic, VTT parser, schemas and cross-file validation (with deliberate defects), the real sample content, and synchronous components (cards, browser). `npm run lint`, `npm run typecheck` and `next build` as gates. Async Server Components are checked by the build and the quickstart.

**Target Platform**: Evergreen browsers, 320px to desktop; Vercel

**Project Type**: Web application (single Next.js app)

**Performance Goals**: All Library, host and watch-placeholder pages prerendered static. Library client data is small (tens of videos); filtering is instant, no network.

**Constraints**: No horizontal scroll from 320px; contrast ≥ 4.5:1; touch targets ≥ 44px; no infinite scroll; content loader is server-only (never bundled to the client); content errors surface at build

**Scale/Scope**: 1 language with content, 8 videos, 2 hosts, 2 transcripts now; designed for hundreds of videos per language

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | How the plan complies |
|---|---|---|
| I. Product source of truth | Pass | Builds MVP screens 3 (Library) and 7 (Host) only. Adds the `watch/[video]` placeholder route because cards must link to it; the player itself is spec 3. `/hosts` redirects to the first host rather than adding a hosts index screen |
| II. Brand behaviours | Pass | No infinite scroll, list ends with the end message, every card shows its host, no streaks or tests, learner stage names only, "Watched" is a label slot |
| III. Honest hours | Pass (n/a) | No time tracking; the banner is static and labelled by position only |
| IV. Multi-language by design | Pass | Content in `content/<language>/`, URLs under `/learn/[language]`, `dir`/`lang` from language data via `TargetText`; no Egyptian Arabic strings in code outside the sample content |
| V. Arabic first-class | Pass | One pure normalisation function (tashkeel, alef/ya/ta marbuta variants, Latin accents, case); stored text keeps tashkeel; Arabic names use the Arabic UI font at the token size |
| VI. Design fidelity | Pass | Built from Library and Host designs with the existing Tailwind tokens; real links, labelled controls, `aria-pressed` filters, 44px targets, visible focus |
| VII. Stack discipline | Pass | Server Components by default; one client component (`LibraryBrowser`) for filter/search state; no new dependency; Next docs consulted for dynamic routes and `generateStaticParams` under Cache Components |
| VIII. Content as files | Pass | Matches `docs/product.md` layout; schema plus cross-file validation fails the build |
| IX. Quality | Pass | Tests for normalisation, search, VTT, validation defects and real content; lint/type-check/build gates |
| X. Privacy and security | Pass | No learner data; route params checked against content before use (`notFound()`); playback ids are not secrets |

No violations; Complexity Tracking is not needed. Re-check after design: still passes.

## Project Structure

### Documentation (this feature)

```text
specs/002-content-and-library/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── content-files.md
│   └── routes.md
├── checklists/requirements.md
└── tasks.md             # created later by /speckit-tasks
```

### Source Code (repository root)

```text
content/
├── languages.json                      # existing
└── arabic-egyptian/                    # folder name = language slug
    ├── glossary.json
    ├── hosts/{salma,omar}.json
    └── videos/
        ├── <slug>.json                 # 8 files
        └── {my-family,at-the-cafe}.vtt # 2 sample transcripts

src/
├── app/(shell)/learn/[language]/
│   ├── page.tsx                        # Library (replaces placeholder)
│   ├── hosts/page.tsx                  # redirects to the first host
│   ├── hosts/[host]/page.tsx           # Host page, generateStaticParams from hosts
│   └── watch/[video]/page.tsx          # placeholder until spec 3, generateStaticParams from videos
├── components/
│   ├── library/
│   │   ├── LibraryBrowser.tsx          # client: stage, topic, search state, count line, end message
│   │   ├── PickUpBanner.tsx            # static banner
│   │   ├── FilterGroup.tsx             # Stage / Topic pill group (aria-pressed)
│   │   └── VideoCard.tsx               # link card; stage chip, title, "N min · with Host", Watched slot
│   ├── host/
│   │   ├── HostHero.tsx                # photo placeholder, names, story, topics, say-hello action
│   │   └── OtherHosts.tsx              # host chips + "More hosts joining soon"
│   └── shell/MainNav.tsx               # Hosts marked current on any /hosts/... path
└── lib/
    ├── routes.ts                       # + hostPath, watchVideoPath
    ├── text/normalize.ts               # pure search normalisation
    └── content/
        ├── schema.ts                   # zod schemas: video, host, glossary
        ├── taxonomy.ts                 # stages (slug ↔ label, order), topics
        ├── vtt.ts                      # parse and validate .vtt
        ├── validate.ts                 # pure cross-file validation over in-memory files
        ├── load.ts                     # server-only: read files, call validate, throw one error
        ├── index.ts                    # cached accessors: getVideos, getHosts, getHost, getVideo...
        └── search.ts                   # pure filterVideos({stage, topic, query})

tests/unit/
├── normalize.test.ts
├── content.schema.test.ts
├── content.validate.test.ts            # one case per defect type in the spec
├── content.real.test.ts                # loads the shipped sample content
├── vtt.test.ts
├── search.test.ts
├── LibraryBrowser.test.tsx
├── VideoCard.test.tsx
├── HostHero.test.tsx
└── routes.test.ts                      # extended
```

**Structure Decision**: Extends the existing `src/` layout and `(shell)/learn/[language]` tree from
spec 001. Content loading is split into pure pieces (schema, taxonomy, vtt, validate, search,
normalize) that tests can exercise with in-memory data, and one thin server-only file (`load.ts`)
that touches the file system. Pages import accessors from `content/index.ts`, so any invalid file
throws during `next build`.

## Complexity Tracking

No constitution violations to justify.

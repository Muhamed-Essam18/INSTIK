# Implementation Plan: Marketing Pages

**Branch**: `006-marketing-pages` | **Date**: 2026-11-08 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/006-marketing-pages/spec.md`

## Summary

Replace the landing and pricing placeholders with the approved designs, add About and Privacy, make the waitlist real, and add share and search basics, without a new runtime dependency.

- **A marketing frame, separate from the app shell.** The landing, pricing, About and Privacy pages move into a `(marketing)` route group with their own header (How it works, Hosts, Pricing, Log in, Start watching free) and footer, as the designs show. The app shell (Library, Roadmap and so on) is untouched.
- **Static pages, one dynamic corner.** The pages are statically rendered. Anything that depends on the session (the header's "Log in" and every "Start watching free" button) sits in a small server component behind `Suspense` with a working signed-out fallback pointing at onboarding, the same pattern as the app header's `UserSlot`. Signed-in learners get the library.
- **One call-to-action component.** A single `StartLink` decides between onboarding and the library, so all buttons (header, hero, pricing cards, final call to action) behave the same.
- **Waitlist as a server action.** `joinWaitlist` parses the input with zod, drops spam caught by a hidden trap field, applies a small per-visitor limit, and inserts with the unique pair `(language, email)` so a repeat is a quiet success. The visitor always sees the same kind confirmation. The form is a small client component that reads `?language=` from the URL (inside `Suspense`, so the landing page stays static) to preselect a language.
- **Onboarding link fix.** The existing "Join the waitlist" links in onboarding and Add a language gain `?language=<code>#waitlist`; "Something else" gains `language=other`.
- **Pricing is data plus one switch.** A `pricing` copy module holds the plan items, FAQ and placeholder prices; one client component holds the Monthly/Yearly state. Without scripts it shows Monthly.
- **Share and search.** Per-page `metadata`, a code-generated brand `opengraph-image`, `sitemap.ts` and `robots.ts`, and `noindex` on sign-in, onboarding and settings.

See [research.md](research.md) for decisions.

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 19.3, Next.js 16.4.5 (App Router, `cacheComponents` on), Node 24

**Primary Dependencies**: Existing only: `zod`, Prisma 7 with `@prisma/adapter-pg`, Tailwind 4 tokens, Vitest, `next/og` (part of Next). **No new runtime dependencies.** One font file (Nunito ExtraBold, SIL OFL) is added as a static asset for the share image.

**Storage**: PostgreSQL through Prisma: one new model, `WaitlistEntry` (unique on language and email). The per-visitor limit reuses the existing `SignInAttempt` bookkeeping table with a `waitlist:` key prefix, so there is no second limit table. Stage estimates and waitlist languages come from `content/languages.json`.

**Testing**: Vitest. Pure modules carry the logic and are tested directly: waitlist input parsing and normalisation, the waitlist limit rule, waitlist language options from data, stage estimate labels (placeholder versus real), pricing plan data (no real amounts), the start-link destination rule, and the sitemap and robots outputs. Components (switch, waitlist form states, start link fallback) are tested with a stubbed server action. The database path (unique pair, repeat is success) is checked in the [quickstart](quickstart.md) against the development database, as in specs 4 and 5.

**Target Platform**: Evergreen browsers 320px and up; Vercel with Neon Postgres

**Project Type**: Web application (single Next.js app, no separate backend)

**Performance Goals**: Landing and pricing prerendered; main content readable within 2 seconds on a typical mobile connection (SC-008). No client JavaScript is needed to read any page; the only client code is the pricing switch, the waitlist form and the start-link session check. Fonts are the four already loaded by the root layout; no images over the fold except the host-photo placeholder from the design.

**Constraints**: `next build` and tests pass with no `.env.local`; the waitlist action validates every input and never reveals whether a pair already existed; no hydration mismatches; 44px targets; contrast at least 4.5:1; brand voice; no streaks, countdowns, urgency or real prices anywhere.

**Scale/Scope**: 4 pages (landing, pricing, About, Privacy), 1 frame (header and footer), about 12 components, 1 server action, 1 model, 5 small pure modules, 1 generated image, sitemap and robots.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | How the plan complies |
|---|---|---|
| I. Product source of truth | Pass | MVP screens 1 (Landing) and 8 (Pricing) from `Landing.dc.html` and `Pricing.dc.html`. About, Privacy, share image and sitemap are named in the spec; Privacy and About have no design and are built from the design system, as `docs/product.md` allows for utility screens (noted in tasks). No payments, no emailing |
| II. Brand behaviours | Pass | No streaks, countdowns or urgency; hours always "estimates"; stage names only, no internal levels; no infinite scroll; honest copy ("We'll only use this to tell you when your language is ready"); no email is sent |
| III. Honest hours | Pass (n/a) | No hours are counted or changed; stage estimates are labelled estimates and show a placeholder while provisional |
| IV. Multi-language by design | Pass | Waitlist choices come from language data; the entry carries a language code; the hero's Arabic line keeps its own `dir`/`lang`; no hard-coded language logic beyond the "Now teaching" line, which reads the default available language |
| V. Arabic first-class | Pass | The hero sample uses the Arabic UI font and tashkeel in an RTL block with `lang="arz"`, sized about 1.4× Latin with tall line height. No normalisation is needed (no search) |
| VI. Design fidelity | Pass | Built from the two approved screens with tokens only; coral is a fill with ink labels and `coral-text` for coral text (the design's `#c2412a` link colour is `coral-text`). Switch and form are keyboard-operable with visible focus. About and Privacy follow the system |
| VII. Stack discipline | Pass | Server Components by default; client only for the switch, waitlist form and session-aware link. Server action for the one mutation. Next docs read: metadata file conventions (opengraph-image, sitemap, robots), route groups, `Suspense` with Cache Components |
| VIII. Content as files | Pass | Waitlist languages and estimates come from `content/languages.json` (one `coming-soon` entry added for French, validated by the existing schema); waitlist entries live in the database, never in `content/` |
| IX. Quality | Pass | Tests for the parsing, limit, options, labels and sitemap/robots; lint, type-check and build gates |
| X. Privacy and security | Pass | Only language, normalised email and join date are stored; the limit stores a salted hash of the visitor address (existing practice) and nothing else; the action parses all input with zod; the response never reveals whether an email was already listed; no secret reaches the client |

No violations. Re-check after design: still passes (see [data-model.md](data-model.md) and [contracts/](contracts/)).

## Project Structure

### Documentation (this feature)

```text
specs/006-marketing-pages/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── waitlist-action.md
│   └── routes-and-metadata.md
├── checklists/requirements.md
└── tasks.md             # created by /speckit-tasks
```

### Source Code (repository root)

```text
content/languages.json                      # + French as coming-soon
prisma/schema.prisma                        # + WaitlistEntry (migration)
public/ (none)                              # no static images added
src/
├── app/
│   ├── layout.tsx                          # + metadataBase, title template, default description
│   ├── opengraph-image.tsx                 # brand share image (1200×630), + opengraph-image.alt.txt
│   ├── sitemap.ts
│   ├── robots.ts
│   ├── (shell)/
│   │   ├── page.tsx                        # REMOVED (landing moves)
│   │   └── pricing/page.tsx                # REMOVED (pricing moves)
│   ├── (marketing)/
│   │   ├── layout.tsx                      # MarketingFrame
│   │   ├── page.tsx                        # Landing
│   │   ├── pricing/page.tsx
│   │   ├── about/page.tsx
│   │   └── privacy/page.tsx
│   ├── (shell)/sign-in, onboarding, settings   # + robots noindex in metadata
├── components/
│   └── marketing/
│       ├── MarketingFrame.tsx              # skip link, header, main, footer
│       ├── MarketingHeader.tsx
│       ├── MarketingFooter.tsx
│       ├── StartLink.tsx                   # session-aware call to action (server, in Suspense)
│       ├── LandingHero.tsx, Pillars.tsx, HowItWorks.tsx, Stages.tsx, IsThisAi.tsx, FinalCta.tsx
│       ├── WaitlistSection.tsx             # wraps the form, anchor id="waitlist"
│       ├── WaitlistForm.tsx                # client: language, email, trap field, states
│       ├── PricingSwitch.tsx               # client: Monthly/Yearly + Full access card
│       ├── PlanCard.tsx, Faq.tsx
│       └── Prose.tsx                       # About and Privacy body
├── lib/
│   ├── site.ts                             # site URL, name, tagline
│   ├── routes.ts                           # + aboutPath, privacyPath, waitlistPath(code)
│   ├── onboarding/copy.ts                  # waitlistHref → function
│   ├── marketing/
│   │   ├── copy.ts                         # landing, about, privacy, pricing text and plan data
│   │   ├── stage-estimate.ts               # label: placeholder vs real
│   │   └── start-destination.ts            # onboarding vs library rule
│   └── waitlist/
│       ├── input.ts                        # zod parse + normalise + language check
│       ├── options.ts                      # language options from data
│       ├── throttle-rules.ts               # pure per-visitor limit
│       ├── throttle.ts                     # server-only; uses SignInAttempt
│       └── actions.ts                      # "use server": joinWaitlist
└── assets/fonts/Nunito-ExtraBold.ttf       # for the share image only
```

**Structure Decision**: One Next.js app with a new `(marketing)` route group beside `(shell)`. The two groups share the root layout (fonts, tokens). Marketing pages must not render the app header's Hours pill or main nav, which is why they get their own frame instead of reusing `ShellFrame`. Logic stays in small pure modules under `src/lib/marketing` and `src/lib/waitlist`; components stay presentational.

## Complexity Tracking

No constitution violations to justify. One deliberate reuse worth noting: the waitlist limit writes to the existing `SignInAttempt` table (a generic key and timestamp) instead of adding a table; its comment is updated to say so.

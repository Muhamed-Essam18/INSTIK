<!--
Sync Impact Report
Version change: (template, unversioned) → 1.0.0
Modified principles: none renamed (initial adoption; all principles new)
Added sections: Core Principles I–X, Technical Constraints, Development Workflow & Quality Gates,
  Governance
Removed sections: none
Deferred items:
  - docs/brand-guide.pdf could not be rendered during drafting (pdftoppm missing); voice and
    behaviours were taken from docs/product.md and docs/design-system.md, which restate it.
    Re-check against the PDF.
  - docs/design-tokens.json was not read during drafting; verify token names against it.
  - Open product decisions (prices, transliteration standard, hour estimates, video host,
    payment provider) remain in docs/product.md "Still to decide".
-->
# Instik Constitution

## Core Principles

### I. Product Source of Truth
`docs/product.md` defines scope. The brand guide defines voice and product behaviours.
`docs/design/` holds the approved screens. Where documents conflict, `docs/product.md` wins.
No feature outside the MVP list in `docs/product.md` may be built until `docs/product.md` is
updated to include it. Every spec MUST trace to an MVP screen or behaviour.

### II. Brand Behaviours Are Requirements
These are acceptance criteria, not polish, and MUST be enforced by the product:
- No infinite scroll. Every list and session has a visible end.
- Every session ends with "Done for today".
- No streaks. Progress over time is shown only as a rhythm view of days watched.
- The level check is optional and never forced. There are no tests by default.
- Autoplay-next is off by default.
- Notifications and reminders are off by default, rare and kind.
- Every video shows its host.
- Learner copy follows the brand voice (short, warm, honest, never shaming). Hour thresholds are
  always called "estimates". Learner-facing terms are Hours, Roadmap, Hosts, Up next and
  Done for today. Stages are Hear it → Follow it → Understand it → Join in. Internal levels
  (Superbeginner, Beginner, Intermediate, Advanced) MUST NOT appear in learner copy.

### III. Honest Hours
Only watch time where the video is playing AND the tab is visible counts toward Hours. Paused,
buffering, hidden-tab and background time MUST NOT be counted. Hours, level and rhythm are
tracked per language, never pooled across languages. Counting logic MUST be isolated in a pure,
tested module.

### IV. Multi-Language by Design
Languages are data in `content/languages.json`; adding a language is adding data, not code. Every
learner-facing record (progress, level, hours, rhythm, sessions, preferences, waitlist) belongs
to a language. URLs include the language slug (e.g. `/learn/arabic-egyptian/...`). Layout MUST
support both RTL and LTR target languages. The interface is English LTR; every target-language
block sets its own `dir` and `lang` (Egyptian Arabic: `dir="rtl"`, `lang="arz"`). Language-specific
behaviour MUST NOT be hard-coded outside the language's data and its dedicated helpers.

### V. Arabic Is First-Class
Arabic is stored with full tashkeel. Search and word matching strip tashkeel and normalise letter
variants (e.g. أ/إ/ا) without altering stored text. Arabic is visually balanced with Latin text:
about 1.4× the Latin size with tall line height so vowel marks never collide. Use the design
system fonts: IBM Plex Sans Arabic for Arabic UI and Noto Naskh Arabic for transcripts.
Normalisation MUST be a pure, tested function.

### VI. Design Fidelity
Build from `docs/design-tokens.json` through Tailwind; do not hard-code colours, sizes or spacing
that a token covers. Match the approved screens for layout, spacing, colour, type and copy.
- Coral is a fill with ink labels, never small text (use `coral-text` for coral text).
- Text contrast MUST be at least 4.5:1 and touch targets at least 44px.
- Use real semantic elements and provide full keyboard access, visible focus and labelled controls.
- Motion is calm and short; no bouncing or confetti.
Deviation from an approved screen requires updating the design first.

### VII. Stack Discipline
Next.js App Router, React, TypeScript (strict), the Tailwind version installed by create-next-app,
PostgreSQL with Prisma, Auth.js (Google and email magic link), Mux or Cloudflare Stream, Stripe
or Paddle, hosted on Vercel. One Next.js app; no separate Express or other backend server. Prefer
Server Components; use client components only for interactivity. Read the relevant guide in
`node_modules/next/dist/docs/` before writing Next.js code, because this version has breaking
changes (see `AGENTS.md`). New runtime dependencies need a stated reason.

### VIII. Content as Files
There is no admin panel in the MVP. Video metadata, transcripts (`.vtt`), glossaries and hosts
live under `content/` as defined in `docs/product.md` and are validated against a schema at build
time; invalid content MUST fail the build. Learner data lives in the database, never in
`content/`.

### IX. Quality and Small Changes
Each feature ships with tests for its core logic (hours counting, transcript sync, Arabic
normalisation, access rules as applicable) and MUST pass lint, type-check and build before
merge. Keep changes small: one spec at a time, one reviewable change per task.

### X. Privacy and Security
Collect only the data the product needs. Never expose secrets to the client; only explicitly
public variables reach the browser. Validate all server inputs (actions, route handlers,
webhooks) with schemas, and enforce access (free vs full, ownership of learner data) on the
server.

## Technical Constraints

- Open decisions (prices and free/full split, transliteration standard, roadmap hour estimates,
  video host, payment provider) MUST use clearly marked placeholders and sit behind a thin
  interface until decided.
- Photography and imagery follow the design system: real hosts, never AI-generated faces or
  tourist clichés.
- Audience is adults studying on their own; do not add features aimed at children, exam prep or
  grammar drills.

## Development Workflow & Quality Gates

- Work follows Spec Kit: specify → plan → tasks → implement, one spec at a time.
- Every plan includes a Constitution Check against Principles I–X; violations need written
  justification.
- Before merge: lint, type-check, tests and production build pass.
- Reviews verify brand behaviours (II), honest-hours logic (III), language and RTL handling
  (IV, V) and accessibility (VI) for any change touching them.

## Governance

This constitution supersedes other practices. Amendments are made by editing this file through
`/speckit-constitution` with a stated rationale, a Sync Impact Report, and any needed updates to
`docs/product.md` or specs. Versioning is semantic: MAJOR for removing or redefining a principle,
MINOR for adding a principle or materially expanding guidance, PATCH for clarifications. All
specs, plans and reviews MUST verify compliance; complexity beyond these rules MUST be
justified. Runtime guidance for agents lives in `AGENTS.md`.

**Version**: 1.0.0 | **Ratified**: 2026-11-05 | **Last Amended**: 2026-11-05

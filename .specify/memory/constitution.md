<!--
Sync Impact Report
Version change: 1.0.0 -> 2.0.0
Bump rationale: MAJOR. Principle VIII ("Content as Files", no admin panel) is removed and
  redefined; the MVP scope in docs/product.md now includes a creator programme.
Modified principles:
  - VIII. Content as Files -> VIII. Content in the Database, Published by Review
  - X. Privacy and Security (access rules now defer to XI; webhook signatures verified)
  - I. Product Source of Truth (scope now includes creator and owner panels, screens 9-16)
  - IV. Multi-Language by Design (rule unchanged; clarified that languages are the only
    content kept as data files)
Added sections:
  - XI. Roles and Permissions
  - XII. Money Rules
  - XIII. Direct Video Upload
Removed sections: none (VIII replaced in place)
Deferred items:
  - docs/brand-guide.pdf could not be rendered during drafting (pdftoppm missing); re-check.
  - docs/design-tokens.json not read during drafting; verify token names against it.
  - Open product decisions (prices, transliteration standard, hour estimates, video host,
    payment provider) remain in docs/product.md "Still to decide".
  - Existing specs 001-007 may assume content as files; review them when next touched.
-->
# Instik Constitution

## Core Principles

### I. Product Source of Truth
`docs/product.md` defines scope. The brand guide defines voice and product behaviours.
`docs/design/` holds the approved screens. Where documents conflict, `docs/product.md` wins.
No feature outside the MVP list in `docs/product.md` (screens 1-16, including the creator and
owner panels) may be built until `docs/product.md` is updated to include it. Every spec MUST
trace to an MVP screen or behaviour.

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
Languages are data in `content/languages.json`; adding a language is adding data, not code.
Languages are the only content that stays as data files (see VIII). Every learner-facing record
(progress, level, hours, rhythm, sessions, preferences, waitlist) belongs
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

### VIII. Content in the Database, Published by Review
Videos, transcript segments, glossary links, hosts and creator profiles live in the database,
not in files. Every video follows one status path: Draft → Uploading → Processing → In review →
Approved (live); from review it MAY go to Changes requested (back to the creator) or Rejected.
- Only Approved videos are ever shown to learners, on every query path, including search, Up
  next, host pages and direct URLs. Any other status MUST be invisible to learners.
- Every status change is stored with who, when and the note. A note is required for Reject and
  Request changes; Approve requires the full review checklist.
- Stage, access (free or full) and the transcript are set by the owner during review, never by
  the creator. Creators do not write transcripts.
- Languages stay as data in `content/languages.json`, validated against a schema at build time;
  invalid language data MUST fail the build. The original sample content is imported once into
  the database by a repeatable script.
- Learner data lives in the database, never in `content/`.

### IX. Quality and Small Changes
Each feature ships with tests for its core logic (hours counting, transcript sync, Arabic
normalisation, access rules as applicable) and MUST pass lint, type-check and build before
merge. Keep changes small: one spec at a time, one reviewable change per task.

### X. Privacy and Security
Collect only the data the product needs. Never expose secrets to the client; only explicitly
public variables reach the browser. Validate all server inputs (actions, route handlers,
webhooks) with schemas, and verify webhook signatures before acting on them. Enforce access
(free vs full, ownership of learner data, roles per XI) on the server.

### XI. Roles and Permissions
There are three roles: **learner** (everyone with an account), **creator** (invite only) and
**owner** (the Instik team).
- Creators are created only through an owner-issued invitation: a one-time link sent by email
  that expires after 7 days. There is no public creator sign-up.
- Creators upload and manage their own videos and see their own stats and earnings. A creator
  MUST NEVER see, count, list or infer another creator's videos, stats, earnings or payouts.
- Owners review, write transcripts, invite, pause and resume creators, and run monthly earnings.
  A paused creator cannot upload or submit.
- Every permission MUST be checked on the server, inside the Data Access Layer, on every read
  and write. Hiding a button, a route or a client-side check is never enough. Data access
  functions take the acting user and scope queries by role and ownership; code outside the
  Data Access Layer MUST NOT query the database directly.
- Role and ownership rules MUST have tests, including a creator attempting to reach another
  creator's data.

### XII. Money Rules
- All amounts are stored and computed as integer cents. Floating-point money is forbidden.
  Currency is stored with every amount.
- Creator earnings follow `docs/product.md` exactly: each month 80% of net revenue goes to the
  creator pool and 20% to Instik; net revenue = subscription revenue minus VAT, payment fees and
  refunds. The pool is split by each creator's share of counted views that month.
- A counted view is at least 30 seconds of honest watch time (the rules of III), at most once
  per learner per video per day, and only from a learner with active full access at that time.
- Rounding MUST NEVER make the creators' shares add up to more than the pool; leftover cents
  are allocated by a deterministic, documented rule.
- During a month, figures are estimates and labelled as such. Closing a month, done only by an
  owner, locks it. A closed month is NEVER changed: corrections (refunds, errors) are recorded
  as adjustments in a later open month.
- Every payout is recorded (creator, month, amount in cents, who marked it paid, when, and a
  reference). Records are append-only; a mistake is fixed by a new reversing record.
- The earnings calculation MUST be a pure, tested module, never mixed into UI code.

### XIII. Direct Video Upload
Video files go directly from the creator's browser to the video host using a one-time upload
link created by our server. They MUST NEVER pass through our server, functions or storage.
- Only an invited, active creator (for their own video) or an owner may request an upload link.
- The video host reports readiness through a webhook whose signature is verified; only then does
  the video move from Processing to In review.
- The database stores everything about a video except the file: metadata, host asset and
  playback IDs, status and transcript. Full-access videos use signed playback; free videos
  MAY be public.

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
- Every plan includes a Constitution Check against Principles I–XIII; violations need written
  justification.
- Before merge: lint, type-check, tests and production build pass.
- Reviews verify brand behaviours (II), honest-hours logic (III), language and RTL handling
  (IV, V), accessibility (VI), review-gated publishing (VIII), role checks in the Data Access
  Layer (XI), money rules (XII) and direct upload (XIII) for any change touching them.

## Governance

This constitution supersedes other practices. Amendments are made by editing this file through
`/speckit-constitution` with a stated rationale, a Sync Impact Report, and any needed updates to
`docs/product.md` or specs. Versioning is semantic: MAJOR for removing or redefining a principle,
MINOR for adding a principle or materially expanding guidance, PATCH for clarifications. All
specs, plans and reviews MUST verify compliance; complexity beyond these rules MUST be
justified. Runtime guidance for agents lives in `AGENTS.md`.

**Version**: 2.0.0 | **Ratified**: 2026-11-05 | **Last Amended**: 2026-11-11

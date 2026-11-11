# Implementation Plan: Payments and Access

**Branch**: `007-payments-and-access` | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/007-payments-and-access/spec.md`, plus the technical direction given with the plan request: Stripe Checkout, Stripe Customer Portal, a verified webhook route that updates a `Subscription` model, Stripe Tax for EU VAT, server-side access checks on every protected video, tests for the access rules and webhook signature verification, and Stripe test-mode keys only until launch.

## Summary

Make the Free and Full access split real. One pure rule decides access from a learner's stored subscription; every place that serves a video, a transcript or a video-specific action asks that rule on the server. Stripe handles payment, tax and the self-service page; a verified webhook keeps our `Subscription` row in step; one price config feeds the pricing page, settings and Stripe.

- **One access rule, one gate.** `hasFullAccess(subscription, now)` is a pure function (status, `currentPeriodEnd`, `cancelAtPeriodEnd`). `canWatch(video, subscription)` returns true for free videos and, otherwise, whatever the rule says; an unknown access value counts as full. A server-only `requireVideoAccess` wraps both for pages and actions. The watch page decides **before** it reads the playback id, transcript or glossary, so a locked page never sends them to the browser.
- **Signed playback for full-access videos.** Free videos keep a public Mux playback id. Full-access videos use Mux signed playback: after the access check, the watch page signs short-lived tokens (playback, thumbnail, storyboard) on the server with the Mux signing key and hands them to the player; a learner without access never receives the id or a token. The signature is made with `node:crypto` (RS256), so no new dependency. Mux signing key variables are optional settings. (Closes the "playback id in the repo" gap in research §7.)
- **Calm locked state.** A `LockedVideo` panel replaces the player and transcript (title, host, kind sentence, link to pricing). Library cards, the host page and Up next show a small "Full access" marker for learners without access. No modal, no overlay. Autoplay skips locked videos, and "Pick up where you left off" skips videos the learner can no longer watch.
- **Checkout by link, not script.** "Get full access" becomes a plain link to `/billing/start?period=monthly|yearly`. The route requires a session (signed-out visitors go through onboarding with that URL as `returnTo` and come back to it), creates or reuses the Stripe customer, creates a Checkout Session and redirects. It works without JavaScript and resumes the chosen period after sign-in.
- **Prices live in one config, and Stripe is fed from it.** `src/lib/billing/plans.ts` holds currency, monthly and yearly amounts (or `null` placeholders). The pricing page, settings and the checkout all read it. A small script materialises the amounts as Stripe Prices (found by lookup key) and configures the Customer Portal, so the config stays the only place an amount is typed. While amounts are `null` or Stripe keys are missing, billing is off and the Full access button behaves as in Spec 6 (FR-019).
- **Webhook keeps the truth, and always re-reads Stripe.** `POST /api/stripe/webhook` verifies the signature on the raw body, records the event id for idempotency, then, for any subscription-related event, **fetches the current subscription from Stripe** and upserts the row (only if the fetch is newer than what is stored). Duplicates and out-of-order events therefore cannot leave a stale status. Events that match no learner are recorded as unmatched and grant nothing.
- **Instant access on return.** The Checkout success URL goes to `/billing/return`, which retrieves the session from Stripe, checks that it belongs to the signed-in learner, runs the same sync, and redirects to settings with a calm confirmation. If Stripe says the payment is still pending, settings show a waiting state that refreshes itself.
- **Manage and cancel in Stripe's portal, started from settings.** Settings gain a plan section (plan, period, price, renewal or end date). "Manage payment and invoices" and "Cancel subscription" open the Customer Portal; cancel deep-links straight to its confirmation step, so it is two presses (settings, then Stripe's confirm) and cancels at period end. Switching between Monthly and Yearly happens in the portal, takes effect at the end of the current period with no proration, and settings say so in one sentence. The portal is configured with no cancellation survey or retention offer.
- **Tax.** Checkout turns on Stripe Tax (`automatic_tax`), requires a billing address, and Stripe Prices are tax-inclusive so the price shown is the price paid; Stripe computes EU VAT (One-Stop Shop registration and a product tax code are launch tasks).
- **Test mode until launch.** The environment check refuses a live key (`sk_live_`) unless `BILLING_LIVE=true`, so a live key cannot be used by accident.

See [research.md](research.md) for decisions.

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 19.3, Next.js 16.4.5 (App Router, `cacheComponents` on), Node 24

**Primary Dependencies**: Existing: `zod`, Prisma 7 with `@prisma/adapter-pg`, Auth.js, Tailwind 4 tokens, Vitest. **One new runtime dependency: `stripe`** (the official Node SDK, 23.x): it builds Checkout and portal sessions and verifies webhook signatures; writing our own would re-implement signature checking. The SDK is imported only in server modules. Mux playback tokens are signed with `node:crypto` (no new dependency); `@mux/mux-player-react` (already installed) accepts them through its `tokens` prop.

**Storage**: PostgreSQL through Prisma: two new models, `Subscription` (one row per learner) and `StripeEvent` (processed event ids and outcomes), two enums, and one new nullable column `User.stripeCustomerId`. No change to `content/`; each video's existing `access` field is the free/full source.

**Testing**: Vitest. Pure modules carry the logic and are tested directly: the access rule (free, active, past due, cancelled before period end, ended, unpaid, stale, unknown video access), the price config (placeholders, validation, saving, formatting), webhook signature verification (valid, tampered body, wrong secret, missing or malformed header, old timestamp), the event handler with a fake Stripe client and fake store (duplicate, out-of-order, unmatched, deleted), the Stripe-status-to-row mapping, and the test-mode key guard. Components are tested for the locked card, locked panel and settings plan section. The real Stripe round trip is checked in the [quickstart](quickstart.md) with Stripe test mode and the Stripe CLI, as specs 4 to 6 did for their database paths.

**Target Platform**: Evergreen browsers 320px and up; Vercel with Neon Postgres; Stripe in test mode until launch

**Project Type**: Web application (single Next.js app, no separate backend)

**Performance Goals**: Access check is one indexed read (`Subscription` by `userId`), cached per request. Library, pricing and settings keep their static shells; only the learner-specific parts are dynamic behind `Suspense`. After payment, access is live within 10 seconds of return (SC-002): the return route syncs directly and does not wait for the webhook.

**Constraints**: `next build` and tests pass with no `.env.local` and no Stripe keys (Stripe settings are optional in the env schema; billing is simply off). The webhook reads the raw body and never trusts JSON before the signature passes. No card data, Stripe secret or webhook secret reaches the client. No modal, countdown or urgency copy. 44px targets, contrast at least 4.5:1.

**Scale/Scope**: 10 new modules in `src/lib/billing`, 4 route handlers (`/api/stripe/webhook`, `/billing/start`, `/billing/portal`, `/billing/return`), 5 new components (locked panel, full-access action and slot, settings plan section, billing notice), changes to about 20 existing files (watch, library, host and pricing screens, card, up next, pick-up banner, player, settings page, env, routes, return-to, copy, instrumentation, content types, two server actions), 2 models and 1 column, 1 setup script, about 22 test files.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | How the plan complies |
|---|---|---|
| I. Product source of truth | Pass | MVP screen 8 (Pricing) and the `docs/product.md` stack line ("Stripe ... for subscriptions", "subscriptions" in learner data). Payment provider is now decided as Stripe, which closes that "still to decide" item (`docs/product.md` is updated in the first task). Locked state, settings plan section and confirmation are utility screens built from the design system, as the brief allows |
| II. Brand behaviours | Pass | Locked state is calm and in the page; no pop-up, countdown, urgency or shaming; cancellation is two presses with no retention offer; hours, rhythm and roadmap never depend on a subscription; autoplay never enters a locked video; copy is short, warm and honest, with hours still "estimates" |
| III. Honest hours | Pass | Counting is untouched. A locked video cannot play, so it cannot be counted; hours already counted are never changed by a subscription ending |
| IV. Multi-language by design | Pass | Full access covers all languages; the check takes a video from any language; no language is hard-coded. Subscription is per learner, not per language |
| V. Arabic first-class | Pass | No Arabic text is changed; the locked panel shows the video title (and Arabic title where the card already does) with the existing `dir`/`lang` handling |
| VI. Design fidelity | Pass | Pricing page stays pixel-identical for signed-out visitors; new states use tokens only; the locked marker and panel use ink on paper with teal or slate (never small coral text); the period switch stays keyboard-operable; all new controls have visible focus and 44px targets |
| VII. Stack discipline | Pass | Stripe is the stack's named provider. One new dependency, `stripe`, with a stated reason. Route Handlers for webhook and redirects; Server Components for the session-aware parts behind `Suspense`; client code only for the period context, the action link and the self-refresh. Next docs read: route handlers (POST not cached, raw `request.text()`), proxy, Cache Components with runtime data |
| VIII. Content as files | Pass | The free/full value stays in each video's content file and is already validated at build by the existing schema; subscriptions are learner data in the database, not in `content/`. Prices are app configuration, not content |
| IX. Quality and small changes | Pass | Tests for the access rules, price config and webhook signature and handling, as the constitution names "access rules as applicable"; lint, type-check, tests and build gates; tasks kept small |
| X. Privacy and security | Pass | Access enforced on the server before anything is sent; the webhook verifies the signature first and validates the shape of what it reads with zod; secrets are server-only and optional in the env schema; no card data touches Instik; only Stripe ids, status, plan and period dates are stored; unmatched events grant nothing; test-mode key guard until launch |

Open product decisions (prices, currency, tax code) stay behind the price config and are clearly marked placeholders, as the Technical Constraints require. No violations. Re-check after design: still passes (see [data-model.md](data-model.md) and [contracts/](contracts/)).

## Project Structure

### Documentation (this feature)

```text
specs/007-payments-and-access/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── access-rule.md
│   ├── billing-routes.md
│   ├── stripe-webhook.md
│   └── price-config.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
prisma/
├── schema.prisma                      # + Subscription, StripeEvent, enums, User.stripeCustomerId
└── migrations/                        # + one migration

scripts/
└── stripe-setup.ts                    # idempotent: Prices from config (lookup keys), portal configuration; --check mode

src/
├── lib/
│   ├── env.ts                         # + optional STRIPE_*, BILLING_LIVE, MUX_SIGNING_*; test-mode key guard
│   ├── auth/return-to.ts              # + allow /billing/start?period=... and /pricing as return addresses
│   ├── routes.ts                      # + billingStartPath, billingPortalPath, billingReturnPath
│   └── billing/
│       ├── plans.ts                   # the one price config + formatting + yearly saving + billingReady()
│       ├── access.ts                  # PURE: hasFullAccess, canWatch (no server-only import)
│       ├── subscription.ts            # server-only: getSubscription(userId) (cached per request), requireVideoAccess
│       ├── stripe.ts                  # server-only: lazy Stripe client, test-mode guard
│       ├── checkout.ts                # create customer, Checkout Session, portal session (cancel deep link)
│       ├── webhook.ts                 # PURE-ish: verifyEvent(rawBody, signature, secret), relevant-event filter
│       ├── sync.ts                    # applyEvent(event, deps), syncSubscription(id, deps): fetch-latest, guarded upsert
│       ├── status.ts                  # Stripe status/price -> row fields; row -> display state (plan section)
│       ├── schemas.ts                 # PURE: zod schemas for every Stripe field the code reads (events, subscriptions, sessions)
│       ├── store.ts                   # server-only: Prisma store for sync (conditional upsert, events)
│       └── playback.ts                # server-only: signPlaybackTokens (Mux signed playback, node:crypto RS256)
├── app/
│   ├── api/stripe/webhook/route.ts    # POST: raw body, verify, record, sync, 200/400/500
│   ├── billing/
│   │   ├── start/route.ts             # GET: session, customer, Checkout redirect (or onboarding / settings)
│   │   ├── portal/route.ts            # GET: portal redirect; ?flow=cancel deep link
│   │   └── return/route.ts            # GET: verify session belongs to learner, sync, redirect to settings
│   ├── (marketing)/pricing/page.tsx   # + session-aware Full access action behind Suspense
│   └── (shell)/settings/page.tsx      # + plan section
├── components/
│   ├── billing/
│   │   ├── FullAccessAction.tsx       # client: reads period from context; link to /billing/start, or settings, or Spec 6 fallback
│   │   ├── PlanSection.tsx            # server: Free / Full / cancelled / ended / past due
│   │   ├── BillingNotice.tsx          # confirmation, pending (auto-refresh), cancelled-checkout messages
│   │   └── LockedVideo.tsx            # calm locked panel for the player page
│   ├── library/VideoCard.tsx          # + locked marker prop
│   ├── library/PickUpBanner.tsx       # skips videos the learner can no longer watch
│   ├── screens/HostScreen.tsx         # + locked markers
│   ├── player/VideoPlayer.tsx         # + playback tokens prop for signed playback
│   ├── marketing/PricingSwitch.tsx    # + period context; prices from plans.ts
│   ├── screens/WatchScreen.tsx        # access decided first; locked panel instead of player and transcript
│   └── watch/UpNext.tsx               # + locked marker; autoplay skips locked
└── lib/hours/actions.ts, lib/learner/preference-actions.ts   # + requireVideoAccess on video-specific actions

tests/unit/billing/
├── access-rule.test.ts                # free, active, past due, cancelled before end, ended, unpaid, stale, unknown access
├── plans.test.ts
├── webhook-signature.test.ts
├── sync.test.ts                       # duplicate, out-of-order, unmatched, deleted, resubscribe
├── status.test.ts
├── stripe-guard.test.ts               # live key refused unless BILLING_LIVE
├── locked-video.test.tsx
├── video-card-locked.test.tsx
├── plan-section.test.tsx
├── playback-token.test.ts             # claims, expiry, signature verifies, free videos unsigned
├── checkout-guard.test.ts             # existing non-ended subscription redirects; second active recorded unmatched
└── watch-gate.test.tsx                # locked: no playback id, no token, no transcript in output
```

**Structure Decision**: Single Next.js app. Billing logic lives in `src/lib/billing`, split so the rule and the webhook handling are pure and testable without Stripe or a database: `access.ts` and `status.ts` import nothing server-only, and `sync.ts` takes its Stripe client and store as arguments. Route handlers are thin: parse, call, respond.

## Complexity Tracking

No constitution violations. Two choices add moving parts and are justified here:

| Choice | Why needed | Simpler alternative rejected because |
|---|---|---|
| Webhook re-reads the subscription from Stripe instead of trusting the event body | Events can arrive twice or out of order (spec FR-022, SC-007); the fetched object is always the current truth | Applying each event's payload needs per-event ordering rules and breaks when an older event arrives late |
| `scripts/stripe-setup.ts` creates Stripe Prices and the portal configuration from the config | Keeps the price config the only place an amount is typed (FR-032, SC-008) and lets the portal offer Monthly/Yearly switching | Typing prices in the Stripe dashboard drifts from the pricing page; inline `price_data` at checkout cannot be offered as portal switch targets |

# Research: Accounts and Onboarding

All Technical Context items are resolved. Nothing is left marked NEEDS CLARIFICATION.

## 1. Auth.js version and sessions

- **Decision**: `next-auth@5.0.0-beta.32` (Auth.js v5) with `@auth/prisma-adapter`, **database sessions**, Google and Resend providers only.
- **Rationale**: v5 is the App Router version (`auth()`, route handler, server-side `signIn`/`signOut`), and its peer range includes Next 16 and React 19. It is only published under the `beta` tag, so the version is pinned exactly. Database sessions are what the requested `Session` model is for, make "sign out" and "sign out everywhere" real (the row is deleted), and let the server check that the learner still exists.
- **Alternatives**: JWT sessions (no `Session` model needed, but a cookie cannot be revoked and the model list asks for sessions); a different library such as iron-session (not the stack in the constitution).
- **Session length**: `maxAge` 30 days with `updateAge` of 1 day, so each day of activity pushes the expiry out and a regular learner is not asked to sign in again (FR-012).
- **Lazy setup**: the Prisma client and the Auth.js config are created on first use (Auth.js accepts a config function), never at import time, so `next build` and tests work with no `.env.local`.
- **Risk**: beta label. Mitigated by pinning, by keeping Auth.js behind `src/auth.ts` and `src/lib/session.ts` only, and by the quickstart exercising sign-in end to end.

## 2. "Middleware" is `proxy.ts` in this Next.js

- **Decision**: Create `src/proxy.ts` (not `middleware.ts`) exporting `proxy` and a `config.matcher`.
- **Rationale**: Next 16 renamed Middleware to Proxy (`node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`). Proxy is meant for optimistic checks, not full authorization or slow data access, so it only checks that a session cookie exists and redirects if not. Database lookups and ownership checks happen in the Data Access Layer. Prerendered pages are still passed through Proxy first, so a static watch page is not served to a visitor with no cookie.
- **Cookie names**: `authjs.session-token` (http) and `__Secure-authjs.session-token` (https). A cookie that exists but is stale gets past Proxy and is stopped by `requireLearner`, which redirects the same way.
- **Matcher**: `/learn/:language/watch/:video+`, `/learn/:language/roadmap`, `/learn/:language/done`, `/settings/:path*`. Landing, Library, hosts, pricing, onboarding, sign-in and the Auth.js routes are not matched.
- **Alternatives**: running the full `auth()` in Proxy (adds a database round trip to every matched request and the docs advise against it); checking only in pages (then a static-shell watch page could leak before the check).

## 3. Where the "sign-in prompt" lives

- **Decision**: The Proxy and `requireLearner` send a signed-out visitor to `/onboarding?returnTo=<path>`. When `returnTo` is a video, onboarding shows a short `SignInPrompt` above step 1 with the video's title and host ("Create a free account to watch and save your hours"), plus a link "Already have an account? Sign in" to `/sign-in?returnTo=…`.
- **Rationale**: This is what the planning input asked for (redirect to onboarding with a return URL) and it satisfies FR-002 and Story 3 (title and host shown, video not played, return afterwards). It gives a brand-new visitor the whole path in one place, and a returning learner is one link from signing in.
- **Alternatives**: a separate full-page prompt on the video URL (would make the video page itself dynamic and duplicate the sign-in form).

## 4. Public pages stay static (Cache Components)

- **Decision**: Only `UserSlot` (header), protected pages and server actions read the session. `UserSlot` sits in its own `<Suspense>` with a fallback the size of the account button, so the header does not jump.
- **Rationale**: With `cacheComponents` on, reading `cookies()` outside a Suspense boundary is a build error, and a top-level session read in a layout would block `{children}` (`02-guides/authentication-with-cache-components.md`). Landing, Library and hosts therefore keep prerendering. The landing call-to-action keeps linking to `/onboarding`; the onboarding page itself redirects an already-signed-in learner to the Library (Story 3, scenario 7), so the landing page needs no session read.
- **Alternatives**: `use cache: private` for the user (only helps prefetch of the session lookup; not needed for one small component).

## 5. Prisma 7 with Neon

- **Decision**: `@prisma/client` 7.x with the `@prisma/adapter-pg` driver adapter, generated client committed nowhere (generated on install via `prisma generate` in `postinstall`/build). `DATABASE_URL` is Neon's **pooled** URL for the app; `DIRECT_URL` is the **direct** URL used by `prisma migrate` through `prisma.config.ts`.
- **Rationale**: Prisma 7 expects a driver adapter and a config file instead of URLs inside the schema. Pooling avoids exhausting connections from serverless functions; migrations need a direct connection.
- **Dev client**: one `PrismaClient` cached on `globalThis` in development so hot reload does not open new pools.
- **Alternatives**: Neon's serverless driver adapter (fine later; `pg` works on Vercel's Node runtime and is simpler to test locally against any Postgres).
- **Local development**: a Neon dev branch, or any local Postgres, through the same two variables.

## 6. Email link through Resend

- **Decision**: Auth.js's built-in Resend provider with `maxAge` of 60 minutes. A custom `sendVerificationRequest` is not needed except to run the send limit first (see 8) and to give the email the brand text (short, warm, English).
- **Rationale**: No SDK dependency, and the single-use token behaviour comes from the adapter: `useVerificationToken` deletes the row on use, so reuse fails (FR-007). Links work in any browser because they carry the token, not a cookie from the requesting tab.
- **Sender**: `EMAIL_FROM` must be a verified Resend domain (placeholder until the domain exists; Resend's shared test sender works for development with only the account owner's address).
- **No account enumeration (FR-013)**: the form always ends on the same "Check your email" page; Auth.js creates the user only when the link is used.
- **Alternatives**: Nodemailer/SMTP (heavier, another peer dependency).

## 7. Linking Google and email to one account (FR-009)

- **Decision**: Set `allowDangerousEmailAccountLinking: true` on the Google provider only.
- **Rationale**: Google returns verified addresses, and the email link proves control of the address, so both routes prove the same owner. Without this, Auth.js refuses a Google sign-in for an address that already has an email-link account (`OAuthAccountNotLinked`). The name is Auth.js's own and applies here because both providers verify the address; it would not be safe with a provider that does not.
- **Alternatives**: tell the learner to use the original method (breaks Story 2 scenario 5).

## 8. Rate limiting sign-in links (FR-008, SC-010)

- **Decision**: A tiny `SignInAttempt` table (`key`, `createdAt`). Before sending, count rows for `email:<normalised address>` and `visitor:<hashed IP>` in the last hour: at most 5 per address and 20 per visitor per hour, and at least 30 seconds between sends to the same address. Over the limit the page shows a kind "Please wait a little before asking again". Rows older than a day are deleted opportunistically on insert.
- **Rationale**: The platform has no shared in-memory state across serverless instances, and the database is already there. IP values are stored only as a salted hash and are not used for anything else (constitution X).
- **Alternatives**: an in-memory limiter (resets per instance); a Redis/Upstash dependency (another service for one rule); counting `VerificationToken` rows alone (tokens are deleted on use, so it undercounts).

## 9. Typed environment check

- **Decision**: `src/lib/env.ts` parses `process.env` with zod once on first use and throws one readable error listing every missing or malformed variable (names only, never values). `src/instrumentation.ts` calls it in `register()` for the Node runtime so a misconfigured production deploy fails at start. `server-only` keeps it out of client bundles. `.env.example` lists every variable with a comment and no value.
- **Variables**: `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `AUTH_URL` (optional locally; Vercel sets the host), `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_RESEND_KEY`, `EMAIL_FROM`, `IP_HASH_SALT`. No `NEXT_PUBLIC_` variables are added.
- **Rationale**: Parsing lazily means `next build` and the unit tests do not need secrets; parsing in `instrumentation` means production still fails early. Auth.js reads its own `AUTH_*` names, so those names are kept.
- **Alternatives**: `@t3-oss/env-nextjs` (new dependency for what zod already does here).

## 10. Onboarding state carry-over

- **Decision**: The draft `{ step, language, level, minutes }` is a pure zod-validated object (`draft.ts`) stored in `localStorage` under `instik:v1:onboarding` through `draft-storage.ts`, with an in-memory fallback. It is saved on every change and read only after mount. The step guard (`firstMissingStep`) sends a learner to the first step whose answer is missing (FR-023).
- **Round trips**: Google and email links both return to `/onboarding/finish`, a page that runs in the same browser profile, so `localStorage` is still there, including when the link opens in a new tab. `finish` calls the `completeOnboarding` action with the draft. On success it clears the draft and goes to `returnTo` or the Library.
- **Existing profile (FR-021)**: if the learner already has a profile for that language, `completeOnboarding` does not change it; the page shows "You already have this language. Keep your current choices, or use these?" with two buttons.
- **No draft (other device)**: `finish` sends the learner to onboarding at the first missing step (Story 4, scenario 4), for the language in `returnTo` if there is one.
- **Why not server-side drafts**: the visitor has no identity yet, and a cookie-keyed draft table adds data about people who never sign up (constitution X).
- **Level to stage**: `none` and `few` map to Hear it, `slow` to Follow it, `most` to Understand it (the design's table), in `profile-rules.ts`.

## 11. Per-language profile rules

- **Decision**: `profile-rules.ts` is pure: `stageForLevel`, `isValidMinutes`, `isValidStage`, `canAddProfile(profiles, language)` (language must exist, be available, and not already be a profile), `applyProfileChange(profiles, change)` (changes one profile and returns the others by reference), `languagesToOffer(languages, profiles)`. The database has a unique key on `(userId, languageCode)` as the backstop, and the action treats a unique-violation as "already added".
- **Rationale**: These are the rules the spec lists (FR-024 to FR-026) and the ones the request wants tested; keeping them free of Prisma makes the tests fast and exact.

## 12. Moving transcript layers and answers to the account (FR-029 to FR-032)

- **Decision**: For a signed-in learner the server component reads `Preference` (by profile) and `ComprehensionAnswer` and passes them in as the initial values. Client hooks `useAccountLayers` and `useAccountAnswer` update the screen at once and call the server action; on failure they keep the screen value, show a short quiet note, and send the current full state on the next change.
- **One-time import**: after sign-in, a small client effect in the shell reads the old device keys (`layersKey`, `understoodKey`) once and calls `importDevicePreferences` with the parsed values, then removes the keys only after the action reports success. If it fails the keys stay and the attempt repeats next load.
- **Merge** (`device-import.ts`, pure): layers — if the account already has layers for that language the account wins, else the device value is used. Answers — if the account already has an answer for the video it wins; if it has none, the device answer is imported. The device store holds no timestamp, which is why the rule is "account wins" rather than "most recent wins"; the spec (FR-030) says the same. Nothing on the account is ever deleted.
- **Sign-out clears the device**: `clearDeviceChoices` removes every old layers and answers key (including entries kept because the language has no profile yet) when the learner signs out, together with the onboarding draft, so another person can never receive them (FR-031). An expired session without a sign-out leaves any kept entries until the next sign-out; this is stated in the spec's assumptions. Unknown or invalid values are dropped.
- **No profile for the language**: layers and answers for a language the learner has no profile for stay on the device until a profile exists (spec assumption).
- **Another person on the same device (FR-031)**: keys are removed after import, so the next person has nothing to inherit.
- **Autoplay** stays on the device (FR-033).

## 13. Account button and menu

- **Decision**: `AccountButton` becomes a client component (menu button pattern: `aria-haspopup="menu"`, `aria-expanded`, `role="menu"` with two `role="menuitem"` items; arrow keys, Home/End, Escape, outside click and blur close it; focus returns to the button). "Settings" is a link; "Sign out" is a form button submitting the sign-out action. `UserSlot` (server) supplies the initial letter from name or email, or renders a "Sign in" link when there is no session.
- **Alternatives**: the native Popover API (focus return and arrow-key handling would still be custom).

## 14. Server actions, validation and ownership

- **Decision**: Mutations are server actions in `src/lib/**/actions.ts`. Each parses its input with zod, calls `requireLearner()`, and builds every query from the session's user id (never an id from the client). Return values are small typed results (`ok`, or an error code the UI turns into a kind message), not thrown errors. `returnTo` is sanitised on every use (`sanitiseReturnTo`: must start with a single `/`, no `//`, no backslash, no scheme, length-limited, and must match a known route shape), not only at the start.
- **Rationale**: Constitution X, FR-004, FR-040. Next's data-security and server-actions guides were read.

## 15. Testing approach

- **Pure unit tests** (fast, no network): onboarding draft (defaults, corrupt storage, step guard, carry-over into profile input), profile rules (one per language, available only, valid values, independence, stage mapping), `sanitiseReturnTo` (open-redirect cases), gate (protected paths, cookie names, redirect URL), device import merge, env parsing.
- **Component tests** with stubbed actions: onboarding flow (back keeps choices, reload restores, listening check never blocks, keyboard operation), account button (menu keyboard behaviour), sign-in form (no password field, invalid email message).
- **Access rules** (constitution IX, SC-010, FR-040): tests with the session and database mocked check that the Data Access Layer redirects a signed-out call, and that every server action refuses a signed-out call and builds its queries from the session's user id even when the input names another user's id.
- **Not unit tested**: Auth.js and Prisma internals. The [quickstart](quickstart.md) covers them against a real Neon branch and Resend/Google test credentials.

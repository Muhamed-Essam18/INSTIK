# Contract: Routes and the gate

## Routes

| Path | Who | Notes |
|---|---|---|
| `/`, `/pricing`, `/learn/<slug>` (Library), `/learn/<slug>/hosts`, `/learn/<slug>/hosts/<host>` | Everyone | Static; no session read |
| `/onboarding` | Everyone | `?step=1..4` and `?returnTo=<path>`. A signed-in learner with a profile is redirected to `returnTo` or the Library. Visiting a step whose earlier answers are missing redirects to the first missing step |
| `/onboarding/finish` | Signed-in | Turns the device draft into a profile, then goes to `returnTo` or the Library. With no draft it redirects into onboarding at the first missing step |
| `/sign-in` | Everyone | Google button and email field. `?returnTo=` kept. Signed-in learners are redirected |
| `/sign-in/check-email` | Everyone | Same text whether or not the address has an account. "Send it again" (after 30 seconds, same limits) uses an address remembered in session storage, never in the URL |
| `/sign-in/error` | Everyone | Kind message and a way to ask for a new link (expired, used, cancelled, failed) |
| `/learn/<slug>/watch/<video>` | Signed-in, with a profile for the language | Signed-out: redirect to `/onboarding?returnTo=…`. Signed-in without that language's profile: redirect to `/settings/add-language?language=<code>&returnTo=…` |
| `/learn/<slug>/roadmap`, `/learn/<slug>/done` | Signed-in | Signed-out: redirect to `/sign-in?returnTo=…` |
| `/settings` | Signed-in | Email, profiles, change stage and minutes, "Add a language" |
| `/settings/add-language` | Signed-in | Language list, then stage and minutes steps |
| `/api/auth/*` | Auth.js | Callbacks for Google and the email link; not linked to directly by the interface |

New helpers in `src/lib/routes.ts`: `signInPath(returnTo?)`, `onboardingPath(returnTo?)` (extends the existing function), `onboardingFinishPath(returnTo?)`, `settingsPath()`, `addLanguagePath(code?, returnTo?)`.

## Proxy (`src/proxy.ts`)

- **Matcher**: `/learn/:language/watch/:video+`, `/learn/:language/roadmap`, `/learn/:language/done`, `/settings/:path*`.
- **Logic** (pure part in `src/lib/auth/gate.ts`, tested):
  1. If the request carries a cookie named `authjs.session-token` or `__Secure-authjs.session-token`, continue.
  2. Otherwise redirect (307) to `/onboarding?returnTo=<pathname+search>` for watch paths, and to `/sign-in?returnTo=<pathname+search>` for roadmap, done and settings.
- **It does not**: look up the session, check the profile, or allow anything by itself. A forged or stale cookie passes the proxy and is refused by the Data Access Layer.

## Data Access Layer (`src/lib/session.ts`)

| Function | Behaviour |
|---|---|
| `getLearner()` | Returns `{ id, email, name?, image? }` for a valid database session, else `null`. Cached per request |
| `requireLearner(returnTo)` | `getLearner()`, or redirect to the gate target for `returnTo` (same rules as the proxy) |
| `requireProfile(languageCode, returnTo)` | `requireLearner`, then the learner's `LearnerLanguage` for that code, or redirect to add-language |

Every protected page and every server action calls one of these first.

## `returnTo`

- Accepted: a path starting with a single `/`, at most 512 characters, no `//` start, no backslash, no control characters, no scheme or host, and matching one of the known route shapes above (a protected path or the Library).
- Anything else becomes the Library for the learner's first profile, or `/`.
- Sanitised when read from the URL and again just before redirecting.

## Interface requirements the routes must meet

- Onboarding and sign-in forms: labelled controls, 44px targets, visible focus, errors next to the field, no password field.
- Sign-in prompt on onboarding when `returnTo` is a video: shows the video title and host, never the video.
- No sign-in message says whether an address already has an account.

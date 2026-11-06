# Quickstart: Accounts and Onboarding

How to prove the feature works end to end. Details of models, routes and actions are in [data-model.md](data-model.md) and [contracts/](contracts/).

## Prerequisites

1. A Neon project with a **development branch**. Copy its pooled and direct connection strings.
2. A Google Cloud OAuth client (type: web). Authorised redirect URI: `http://localhost:3000/api/auth/callback/google`.
3. A Resend API key and a sender (`EMAIL_FROM`). Until a domain is verified, Resend's test sender delivers only to the account owner's address.
4. Copy `.env.example` to `.env.local` and fill every variable (see [contracts/environment.md](contracts/environment.md)). Generate the secret with `npx auth secret`.

## Set up

```text
npm install
npx prisma migrate dev          # creates the tables on the Neon dev branch
npm run dev
```

If a variable is missing, the server fails at start with a message listing the names.

## Automated checks

```text
npm run lint
npm run typecheck
npm test
npm run build
```

Expected: all pass. The tests that matter most for this feature:
- `onboarding-draft.test.ts`: choices survive reload and sign-up, step guard, corrupt data discarded.
- `profile-rules.test.ts`: one profile per language, available languages only, valid values, a change to one profile leaves others unchanged.
- `return-to.test.ts`: external and malformed return addresses are refused.
- `gate.test.ts`: which paths are protected, both cookie names, redirect targets.
- `device-import.test.ts`: account choices win, nothing on the account is lost, device-only choices are imported.

## Manual scenarios (real browser, clean console)

1. **Browse signed out** (Story 3): open `/`, the Library, a host page and `/pricing` in a private window. Each shows full content, no sign-in prompt. The header shows "Sign in".
2. **Gate** (Story 3): open a video address. Expected: redirect to `/onboarding?returnTo=/learn/arabic-egyptian/watch/<video>` showing the video's title and host and "Create a free account to watch and save your hours"; the video does not play. Try a cookie-less request with `curl -i` on the roadmap path: expect a redirect to `/sign-in`.
3. **Onboarding with email link, same tab** (Stories 1, 4): choose Egyptian Arabic, "Some words and phrases", 30 min. Enter an email. Reload before sending: choices and step are still there. Send, open the link from the inbox. Expected: arrive on the video from step 2, and `/settings` shows "Hear it" and 30 minutes.
4. **Email link in another tab / used twice** (Story 2): repeat with a new address, opening the link in a new tab (works, profile matches). Open the same link again: kind message and a way to ask for a new link. Wait 60 minutes (or edit the expiry in the database) for the expired case.
5. **Google** (Stories 1, 2, 4): repeat step 3 with "Continue with Google". Then sign out and sign in with an email link to the same address: same account, one profile.
6. **Different device** (Story 4, scenario 4): open a sign-in link on a browser with no saved choices; you are asked steps 1-3 once.
7. **Existing profile** (Story 4, scenario 5): while signed in, change settings to 10 min, sign out, run onboarding choosing 60 min, sign in: the page asks before replacing; "Keep" leaves 10.
8. **Rate limit** (Story 2): request six links for one address within an hour. Expected: the sixth is refused with a kind message and no email is sent. On the "Check your email" page, "Send it again" is disabled for 30 seconds and then works under the same limits.
9. **Account menu** (Story 7): with the keyboard only, open the account button, move between "Settings" and "Sign out", press Escape (focus returns), open Settings, then sign out. Expected: back on the landing page; the video address redirects again. At 360px the menu stays on screen.
10. **Add a language** (Story 5): temporarily mark the sample second language available in the language data. "Add a language" lists it; add it with different values; the first profile is unchanged; a duplicate cannot be added. Restore the data.
11. **Move device choices** (Story 6): before signing in, in a signed-out browser set layers and answers using the previous build's keys (or write them in the console under `instik:v1:arz:layers` and `instik:v1:arz:understood:<video>`). Sign in. Expected: choices still shown; the keys are gone from `localStorage`; a second browser signed in to the same account shows them. Also add a key for a language the account has no profile for, sign out, and check that it is gone too, so the next person to sign in on the device receives nothing. Change a toggle with the network offline: it applies, a quiet note appears, and the next change saves.
12. **Keyboard and screen reader** (Story 1): complete all four steps by keyboard; options announce as radios with their selected state and the step is announced; no horizontal scroll at 360px.

## Expected end state

- `User`, `Account`, `Session`, `LearnerLanguage` and (after step 11) `Preference` and `ComprehensionAnswer` rows exist for the test account and for no one else's.
- No password field, password route or password text anywhere.
- `grep` of the client bundle for the variable names in `.env.example` finds none.

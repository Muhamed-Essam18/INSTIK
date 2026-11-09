# Quickstart: validating Marketing Pages

## Prerequisites

- `npm install`, and a development database in `.env.local` (`DATABASE_URL`, `DIRECT_URL`, the auth variables).
- `npm run db:migrate` to add `WaitlistEntry`.
- Optional: `SITE_URL=http://localhost:3000`.

## Automated checks

```
npm run lint
npm run typecheck
npm test
npm run build
```

`npm run build` must pass with no `.env.local`.

## Manual scenarios (`npm run dev`)

1. **Landing against the design** (US1): open `/` signed out beside `docs/design/Landing.dc.html` at 375, 768 and 1440 px. Sections appear in the order of FR-001; the stage cards show "[~X hours]" while the roadmap is provisional; no sideways scroll; the Arabic line is right-to-left with tashkeel.
2. **Calls to action** (US1): signed out, press "Start watching free" in the header, hero and final call to action; each lands on `/onboarding`. Sign in, reopen `/`: the header has no "Log in" and the same buttons land in the library.
3. **Waitlist** (US2): pick Spanish, enter `Someone@Example.com `, submit. Confirmation appears. Submit again with `someone@example.com`; the same confirmation appears. In the database there is one row for `es` and `someone@example.com`. Submit with French: a second row.
4. **Waitlist errors** (US2): empty email shows the gentle message and keeps the language; no language shows "Please pick a language."; ten quick submissions show the "wait a little" message on the eleventh.
5. **Onboarding link** (US2): in onboarding step 1, press "Join the waitlist" on Spanish: you land on `/?language=es#waitlist` with Spanish selected. For "Something else", Other is selected.
6. **Pricing** (US3): open `/pricing` beside the design. Monthly is selected; press Yearly and the Full access card shows "per year"; use Tab and Space to operate the switch; a screen reader announces the pressed state. Both buttons go to onboarding. No real amount appears.
7. **About and Privacy** (US4): open from the footer; About shows "in-STICK", the method and the hosts promise; Privacy lists what is stored and says a full policy is coming. Every header and footer link resolves (SC-005).
8. **Sharing and search** (US5): view source on each page: unique `<title>`, description, `og:image` pointing at the generated image. Open `/opengraph-image` and check it is 1200×630 in brand colours. Open `/sitemap.xml` and `/robots.txt`. Check sign-in, onboarding and settings carry `noindex`.
9. **Accessibility**: tab through each page (visible focus, skip link first), run a contrast check on text, confirm 44px targets.
10. **No-script**: disable scripts on `/pricing`: both plans and Monthly price are readable and the buttons work.

## Expected outcome

All scenarios pass; lint, type-check, tests and build are green; the sitemap lists exactly the four marketing pages.

See [data-model.md](data-model.md) and [contracts/](contracts/) for the exact rules and copy.

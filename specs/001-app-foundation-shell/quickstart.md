# Quickstart: Validate the App Foundation and Shell

Run these after implementation to prove the spec end to end.

## Prerequisites

- Node.js 20 or later and the dependencies installed with `npm install`
- Fonts are fetched by `next/font` at build time, so the first build needs network access

## 1. Automated gates

```text
npm run lint
npm run typecheck
npm test
npm run build
```

Expected: all four pass. `npm test` covers language schema validation (each failure in
[contracts/languages.md](contracts/languages.md)), language lookups, the route table, and
`TargetText`. `npm run build` prerenders `/learn/arabic-egyptian` and `/learn/spanish`.

## 2. Invalid data fails the build

1. Temporarily change a slug in `content/languages.json` to `"Not Valid"`, or set both languages
   to `coming-soon`.
2. Run `npm run build`.

Expected: the build fails with a message naming the entry and rule. Revert the change.

## 3. New language needs data only

1. Add a third entry (for example slug `french`, `ltr`, `coming-soon`) to `content/languages.json`.
2. Run `npm run build` and `npm run start`; open `/learn/french`.

Expected: the "coming soon" notice appears with no code changes. Revert the change.

## 4. Walk every screen

Run `npm run dev` and open `http://localhost:3000`. From the landing page, using only links and
the header, reach:

| Screen | Expected path |
|---|---|
| Landing | `/` |
| Onboarding | `/onboarding` |
| Pricing | `/pricing` |
| Library | `/learn/arabic-egyptian` |
| Player | `/learn/arabic-egyptian/watch` |
| Done for today | `/learn/arabic-egyptian/done` |
| Roadmap | `/learn/arabic-egyptian/roadmap` |
| Host | `/learn/arabic-egyptian/hosts` |

Expected on each: shared header and footer, one `h1`, a "coming soon" note, a unique page title,
Library, Roadmap or Hosts marked current where it applies, no dead ends. Also check
`/learn/spanish` (coming-soon notice), and `/learn/nope`, `/learn/ARABIC-EGYPTIAN` (slugs are
lowercase only), `/learn` and `/nope` (friendly not-found with the shared header and footer, status
404). The Hours pill shows "Hours" with a dash and an empty ring, never a number.

## 5. Look and accessibility

- Compare the header and footer with `docs/design/Library.dc.html` and `docs/design/Landing.dc.html`
  at 375px and 1280px: colours, fonts, spacing, rounded corners.
- Resize from 1280px down to 320px: no horizontal scroll, header wraps cleanly.
- Block the font requests in the browser dev tools and reload: text stays readable in the fallback
  fonts and the layout holds.
- Keyboard only: Tab reaches the skip link first, then wordmark, nav, Hours pill, account button;
  focus is visible; Enter activates links. Every target is at least 44px.
- Run an automated accessibility scan (browser extension or axe CLI) on each screen: no contrast
  failures.
- Turn on reduced motion in the OS: no animation beyond colour changes.

## 6. Arabic inside English

Temporarily render a sample `TargetText` with `إزَّيَّك؟ عامل إيه النهارده؟` next to an English
sentence on a placeholder page (do not commit it). Expected: Arabic runs right-to-left in Noto
Naskh at about 1.4× the English size, vowel marks are fully visible, the surrounding header and
text stay left-to-right, and the element has `dir="rtl"` and `lang="arz"`. A native Egyptian Arabic
reader (the project owner) does this check, which counts as the SC-007 review.

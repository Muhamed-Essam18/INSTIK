# Research: Marketing Pages

## 1. Separate frame for marketing pages

- **Decision**: A `(marketing)` route group with its own `MarketingFrame` (skip link, header, main, footer). Landing and pricing move there from `(shell)`; About and Privacy are new.
- **Rationale**: The designs use a different header (How it works, Hosts, Pricing, Log in, Start watching free) from the app header (Library, Roadmap, Hosts, Hours pill, account). Reusing `ShellFrame` would show app navigation to visitors and break design fidelity.
- **Alternatives**: Switch the shell header by pathname (client logic in a shared component, easy to get wrong); one frame with props (couples two unrelated layouts).

## 2. Session-aware calls to action on static pages

- **Decision**: `StartLink` is an async server component using `getLearner()` behind `Suspense`; the fallback is a normal link to onboarding. Signed-in learners get the library for the default language. The destination rule is a pure function.
- **Rationale**: Reading the session makes a component dynamic; `Suspense` keeps the rest of the page prerendered (the same approach as the app header's `UserSlot`). The fallback is correct for signed-out visitors, who are the common case, and works without scripts.
- **Alternatives**: Make the whole page dynamic (slower, no reason); decide on the client with a fetch (flash of wrong link, needs extra endpoint).

## 3. Waitlist storage and duplicates

- **Decision**: A `WaitlistEntry` model with a unique constraint on `(languageCode, email)`; the email is trimmed and lower-cased before saving. The action inserts and treats a unique-constraint conflict as success (insert with skip-duplicates).
- **Rationale**: The database guarantees one entry per pair even with a double press or two tabs; no read-then-write race. The visitor sees the same confirmation whether the pair was new, so the form cannot be used to discover who is on the list.
- **Alternatives**: Check then insert (race); store language in a join table (no need).

## 4. Waitlist languages and "French"

- **Decision**: Options are the `coming-soon` languages from `content/languages.json`, then "Other". French is added to the data as `coming-soon`. The stored language is the language code, or `other`.
- **Rationale**: The design lists Spanish, French and Other; the data has only Spanish. Adding French as data follows the "adding a language is data, not code" rule and also lists French as "Coming later" in onboarding's language step and Add a language, which is consistent with the waitlist.
- **Alternatives**: Hard-code French in the form (breaks FR-007); drop French (deviates from the design). *Flag for review*: French will now also appear in onboarding.

## 5. Preselecting a language from onboarding

- **Decision**: Onboarding links become `/?language=<code>#waitlist` (and `language=other` for "Something else"). The form reads `useSearchParams` in a client component under `Suspense`; an unknown value is ignored.
- **Rationale**: Keeps the landing page static and the link shareable. The anchor scrolls to the section.
- **Alternatives**: Cookie or session state (invisible, fragile); hash-only values (hash is not readable on the server, and no need).

## 6. Spam protection

- **Decision**: A hidden trap field (silently succeeds without saving when filled) and a per-visitor limit of 10 attempts an hour using a salted hash of the forwarded address, stored in the existing `SignInAttempt` table under a `waitlist:` key. A limited visitor sees the kind "try again a little later" message.
- **Rationale**: Matches the sign-in link practice from spec 4; no new service, no CAPTCHA (hostile to the brand and to accessibility).
- **Alternatives**: CAPTCHA (extra dependency, accessibility cost); no limit (open to junk fill).

## 7. Stage estimates on the landing page (FR-003 reworded to match)

- **Decision**: Show "[~X hours]" while the language's roadmap is missing or marked `provisional`; show "about N hours" only when it is final. Join in has no estimate and always shows the placeholder.
- **Rationale**: The data's current numbers (30, 100, 250) are explicitly provisional, and `docs/product.md` lists estimates under "still to decide". Showing them as facts on the front page would break "hours are estimates, not promises". When product finalises the numbers and clears `provisional`, the page updates with no code change (FR-003).
- **Alternatives**: Always show the provisional numbers (misleading on the public page); always show placeholders (ignores FR-003).

## 8. Pricing placeholders and the switch

- **Decision**: Prices and the savings figure are constants in the pricing copy module (`[PRICE]`, `[Save X%]`). The switch is a client component using two buttons with `aria-pressed`, starting on Monthly, with visible focus. Without scripts, Monthly shows and the buttons are inert, which is acceptable because both prices are placeholders.
- **Rationale**: Mirrors the design. Real prices will be a one-line change in one file.
- **Alternatives**: Radio inputs (more native, but diverges from the pill look); URL-driven toggle (needless).

## 9. Share image

- **Decision**: One code-generated `opengraph-image.tsx` at the app root (1200×630, `image/png`) with the Instik wordmark in Nunito, the tagline, and brand colours from the tokens, plus an alt text file. Every page inherits it. A `twitter-image` is not added; the OG image is used for both.
- **Rationale**: Next's `ImageResponse` needs a font file for Nunito, so the ExtraBold TTF (SIL OFL) is added under `src/assets/fonts`. This is the only new asset. It is generated at build time.
- **Alternatives**: A hand-made PNG (needs a design tool and is hard to keep in sync with tokens); the default sans (off-brand).

## 10. Metadata, sitemap and robots

- **Decision**: Set `metadataBase` from a `SITE_URL` setting (falling back to the Vercel production URL, then localhost), a title template `%s · Instik`, and per-page title and description. `sitemap.ts` lists `/`, `/pricing`, `/about`, `/privacy`. `robots.ts` allows `/`, disallows `/api`, `/sign-in`, `/onboarding`, `/settings`, and `/learn`, and points at the sitemap. Sign-in, onboarding and settings also get `robots: { index: false }`.
- **Rationale**: Fulfils FR-019 and FR-020 with built-in conventions and no dependency. Disallowing `/learn` keeps the library and player out of search for now (not marketing pages); this can change later.
- **Alternatives**: A third-party SEO package (not needed).

## 11. Hosts links

- **Decision**: "Hosts" in the header, the "Meet the hosts" link and the footer go to the existing `hostsPath(defaultLanguage.slug)`.
- **Rationale**: The hosts index already exists from spec 2/3 work, so no new page is needed.

## 12. Privacy and About copy

- **Decision**: Plain placeholder copy kept in `lib/marketing/copy.ts`. Privacy lists: account email and name, language profile, watch hours and progress, waitlist emails, a salted hash of the visitor address for send limits; says a full policy is coming; makes no legal claims.
- **Rationale**: Honest, accurate to what the product stores today (checked against the schema), and easy to replace later.
- **Note**: The brand guide PDF could not be rendered during specify; the About and landing copy follow `docs/product.md` and the design files. Re-check voice against the PDF when reviewing.

## Next.js docs consulted

`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/` (`opengraph-image`, `sitemap`, `robots`). The existing project already follows route groups, Server Actions and `Suspense` under `cacheComponents`.

## Notes from analysis

- The marketing header says "Log in" (as designed) while the app header says "Sign in"; this is intentional.
- The waitlist limit falls back to a shared "unknown" bucket when the forwarded address is missing, as the sign-in limit does; acceptable for now.

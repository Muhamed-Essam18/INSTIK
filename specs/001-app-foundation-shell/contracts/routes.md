# Contract: Routes and Shell

The public interface of this feature is its URLs and the shell every page shares.

## Routes

| Path | Screen | Language slug | Notes |
|---|---|---|---|
| `/` | Landing | no | Placeholder |
| `/onboarding` | Onboarding | no | Placeholder |
| `/pricing` | Pricing | no | Placeholder |
| `/learn/{language}` | Library | yes | Placeholder |
| `/learn/{language}/watch` | Player | yes | Placeholder; `/watch/{video}` is added by the content spec |
| `/learn/{language}/done` | Done for today | yes | Placeholder |
| `/learn/{language}/roadmap` | Roadmap | yes | Placeholder |
| `/learn/{language}/hosts` | Host | yes | Placeholder; `/hosts/{host}` is added by the content spec |
| any other path | Not found | no | Friendly page inside the shell, link back to `/` |

`{language}` is a slug from `content/languages.json`.

### Behaviour

| Request | Result |
|---|---|
| `/learn/arabic-egyptian[/...]` | Page renders inside the shell |
| `/learn/spanish[/...]` | "Coming soon" notice inside the shell, with a link back to `/`; status 200 |
| `/learn/unknown[/...]` | Not-found page, status 404 |
| `/learn/ARABIC-EGYPTIAN` | Not found (slugs are lowercase; no case folding) |
| trailing slash | Redirects to the same path without it (framework default) |
| `/learn` | Not found in this spec (no language chooser yet; onboarding will own it) |

## Shell (every page)

Landmarks in order:

1. Skip link ("Skip to main content") targeting `#main`. First focusable element.
2. `header`
   - `instik` wordmark link to `/`
   - `nav` with accessible name "Main": Library, Roadmap, Hosts. Links go to `/learn/{current or default language}`, `/roadmap`, `/hosts`. The current item has `aria-current="page"`, set by exact section match: Library on `/learn/{language}`, Roadmap on `/learn/{language}/roadmap`, Hosts on `/learn/{language}/hosts`. `/watch`, `/done` and all language-independent pages mark no item.
   - Hours pill: a link to the Roadmap showing the label "Hours" and a dash (—) instead of a value, with an accessible name that says hours are not tracked yet. It never shows a number or time.
   - Account button: `button` with accessible name "Your account"; no action.
3. `main` with `id="main"` containing exactly one `h1`.
4. `footer`: `instik`, "Say it: in-STICK", and links to Hosts and Pricing. About and Privacy appear as plain text, not links, until those pages exist.

### Placeholder page content

`h1` with the screen name, one short sentence in the brand voice saying it is on its way, and a
link back to a working page. No internal level names, no invented data.

## TargetText component contract

Input: `language: Language`, `children: string`, optional `variant: "ui" | "transcript"`.
Output: one element with `dir`, `lang` from the language; font and size from its script;
`unicode-bidi: isolate`; children unchanged.

## Titles

Each page exports metadata with a unique title: `{Screen} · Instik` (the landing page uses
`Instik — Your scroll time, but it counts.`).

# Contract: Routes and Screens

Extends [spec 001's routes contract](../../001-app-foundation-shell/contracts/routes.md).

## Routes

| Path | Screen | Notes |
|---|---|---|
| `/learn/{language}` | Library | Replaces the placeholder |
| `/learn/{language}/hosts` | (redirect) | Redirects to the first host by `order`; no hosts index screen |
| `/learn/{language}/hosts/{host}` | Host page | Statically generated for every host |
| `/learn/{language}/watch` | Player placeholder | Unchanged from spec 001 |
| `/learn/{language}/watch/{video}` | Player placeholder | Statically generated for every video; real player in spec 3 |

Unknown `{host}` or `{video}` values return the not-found page with status 404. Slugs are lowercase with no case folding. Path builders added to `routes.ts`: `hostPath(language, host)` and `watchVideoPath(language, video)`.

## Library page

Order of content inside `main`:

1. Pick-up banner: link to `watchVideoPath` of the named video. Text "Pick up where you left off", video title, "2:14 of 8:40 · with Salma" (values derived from the static position and the video's content), and a "Keep watching" action.
2. `h1` "Library" and a labelled search field "Search videos" (placeholder "Café, family, microbus…").
3. Two button groups with accessible names "Stage" and "Topic". Each button has `aria-pressed`. Stage is single-select and always one value; Topic is optional and pressing the selected topic clears it.
4. Count line (polite live region): `N videos at {Stage}. Your stage is Follow it.` when filtering; `N videos match "{query}".` when searching; `No videos at {Stage} yet. They are on the way.` when a stage is empty; `Nothing matches "{query}". Try a shorter word.` plus a "Clear search" button when a search is empty.
5. Grid of cards, then the end message "That's everything for this stage. New videos arrive every week." (while searching: "That's everything that matches.").

### Card

A single link to the watch path containing: `[Thumbnail]` placeholder area, stage chip, title, "`N min · with {Host}`", and, when `watched` is true, a "Watched" label. No Arabic text is shown on the card.

## Host page

`h1` is the Latin name. The Arabic name is in an element with `lang="arz"` and `dir="rtl"` (from language data). Sections in order: hero (photo placeholder, "Host · Egyptian Arabic", names, story, topic chips, "Watch {name} say hello" action), "Videos with {name}" (cards, no Watched slot needed), "Other hosts" (chips linking to each other host, plus the "More hosts joining soon" box). A host with no videos shows "{name}'s first videos are on the way." in place of the grid.

## Navigation

Hosts is marked `aria-current="page"` on `/hosts` and any `/hosts/...` path. Library remains exact match. Watch pages mark no item.

## Titles

Library: `Library · Instik`. Host: `{Name} · Instik`. Watch placeholder: `{Video title} · Instik`.

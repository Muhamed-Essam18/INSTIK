# Quickstart: Validating Content and Library

Prerequisites: Node and dependencies installed (`npm install`). Run from the repository root.

## 1. Automated gates

```text
npm run lint
npm run typecheck
npm test
npm run build
```

Expected: all pass; the build output lists the Library, every host page and every watch page for Egyptian Arabic. `npm test` includes the shipped-content test and one test per content defect type.

## 2. Content validation (User Story 4)

In a scratch copy of `content/arabic-egyptian/`, break one thing at a time and run `npm run build`:

| Change | Expected |
|---|---|
| Remove `title` from a video | Fails naming the file and `title` |
| Set `stage` to `beginner` | Fails listing allowed stages |
| Set `access` to `paid` | Fails listing `free`, `full` |
| Set `host` to `nobody` | Fails: unknown host |
| Copy a video file and keep the same `slug` | Fails: duplicate / mismatched slug |
| Rename a `.vtt` so no video matches | Fails: transcript has no video |
| Delete the first line `WEBVTT` | Fails: not a valid transcript |
| Remove a required glossary field | Fails naming the glossary entry |

Restore the file after each; the build passes again.

## 3. Library (User Stories 1 and 2)

Run `npm run dev` and open `http://localhost:3000/learn/arabic-egyptian`.

- Banner, "Library" heading, search, Stage and Topic groups, count line, cards and the end message match `docs/design/Library.dc.html` (Follow it selected: 4 videos).
- Select each stage; "Join in" shows the empty message. Select a topic, press it again to clear.
- Search `cafe` and `café`: "At the café" appears, across all stages. Search the Arabic title with and without tashkeel, and with `ا`, `أ`, `إ`: same result.
- Clear the search: the previous stage and topic view returns.
- Scroll to the bottom: nothing loads; the end message is the last thing.
- At 320px width: no sideways scroll, cards in one column, controls at least 44px high.
- Keyboard only: reach every filter, the search, every card; focus is visible.

## 4. Host page (User Story 3)

- Open `/learn/arabic-egyptian/hosts`: lands on Salma's page.
- Compare with `docs/design/Host.dc.html`: photo placeholder, Latin and Arabic names, story, topic chips, "Watch Salma say hello", "Videos with Salma" (only hers), "Other hosts" with Omar and the dashed box.
- Open Omar's page and `/hosts/nobody` (friendly not-found).
- The Hosts nav item is highlighted on every host page.

## 5. Links

From a Library card and a host-page card, activate a video: the URL becomes `/learn/arabic-egyptian/watch/<slug>` and the placeholder page shows that video's title. "Keep watching" on the banner goes to `/watch/at-the-cafe`.

## 6. Sample content (User Story 5)

Confirm: 8 videos (Hear it 2, Follow it 4, Understand it 2), 2 hosts, 2 `.vtt` files, glossary, and that every file is marked as sample.

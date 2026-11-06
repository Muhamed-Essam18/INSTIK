# Data Model: Content and Library

All data is files under `content/<language-slug>/`. Nothing is stored in a database.

## Layout

```text
content/arabic-egyptian/
├── glossary.json
├── hosts/<host-slug>.json
└── videos/
    ├── <video-slug>.json
    └── <video-slug>.vtt          # optional
```

The folder name equals a language `slug` in `content/languages.json`.

## Video (`videos/<slug>.json`)

| Field | Type | Rules |
|---|---|---|
| `title` | string | Required, non-empty |
| `titleArabic` | string | Optional; searchable only; stored with tashkeel |
| `slug` | string | Required; lowercase letters, digits, hyphens; MUST equal the file name; unique in the language |
| `stage` | `hear-it` \| `follow-it` \| `understand-it` \| `join-in` | Required |
| `topic` | `daily-life` \| `food` \| `family` \| `getting-around` \| `culture` | Required; one per video |
| `host` | string | Required; MUST be the slug of an existing host |
| `durationSeconds` | integer | Required; ≥ 1 |
| `access` | `free` \| `full` | Required |
| `playbackId` | string | Optional, non-empty when present (amended in spec 003: absent means the player shows a friendly placeholder) |
| `sample` | boolean | Optional; `true` on shipped sample content |

Derived: `minutes = max(1, floor(durationSeconds / 60))`; stage label from the taxonomy; language and variety from the language registry via the folder.

## Host (`hosts/<slug>.json`)

| Field | Type | Rules |
|---|---|---|
| `slug` | string | Required; equals file name; unique |
| `name` | string | Required (Latin) |
| `nameArabic` | string | Required; stored with tashkeel if the name has it |
| `story` | string | Required, non-empty |
| `topics` | string[] | Required; 1–6 non-empty chips, free text |
| `photo` | string \| null | Optional; path or URL when a photo exists; absent or null shows the placeholder |
| `order` | integer | Required; lower first; unique within the language |
| `sample` | boolean | Optional |

Relationship: a host has zero or more videos (found by `video.host`).

## Transcript (`videos/<slug>.vtt`)

WebVTT text. Requirements: first line `WEBVTT`; optional `NOTE` blocks (sample files carry `NOTE sample`); cues with valid start and end times, end after start, cues in order and not overlapping; non-empty cue text. A transcript MUST have a video with the same slug. A video does not need a transcript.

## Glossary (`glossary.json`)

```text
{ "sample": true?, "entries": [ { id, word, base, transliteration, english, audio? } ] }
```

| Field | Rules |
|---|---|
| `id` | Required; unique in the file |
| `word` | Required; Arabic with tashkeel |
| `base` | Required; base form |
| `transliteration` | Required |
| `english` | Required |
| `audio` | Optional path or URL |

Word links from transcript cues to glossary entries are defined in spec 3.

## Taxonomy (in code, `taxonomy.ts`)

| Stage slug | Learner label | Order |
|---|---|---|
| `hear-it` | Hear it | 1 |
| `follow-it` | Follow it | 2 |
| `understand-it` | Understand it | 3 |
| `join-in` | Join in | 4 |

Topics: Daily life, Food, Family, Getting around, Culture (slug and label pairs). Internal level names do not exist in the data model.

## Cross-file rules (build fails on any)

1. Every video's `host` exists.
2. Video slugs are unique and match file names; host slugs likewise; host `order` values are unique.
3. Every `.vtt` has a matching video; every transcript parses.
4. Glossary entry ids are unique.
5. Every `available` language has a content folder with at least one host and one video; `coming-soon` languages may have none.
6. The pick-up banner's video exists.

## Error format

One thrown error, first line `Invalid content in content/<language>`, then one line per problem: `<relative file>: <field or rule>: <message>`.

## View models

- **LibraryVideo** (passed to the client): `slug`, `title`, `stage`, `stageLabel`, `topic`, `minutes`, `hostName`, `hostSlug`, `searchKey` (normalised), `watched` (always false for now).
- **Library state**: `stage` (default `follow-it`), `topic` (or none), `query`. Result = all videos matching the query when the query is non-empty; otherwise videos matching stage and topic.

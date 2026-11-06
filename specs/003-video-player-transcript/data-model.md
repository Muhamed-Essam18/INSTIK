# Data Model: Video Player and Interactive Transcript

Content stays as files under `content/<language-slug>/`. Learner preferences live only in the browser on this device.

## Changed: Video (`videos/<slug>.json`)

Everything in the spec 002 data model stays, except:

| Field | Change |
|---|---|
| `playbackId` | Now optional. When present: non-empty string. Absent means the player shows a friendly placeholder. Ids starting with `sample-` play the repo sample clip; any other id is played through Mux. |

## Changed: Transcript (`videos/<slug>.vtt`)

Standard WebVTT as in spec 002 (header, optional `NOTE` blocks such as `NOTE sample`, ordered non-overlapping cues). New rule on the cue text: one line per layer, in this order, taken from the language's `transcriptLayers` in `content/languages.json` with `tashkeel` omitted.

| Language | Lines per cue |
|---|---|
| Egyptian Arabic | 3: script, transliteration, English |
| Spanish (when it has content) | 2: script, English |

- A layer with nothing to show is a single `-` on its line.
- The wrong number of lines in a cue fails the build with `<file>: transcript: line N: expected 3 lines (script, transliteration, english), found M`.
- The first (script) line MUST NOT be `-`.

### TranscriptLine (parsed, typed)

| Field | Type | Rules |
|---|---|---|
| `start` | number (seconds) | From the cue; cues are ordered and do not overlap |
| `end` | number (seconds) | After `start` |
| `script` | string | Arabic with tashkeel as stored; non-empty |
| `transliteration` | string \| null | `null` when the line was `-` or the language has no such layer |
| `english` | string \| null | Same |

### TranscriptView (what the page sends to the client)

| Field | Type | Notes |
|---|---|---|
| `lines[]` | `{ start, end, segments[], transliteration, english }` | Plain data, no functions |
| `segments[]` | `{ text, entryId? }` | Script split into words and punctuation; `entryId` only for words linked to a glossary entry |
| `entries` | `Record<entryId, { word, transliteration, english, audio? }>` | Only entries used by this transcript |

## Changed: Glossary entry

Fields as in spec 002. New build rules:

1. Matching key = `word` with tashkeel, tatweel and punctuation removed (no letter folding).
2. Two entries with the same key fail the build (`glossary.json: word: ambiguous "<key>" in entries "<id1>" and "<id2>"`).

### Word linking (build time, pure)

1. Split the script line into words and the punctuation or spaces between them.
2. At each word position try the longest run of words (up to the longest entry) whose joined key equals an entry key; take the first (longest) match.
3. Matched words become one segment with `entryId`; everything else is plain text (not tappable).

## Stored preferences (browser, on this device)

All values are parsed with a schema when read; anything invalid is ignored and the default applies.

| Key | Value | Default | Scope |
|---|---|---|---|
| `instik:v1:<language-slug>:layers` | `{ script: boolean, tashkeel: boolean, transliteration: boolean, english: boolean }` | `{ true, true, true, false }` | Per language, every video in it |
| `instik:v1:<language-slug>:understood:<video-slug>` | `"mostly"` \| `"some"` \| `"not-yet"` | none | Per video |
| `instik:v1:autoplay` | `boolean` | `false` | This device |
| (sessionStorage) `instik:v1:autoplay-next` | video slug | none | One navigation; removed once read |

Only layers the language actually has are shown as toggles (for example Spanish has no transliteration toggle).

## Derived values

- **Length line**: `{Stage label} · {formatLength(durationSeconds)} · {variety} {name}`, for example `Follow it · 8 min 40 s · Egyptian Arabic`. `formatLength`: `45 s`, `8 min`, `8 min 40 s`.
- **Clock**: `m:ss` from the media element (`2:14 / 8:40`); uses the element's real duration (the clip) once known, otherwise shows `0:00`.
- **Current line**: `findCueIndex(lines, time)`: index of the last line with `start <= time`; `-1` before the first.
- **Up next**: other videos at the same stage, library order after the current video, wrapping, at most three.

## Playback source (derived from `playbackId`)

| `playbackId` | Source | Behaviour |
|---|---|---|
| absent or blank | none | Friendly placeholder, no controls; transcript still shows and lines are not jump targets |
| starts with `sample-` | sample clip | Native video plays `/sample/sample-clip.mp4`; marked Sample |
| anything else | Mux | `MuxPlayer` with that playback id, built-in controls hidden |

## View models for the page

- **WatchPageData** (server only): video, host, language, length line, `TranscriptView | null`, up-next list (`LibraryVideo[]`), `nextHref` for autoplay.
- **Transcript panel props** (client): `languageSlug`, `language` (dir, lang, fonts), `layers` available, `view`.
- **Understanding check props**: `languageSlug`, `videoSlug`.

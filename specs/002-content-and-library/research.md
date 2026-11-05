# Research: Content and Library

No `NEEDS CLARIFICATION` items remained after the spec and clarification. These are the design decisions.

## 1. Where and how content is read

- **Decision**: A server-only loader (`load.ts`) reads `content/<slug>/` with Node file APIs at module load, parses with zod, runs cross-file validation, and throws one error listing every problem. Pages import typed accessors; `generateStaticParams` for hosts and watch pages calls them, so `next build` loads and validates content.
- **Rationale**: Matches how `languages.ts` already fails the build. Needs no new dependency and no build script. Marked `server-only` behaviour by living only in server imports (no `"use client"` file imports it; the client component gets plain props).
- **Alternatives**: A separate `validate:content` script (extra tool, can be skipped); a Next config hook (obscure); importing JSON statically (cannot enumerate a folder).

## 2. Folder name and language

- **Decision**: The folder under `content/` is the language slug (`content/arabic-egyptian/`). Language, code and variety come from `languages.json`, not repeated in each video file. A language marked `coming-soon` may have no folder; an `available` language without a folder fails the build.
- **Rationale**: One source for language facts; adding a language is data. `docs/product.md` lists language and variety as video metadata, but they are derived, so a file cannot disagree with the registry.
- **Alternatives**: Repeating `language` in each file and checking it matches the folder (more noise, same guarantee).

## 3. Video, host and glossary formats

- **Decision**: See [data-model.md](data-model.md). Key choices:
  - `stage` is a slug (`hear-it`, `follow-it`, `understand-it`, `join-in`) mapped to learner labels in one place, so label wording cannot drift. Internal level names are not representable.
  - `topic` is one slug from a fixed list of five. Host `topics` are free-text chips (the design mixes "Food" with a city and "The sea").
  - `durationSeconds` is an integer. Cards show whole minutes rounded down, minimum 1 (the design shows 8 min for 8:40).
  - `playbackId` is a non-empty string; sample ones are obviously fake.
  - Optional `titleArabic` on a video is searchable text only (not displayed, to stay on the approved card design). Host `nameArabic` is displayed and searchable.
  - Hosts have a required `order` integer so "first host" is deterministic.
  - `sample: true` on every shipped sample file and a `NOTE sample` line at the top of sample transcripts.
- **Rationale**: Smallest set that covers the spec's fields and the design; each extra field has a stated use.
- **Alternatives**: Free-text stage/topic (typos would hide videos); topics per language file (premature).

## 4. Transcript `.vtt` handling

- **Decision**: A small in-repo parser accepts WebVTT: `WEBVTT` header, optional `NOTE` blocks, cues with `HH:MM:SS.mmm --> HH:MM:SS.mmm` or `MM:SS.mmm`, non-empty text. Validation rejects a missing header, bad timestamps, end ≤ start, cues out of order, empty cues. Cue text stays plain here; word links into the glossary and the transcript layers are defined in spec 3 with the player.
- **Rationale**: This spec needs only "valid and matches a video". A full WebVTT dependency is not justified; the subset is easy to test.
- **Alternatives**: `webvtt-parser` or similar (new dependency, wider than needed).

## 5. Arabic and Latin search normalisation

- **Decision**: One pure `normalizeForSearch(text)`: NFKD → remove combining marks (strips Latin accents and Arabic tashkeel U+064B–U+065F, U+0670, U+06D6–U+06ED) → remove tatweel U+0640 → map أ إ آ ٱ → ا, ى → ي, ة → ه → lowercase → collapse whitespace → trim. Search splits the normalised query on spaces; every term must be a substring of the video's precomputed search key (title, Arabic title, host name, host Arabic name). Stored text is never altered.
- **Rationale**: Covers the spec's required variants and the constitution's pure, tested function rule. Precomputing the key on the server keeps the client light.
- **Alternatives**: Search-engine library (overkill for tens of items); only handling alef (spec asks for ى/ي and ة/ه as well).

## 6. Library state and URL

- **Decision**: Stage (default Follow it), topic (none) and query live in client state; the page is static. A non-empty (trimmed, normalised) query ignores stage and topic and searches all videos (clarification). Clearing it restores the selected view. State is not stored in the URL in this spec.
- **Rationale**: Matches the design and keeps the page fully static under Cache Components (reading `searchParams` would make it dynamic). Deep-linkable filters can be added later if needed.
- **Alternatives**: `searchParams` filters (dynamic rendering, more code, not requested).

## 7. Routes and the existing placeholders

- **Decision**:
  - `/learn/[language]/hosts` stays but redirects to the first host (spec 001 sends the Hosts nav here and rules out a hosts index screen).
  - `/learn/[language]/hosts/[host]` is the host page, statically generated.
  - `/learn/[language]/watch/[video]` is a placeholder page ("The player is on its way.") statically generated; `/watch` without a video stays as in spec 001.
  - `MainNav` marks Hosts as current on `/hosts` and any `/hosts/...` path; Library stays exact-match; watch pages mark nothing.
  - Under Cache Components `generateStaticParams` must return at least one value; the Egyptian Arabic content guarantees that, and a build error is acceptable if a language has none.
- **Rationale**: Keeps every existing link working, adds only what the spec requires, and keeps the nav truthful.
- **Alternatives**: A hosts index page (new screen outside the MVP list, violates principle I).

## 8. Host page details the design leaves open

- **Decision**: "Watch Salma say hello" links to the host's first video by stage order then title (the lowest stage). Hidden if the host has no videos. Photo: if `photo` is absent, show the design's coloured placeholder (sun for the first host, teal for later hosts) with accessible text that a photo is coming. Other hosts are chips with a round initial in teal, as in the design, plus the dashed "More hosts joining soon" box.
- **Rationale**: Avoids an extra "intro video" field and reuses the design as given.

## 9. Pick-up banner

- **Decision**: A static constant names the sample video slug and a position in seconds (134). The title, host and total length are read from content so the banner stays valid; the constant is replaced by real history later. If the named video is missing, the build fails (validated in the real-content test and at render).
- **Rationale**: Honest placeholder, no fake data outside the content files.

## 10. Testing approach

- **Decision**: Pure modules get direct tests. `validate.ts` takes in-memory files, so each defect in the spec (missing field, bad stage/topic/access, unknown host, duplicate or mismatched slug, orphan or malformed transcript, malformed glossary or host) is one small test. A separate test loads the shipped content to prove it builds. Components with no async work are tested with Testing Library; async Server Components are covered by build and quickstart.

# Implementation Plan: Video Player and Interactive Transcript

**Branch**: `003-video-player-transcript` | **Date**: 2026-11-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-video-player-transcript/spec.md`, plus the planning inputs: Mux with `@mux/mux-player-react`, placeholder playback IDs with a friendly placeholder when an ID is missing, a small typed `.vtt` parser with a unit-tested time-to-line lookup, `localStorage` behind a hook that reads only after mount, Server Component page with only the player, transcript and toggles as client components, Arabic lines through `TargetText`.

## Summary

The player page stays a Server Component (inside the same `<Suspense>`-around-params pattern as spec 002). It resolves the video, host, transcript and Up next on the server and hands plain, serialisable props to a few small client components: the player with its own controls, the transcript panel (toggles, lines, word card), the understanding check and the autoplay switch. A small client context (`PlaybackProvider`) lets those islands share the media element without lifting any content to the client.

Playback uses one set of custom controls (built to the approved design) over any media element. Real Mux playback IDs render `MuxPlayer` with its built-in controls hidden; sample IDs play the repo's sample clip in a native `<video>`; a missing ID shows a friendly placeholder. Transcript lines carry Arabic, transliteration and English; word links come from matching the Arabic text against the glossary at build time. Preferences live in `localStorage`, read only after mount through one hook, so server and first client render are identical. See [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 19.3, Next.js 16.4.5 (App Router, `cacheComponents` and `partialPrefetching` on)

**Primary Dependencies**: Existing: `zod`, Tailwind 4 tokens, `next/font`. New runtime dependency: `@mux/mux-player-react` (latest 3.14.1 checked: peers allow React 19; reason: Mux is the stack's video host, constitution VII). No other new dependencies; the sample clip is made once with a throwaway ffmpeg, which is not added to `package.json`.

**Storage**: Files for content (`content/<language>/`). Browser `localStorage` for transcript layers, understanding answers and the autoplay switch (device only, no server). One `sessionStorage` flag carries "autoplay the next video" across one navigation.

**Testing**: Vitest + React Testing Library (jsdom). Pure logic tested directly (cue lookup, transcript parsing, word linking, Up next, formatting, storage hook). Components tested with a fake media element and a stubbed `localStorage`. Async Server Components and real playback are checked by build and the quickstart in a real browser, including a clean console.

**Target Platform**: Evergreen browsers, 320px to desktop; Vercel

**Project Type**: Web application (single Next.js app)

**Performance Goals**: Highlight updates only when the current line changes (not on every time tick); player code for Mux loads only when a real playback ID needs it; page HTML is prerendered static.

**Constraints**: No hydration mismatches (nothing reads browser state during render); 44px targets; contrast ≥ 4.5:1; no horizontal scroll from 320px; autoplay off by default; no tracking, no server writes

**Scale/Scope**: 1 player page, about 12 components and 8 small modules; transcripts of tens to low hundreds of lines

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | How the plan complies |
|---|---|---|
| I. Product source of truth | Pass | MVP screen 4 (player and interactive transcript). Nothing outside it; Done for today stays a placeholder link |
| II. Brand behaviours | Pass | Autoplay off by default with a visible switch; the list ends with "That's all for Up next"; no score or streak on the check; every video shows its host; learner stage names only |
| III. Honest hours | Pass (n/a) | No time is counted or stored; the media element is only read for highlighting |
| IV. Multi-language by design | Pass | Transcript layers come from `transcriptLayers` in `languages.json`; storage keys include the language slug; Arabic blocks get `dir`/`lang` from language data via `TargetText`; no Egyptian Arabic strings in code |
| V. Arabic first-class | Pass | Tashkeel stripping is a pure tested function used for display and for glossary matching; stored text untouched; transcript font and size from tokens |
| VI. Design fidelity | Pass with one note | Built from `Player.dc.html` with tokens; custom controls replicate the design's control bar (Mux's own controls are hidden). The design shows a static progress bar; the plan makes it a labelled slider because the spec requires seeking |
| VII. Stack discipline | Pass | Server Component page; client components only where interaction needs them (player, transcript panel, understanding check, autoplay switch, provider). One new dependency, justified above. Next docs read for client components, `generateStaticParams` under Cache Components and the instant-shell Suspense rule |
| VIII. Content as files | Pass | Transcript format extension and glossary linking validated at build; invalid content still fails the build |
| IX. Quality | Pass | Tests for time-to-line lookup, transcript parsing and validation, word linking, Up next, storage hook and the interactive components; lint, type-check, build gates |
| X. Privacy and security | Pass | Nothing leaves the device; stored values are parsed with schemas and fall back to defaults when invalid; route params checked against content; playback IDs are public identifiers |

No violations. Re-check after design: still passes (see [data-model.md](data-model.md) and [contracts/](contracts/)).

## Project Structure

### Documentation (this feature)

```text
specs/003-video-player-transcript/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── transcript-files.md
│   └── player-page.md
├── checklists/requirements.md
└── tasks.md             # created later by /speckit-tasks
```

### Source Code (repository root)

```text
content/arabic-egyptian/
├── glossary.json                       # extended to cover the sample transcripts' words
└── videos/{my-family,at-the-cafe}.vtt  # rewritten with transliteration and English lines

public/sample/sample-clip.mp4           # 30 s sample clip, made for the project
scripts/make-sample-clip.mjs            # one-off generator (needs ffmpeg), output committed

src/
├── app/(shell)/learn/[language]/watch/[video]/page.tsx   # unchanged shape: Suspense + WatchScreen
├── hooks/
│   └── useStoredValue.ts               # client hook: default on first render, reads storage after mount
├── lib/
│   ├── text/normalize.ts               # + stripTashkeel (pure)
│   ├── player/
│   │   ├── cue-index.ts                # findCueIndex(cues, time): binary search (unit-tested)
│   │   ├── source.ts                   # resolveSource(playbackId) → mux | sample | none
│   │   ├── format.ts                   # clock "2:14", length "8 min 40 s"
│   │   └── preferences.ts              # storage keys + zod schemas for layers, answer, autoplay
│   └── content/
│       ├── schema.ts                   # playbackId becomes optional
│       ├── transcript.ts               # parseTranscript(layers, cues) → typed lines
│       ├── glossary-link.ts            # linkWords(script, glossary) → segments
│       ├── upnext.ts                   # getUpNext(videos, current) (pure)
│       ├── validate.ts                 # now validates transcript layers and glossary word uniqueness
│       └── index.ts                    # + getTranscriptView, getUpNextVideos
└── components/
    ├── TargetText.tsx                  # children widened to ReactNode, optional className
    ├── screens/WatchScreen.tsx         # Server Component: composes everything (replaces the placeholder)
    ├── player/
    │   ├── PlaybackProvider.tsx        # client context: media element, seek, end-of-video behaviour
    │   ├── VideoPlayer.tsx             # client: picks source, stage badge, sample badge, error and placeholder states
    │   └── PlayerControls.tsx          # client: play/pause, back 5 s, slider, time, speed, full screen
    ├── transcript/
    │   ├── TranscriptPanel.tsx         # client: layer state, lines, current line, word card
    │   ├── LayerToggles.tsx            # client: four toggle buttons
    │   └── WordCard.tsx                # client: dialog with entry and "Hear it"
    └── watch/
        ├── HostCard.tsx                # server
        ├── UpNext.tsx                  # server list + end message
        ├── AutoplaySwitch.tsx          # client leaf
        └── UnderstandingCheck.tsx      # client leaf

tests/unit/
├── cue-index.test.ts   transcript.test.ts   glossary-link.test.ts   upnext.test.ts
├── format.test.ts      source.test.ts       normalize.test.ts (extended)   content.validate.test.ts (extended)
├── useStoredValue.test.tsx   preferences.test.ts
├── TranscriptPanel.test.tsx  WordCard.test.tsx   VideoPlayer.test.tsx   UnderstandingCheck.test.tsx   AutoplaySwitch.test.tsx
└── content.real.test.ts (extended)   route-links.test.tsx (updated)
```

**Structure Decision**: Extends the existing `src/` layout. Pure logic sits in `src/lib/` where it can be tested without a DOM; the client hook is the one place that touches `localStorage`; client components are leaves or small islands. The page content (title, host card, Up next, headings, layout) is server-rendered. The `PlaybackProvider` receives those server-rendered pieces as `children`, so none of them become client code.

## Complexity Tracking

No constitution violations to justify. Two choices that look larger than needed and why they stay:

| Choice | Why needed | Simpler alternative rejected because |
|---|---|---|
| Custom controls over a media element instead of Mux's own controls | The spec needs exact controls (back 5 s, 0.9×/0.75×, labelled, 44px) in the approved design, and the same controls must also drive the sample clip | Mux's built-in chrome cannot be matched to the design and does not apply to the native sample clip |
| Three video sources (Mux, sample clip, none) | Real IDs do not exist yet; the clarified spec requires a repo sample clip so controls and sync are testable; a missing ID must be friendly | Mux-only would leave nothing to play, because Mux's `src` option is undocumented and fake IDs return errors |

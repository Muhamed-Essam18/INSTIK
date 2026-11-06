# Research: Video Player and Interactive Transcript

No `NEEDS CLARIFICATION` items remained. These are the decisions, including where the planning inputs and the clarified spec had to be reconciled.

## 1. Video source: Mux, sample clip, or none

- **Decision**: One resolver, `resolveSource(playbackId)`, returns one of:
  - `none` when the ID is absent or blank: a friendly placeholder ("This video is on its way.") with no controls.
  - `sample` when the ID starts with `sample-`: a native `<video>` playing `/sample/sample-clip.mp4`.
  - `mux` for any other ID: `MuxPlayer` with that playback ID.
- **Rationale**: Your input says to use Mux with placeholder IDs and a friendly placeholder when an ID is missing. The clarified spec says a repo sample clip plays for every sample video so controls and highlighting can be tried and tested. Mux's reference lists `src` as undocumented, and made-up Mux IDs only produce errors, so Mux alone cannot satisfy the clarified spec. The sample IDs already in the content files (`sample-playback-id-<slug>`) make the split automatic and keep the content files unchanged. Real uploads later need only a real ID.
- **Alternatives**: Mux-only with fake IDs (nothing plays, nothing testable); relying on Mux `src` (undocumented, may break); a fake clock instead of a clip (rejected by the clarification).

## 2. Mux player integration

- **Decision**: Use `@mux/mux-player-react` (3.14.1). Hide its own controls with the documented CSS variable `--controls: none`, set `nohotkeys`, `playsInline`, and pass `playbackId`, `streamType="on-demand"`, a metadata title. The player renders only after mount, so no custom-element output can differ between server and client. Because it ships a lazy variant, import `@mux/mux-player-react/lazy` so its code is not loaded for sample or missing-ID videos.
- **Rationale**: The page controls (spec FR-005 to FR-008) are built once over the element's media API (`currentTime`, `playbackRate`, `play()`, events) and work for both Mux and the native clip. Documented attributes `backward-seek-offset` and `playbackrates` exist but would still be Mux's chrome.
- **Alternatives**: Mux's built-in controls themed with CSS variables (cannot match the design, sample clip would need a second set of controls anyway); `@mux/mux-video-react` (not what was asked for).

## 3. Playback API shared by both sources

- **Decision**: Controls and the transcript use a minimal media interface (`currentTime`, `duration`, `paused`, `playbackRate`, `play`, `pause`, `addEventListener`) satisfied by both `HTMLVideoElement` and the Mux player element. The element is registered with the `PlaybackProvider` through a ref callback.
- **Rationale**: One code path for every control and test; tests use a plain fake that implements the interface.

## 4. Where client code stops

- **Decision**: Server Component: the page (`WatchScreen`), headings, title and length line, host card, Up next list and its end message. Client components: `PlaybackProvider`, `VideoPlayer` and `PlayerControls`, `TranscriptPanel` with `LayerToggles` and `WordCard`, plus two leaves you did not list but that need storage and events: `UnderstandingCheck` and `AutoplaySwitch`. Server content reaches the client only as props (plain data) or as `children`.
- **Rationale**: Matches your instruction as far as possible. The check and the switch must read `localStorage` and respond to clicks, so they cannot be Server Components; keeping them as tiny leaves keeps the rest static.

## 5. Transcript content format

- **Decision**: Keep standard WebVTT. Each cue's text has one line per layer, in the order of the language's `transcriptLayers` in `content/languages.json` with `tashkeel` left out (it is derived from the script). For Egyptian Arabic: script line, transliteration line, English line. A layer with nothing to show is written as a single `-`. `parseVtt` (spec 002) stays generic; new `parseTranscript(layers, cues)` splits and validates the lines and returns typed objects. A cue with the wrong number of lines fails the build with the file and line.
- **Rationale**: Plain text files that editors can read and diff; no markup inside right-to-left text; adding a language only changes `transcriptLayers`.
- **Alternatives**: Inline markers for word links (confuse bidirectional text); a JSON sidecar per transcript (two files to keep in sync); labelled lines like `ar:` (clutter, bidi problems).

## 6. Word links: derived from the glossary

- **Decision**: No markup. At build time, `linkWords(script, glossary)` splits the script line into words and punctuation and links each word, or run of words, whose text matches a glossary `word` after removing tashkeel, tatweel and surrounding punctuation. Longest match wins, so multi-word entries such as "مِن فَضْلَك" work. No letter folding is used (unlike search) so that different letters never link to the wrong entry. Two glossary entries that match the same text without tashkeel fail the build as ambiguous.
- **Rationale**: Zero authoring effort and a rule the build can enforce. Satisfies FR-015 and FR-021: a word is tappable exactly when an entry exists.
- **Alternatives**: Manual links on every word (error-prone); fuzzy matching with letter folding (wrong entries).
- **Known limit**: Homographs (one spelling, two meanings) are not supported; they fail the build as ambiguous until explicit links are introduced later.

## 7. Tashkeel toggle

- **Decision**: Pure `stripTashkeel(text)` (marks U+064B–U+065F, U+0670, U+06D6–U+06ED and tatweel) added to `src/lib/text/normalize.ts` and used to render the Arabic layer when tashkeel is off, and by `linkWords`. Search normalisation keeps using `normalizeForSearch` which now builds on it.
- **Rationale**: One definition of "remove tashkeel" for matching and display; stored text is never changed.

## 8. Time-to-line lookup

- **Decision**: `findCueIndex(cues, time)` returns the index of the last cue whose start is at or before `time`, or `-1` before the first cue, using binary search over cues sorted by start (the parser already enforces order). Highlight uses start times only, so gaps keep the previous line and the last line stays after the end. The transcript derives the current index from `timeupdate`, `seeking` and `seeked` events and only updates React state when the index changes.
- **Rationale**: Handles any speed and any seek with no timers; cheap on long transcripts; trivially unit-testable. `timeupdate` (about 4 per second) meets the 0.5 s accuracy goal.
- **Alternatives**: `requestAnimationFrame` polling (wasteful); per-cue timers (break on seek and speed change).

## 9. Local storage hook

- **Decision**: `useStoredValue(key, schema, defaultValue)` returns `[value, setValue, ready]`. First render, on server and client, always uses `defaultValue`. After mount an effect reads the key, parses it with the zod schema and, if valid and different, updates state and sets `ready`. `setValue` updates state and writes back, never before `ready`, wrapped in `try/catch` so private mode or quota errors keep the in-memory value working. Invalid or old data falls back to the default. Keys: `instik:v1:<language>:layers`, `instik:v1:<language>:understood:<video>`, `instik:v1:autoplay`.
- **Rationale**: Exactly the requested "reads only after mount", with no browser access during render, so no hydration mismatch. The visible cost is that remembered choices appear one render after mount; the layout is the same either way. A `ready` flag lets components avoid a visible flash by disabling the toggle's transition until ready.
- **Alternatives**: `useSyncExternalStore` with a server snapshot (valid, but not what was asked and more code); reading storage in a state initialiser (causes the mismatch we are avoiding).

## 10. Autoplay across a navigation

- **Decision**: When the video ends and the autoplay switch is on, the `PlaybackProvider` sets a `sessionStorage` flag with the next slug and calls `router.push` to the first Up next video. The next page's player reads and clears the flag after mount and asks the element to play; if the browser refuses, it just shows the play button. With the switch off nothing happens apart from the understanding-check behaviour.
- **Rationale**: Keeps the page static (no query string, no `searchParams`), follows spec FR-029, and fails safe.

## 11. End of video and the understanding check

- **Decision**: On `ended` with autoplay off: leave full screen if active, scroll the check into view (instant if `prefers-reduced-motion`, evaluated at that moment) and focus its first answer, without choosing one. With autoplay on: navigate instead (research 10). The check registers its first button with the provider through a ref.
- **Rationale**: Clarification outcome (spec FR-025a).

## 12. Up next

- **Decision**: `getUpNext(videos, current)`: same stage, excluding the current video, in library order starting after the current video and wrapping around, at most three. Pure and tested. Rendered on the server with `VideoCard`; the switch beside the heading is the client leaf; the end line links to `donePath`.

## 13. Content-schema changes

- **Decision**: `playbackId` becomes optional in the video schema (still non-empty when present), so content can exist before upload and the player can show its placeholder. `validate.ts` also checks transcript layers and glossary ambiguity. Existing sample transcripts and glossary are updated; the schema and validation tests are extended. This amends spec 002's FR-002 (playback id required); the amendment is recorded in this plan's contracts and the spec 002 data model note.
- **Rationale**: Without it the "missing ID" placeholder could never occur.

## 14. Sample clip

- **Decision**: `scripts/make-sample-clip.mjs` builds a 30 s, 640×360, low-bitrate H.264/AAC clip from ffmpeg's generated test pattern and tone (no third-party footage) into `public/sample/sample-clip.mp4`; the result is committed (about 0.3 MB). ffmpeg is not installed on this machine, so the script can run a throwaway copy (for example through `npx ffmpeg-static`) without adding anything to `package.json`. The word "Sample" is an HTML badge over the video, not burned into the pixels, so no font is needed.
- **Rationale**: The clarification says the clip lives in the repo and is marked Sample; 30 s covers the sample transcripts (the longest line ends at 16 s) with room to test seeking.

## 15. Hydration and console safety

- **Decision**: Nothing in a render path reads `window`, `document`, `localStorage`, `matchMedia`, `Date` or randomness. Browser-dependent reads happen in effects or event handlers: stored preferences, `document.fullscreenEnabled` (to show or hide the full-screen button), reduced-motion preference (read when scrolling). The Mux player mounts after mount. Server and first client render therefore match.
- **Rationale**: Spec FR-033 and SC-009, and the earlier hydration clean-up. Verification is in the quickstart (real browser console on first load, toggles, word card, check, Up next, full screen).

## 16. Testing approach

- **Decision**: See the plan. jsdom lacks media playback, so tests use a fake media element object with settable `currentTime`, `playbackRate`, `paused`, and a small event emitter; `HTMLMediaElement.prototype.play`/`pause` are stubbed where a real `<video>` is rendered. Highlight accuracy, jump accuracy and all speeds are tested through the fake element; real playback is exercised in the browser quickstart.

## Amendment (during implementation): storage hook built on `useSyncExternalStore`

The effect-based hook in decision 9 fails this project's lint (`react-hooks/set-state-in-effect` is an error, verified on a probe file). `useStoredValue` therefore uses `useSyncExternalStore`: the server snapshot (used on the server and during hydration) is always the default, and the stored value is read from the browser store once hydration has finished. The guarantee is the same as decision 9 (server HTML equals the first client render; stored values appear only after hydration) and `ready` is true once hydrated. A hydration test (`hydrateRoot` over server HTML with a stored value) proves there is no mismatch.

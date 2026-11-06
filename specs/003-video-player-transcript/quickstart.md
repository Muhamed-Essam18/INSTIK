# Quickstart: Validating the Player and Transcript

Prerequisites: `npm install` (adds `@mux/mux-player-react`). Run from the repository root. Use a browser with extensions that edit pages turned off (or a private window) so the console is trustworthy.

## 1. Automated gates

```text
npm run lint
npm run typecheck
npm test
npm run build
```

Expected: all pass; the build prerenders `/learn/arabic-egyptian/watch/<slug>` for every sample video.

## 2. Content rules (US2, US4 data)

In a scratch copy of the content, break one thing at a time and run `npm run build`:

| Change | Expected |
|---|---|
| Remove the English line from one cue in `at-the-cafe.vtt` | Fails naming the file and line: expected 3 lines |
| Make a cue's first line `-` | Fails |
| Add a second glossary entry whose word differs only by tashkeel | Fails: ambiguous |
| Remove `playbackId` from a video | Build passes; the page shows the placeholder |

Restore after each.

## 3. Player (US1)

Run `npm run dev`, open `http://localhost:3000/learn/arabic-egyptian/watch/at-the-cafe`.

- Layout matches `docs/design/Player.dc.html`: stage badge on the video, "Sample" badge, host card, check, Up next, transcript on the right (below at phone width).
- The video does not start by itself. Play, pause, back 5 seconds (at 0:03 it goes to 0:00), speed cycles 1× → 0.9× → 0.75× → 1×, full screen and back, drag the slider.
- Host card goes to the host page. `/watch/nope` shows not-found.
- Remove the playback id from a video file: friendly placeholder, no controls, the rest of the page works.

## 4. Transcript (US2, US3)

- While the clip plays the highlighted line moves with the speech at 1×, 0.9× and 0.75×; the list scrolls inside the panel and the page does not.
- Click an earlier and a later line: the video jumps and the highlight follows. Drag the slider: the highlight follows.
- Toggle each layer; Tashkeel turns off the vowel marks and is unavailable when Arabic is off; all layers off shows the hint.
- Reload, then open `my-family`: the same layers apply. Open it in a private window: defaults apply.
- Videos without a transcript show "The transcript is on its way." and still play.

## 5. Words (US4)

- Tap a linked word: the card shows the word with tashkeel, transliteration, meaning; no "Hear it" button for the sample glossary (no audio). Escape, tapping outside, and tapping the word again close it; focus returns to the word.
- Words without an entry are not buttons and do nothing. With tashkeel off the linked words still open with tashkeel in the card.
- (If you add an `audio` URL to an entry, "Hear it" appears and plays without moving the video.)

## 6. Understanding check and Up next (US5, US6)

- Pick each answer, reload: the same answer is selected; change it; leave it blank on another video: nothing is blocked.
- Let the clip end with autoplay off: the check scrolls into view and "Mostly" has focus; no answer is chosen; with the browser in full screen it leaves full screen first.
- Up next shows up to three other videos at the same stage, never the current one, then the closing line and "finish for today" goes to Done for today.
- Autoplay switch is off on first visit; switch it on, reload: still on; let the clip end: the first Up next video opens (and plays if the browser allows).

## 7. Console and accessibility (SC-009, SC-008)

With a clean browser profile, open the player page and repeat sections 3–6: the console shows no errors, no warnings about hydration and no Suspense/params errors. Keyboard only: every control, the slider, each transcript line, every linked word and the check are reachable; focus is visible. At 320px width there is no sideways scroll.

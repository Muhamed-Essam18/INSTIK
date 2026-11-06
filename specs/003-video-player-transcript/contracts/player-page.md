# Contract: Player Page

Route (from spec 002): `/learn/{language}/watch/{video}`. Unknown video: friendly not-found page. The page is a Server Component; the parts marked **client** are the only client code.

## Layout

Wide screens: video column (flexible) beside the Transcript panel (420–560px). Phones: one column, transcript below the video. No sideways scroll from 320px.

## Video column, top to bottom

1. **Video area (client)** 16:9, rounded, ink background.
   - Stage badge top right (teal pill, ink label, e.g. "Follow it").
   - "Sample" badge top left for sample-clip videos only.
   - Big coral play button in the middle until playback starts.
   - Bottom bar: seek slider (progress), then Play/Pause, Back 5 seconds, `m:ss / m:ss`, speed button, Full screen.
   - Placeholder state (no playback id): friendly message "This video is on its way." with no controls.
   - Error state (media fails): short kind message with a link back to the Library; everything else keeps working.
2. **Title row (server)** `h1` title; line `Stage · length · Variety Name`; **Host card** (link to the host page: round initial, "Your host", name).
3. **Understanding check (client)** `فاهم؟` (Arabic, `lang`/`dir` from language data), "Did you follow this one?", note "No score. It just helps us pick what's up next.", group "How much did you understand" with buttons Mostly, Some of it, Not yet (`aria-pressed`).
4. **Up next (server + switch)** `h2` "Up next"; "Autoplay next" switch (**client**, button with `aria-pressed`, off by default); up to three `VideoCard`s; closing line "That's all for Up next. Pick one when you're ready, or finish for today." where "finish for today" links to `/learn/{language}/done`.

## Transcript panel (client)

`aside` labelled "Transcript" with `h2`, a group "Show in transcript" of toggle buttons (`aria-pressed`): Arabic, Tashkeel, Transliteration, English (only layers the language has). Tashkeel is disabled while Arabic is off. Then an ordered list of lines, then the note "Tap any word for its meaning."

### Line

A button-like row (`li` containing a `button`) with time (`m:ss`), then the enabled layers in order: Arabic (`TargetText`, transcript variant, with word buttons), transliteration (italic), English. The current line has `aria-current="true"` and the highlight background. Activating the row's time/background area seeks to the line's start; word buttons only open the word card (they do not seek).

A video without a transcript shows "The transcript is on its way." in place of the list and toggles. All layers off: lines show time and "Switch a layer on to read along."

### Word card

`role="dialog"` labelled `Word: <english>`, dark card as in the design: word with tashkeel (`lang`/`dir`), transliteration, English meaning, and a round "Hear it" button only when the entry has audio. Closes on Escape, on activating the same word, and on pointer or focus outside; opening another word replaces it; focus returns to the word. Playing the audio does not change the video.

## Behaviours

| Event | Result |
|---|---|
| Page loads | Nothing plays; defaults or remembered layers apply after mount |
| `timeupdate`, `seeking`, `seeked` | Current line recomputed from the element's time; state updates only when the line changes; the transcript list scrolls (list only, never the page) to keep it visible, instantly when reduced motion is preferred |
| Click a line | Seek to its start; keep playing or paused state |
| Back 5 s | `time = max(0, time − 5)` |
| Speed button | Cycles 1× → 0.9× → 0.75× → 1×; label shows the current speed; applies to the element; not remembered |
| Full screen | Wrapper requests full screen; button hidden when the device cannot |
| `ended`, autoplay off | Leave full screen if needed; scroll the check into view; focus "Mostly"; select nothing |
| `ended`, autoplay on | Navigate to the first Up next video and start it (if the browser allows); check is not touched |
| Media `error` | Show the error state |

## Storage keys (device only)

See [../data-model.md](../data-model.md). Reads happen after mount only; first render always uses defaults, so server HTML and first client render match.

## Accessibility

All controls are real `button`s (or a labelled slider) with accessible names, visible focus and at least 44px targets. Play/Pause changes its label; speed and full screen expose their state; the slider has a text value (`2:14 of 8:40`). Colour pairs follow the design tokens (coral only as fill with ink label).

## Titles

`{Video title} · Instik`.

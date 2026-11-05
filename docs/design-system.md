# Instik

**Your scroll time, but it counts.** Instik is a comprehensible-input video platform for picking up languages, starting with Egyptian Arabic. This design system turns the Instik Brand Guide (Draft 1, October 2026) into tokens and rules for every screen. Where the guide gave candidates (fonts) this system picks one and says so; values marked *Derived* were added for accessibility and should be confirmed by the brand designer.

## Personality

Check every design decision against these pairs.

| We are | We are not |
| --- | --- |
| Human and real | Synthetic, AI-generated, stock |
| Warm and patient | Pushy, guilt-tripping |
| Alive and playful | A textbook |
| Made for adults | Childish or cartoonish |
| Honest about progress | Hype ("fluent in 30 days") |
| Calm and focused | Loud and addictive |

## Content fundamentals

Short sentences. Everyday words. Talk like a friend who speaks the language, not a teacher. Say what is true and specific (hours, stages). Never shame. A little humour about scrolling is welcome; never mock the learner.

- Use: watch, understand, hours, pick up. Avoid: hack, master, crush it, unlock your potential, polyglot, lingo.
- Hour thresholds are always "estimates", never promises.
- Learner-facing terms: **Hours** (the counter), **Roadmap** (the stages), **Hosts** (the people), **Up next** (recommendations), **Done for today** (end of session).
- Stage names (to test): Hear it → Follow it → Understand it → Join in. Keep internal tags (Superbeginner, Beginner) out of learner copy.

| Instead of | Write |
| --- | --- |
| "You're on a 12-day streak! Don't break it!" | "12 hours of Egyptian Arabic so far. Nice." |
| "Time to practise your vocabulary!" | "Your next video is ready when you are." |
| "Congratulations, you completed Level 1!" | "You can now follow slow, everyday Egyptian Arabic. That's real." |
| (end of session) | "That's enough for today. See you tomorrow." |

## Colour

The page ground is `cream`; text is `ink`. Cards, inputs and the player panel sit on `paper`.

- `coral` is the brand's voice but a **fill only**: the primary button, the hours ring, active states. Labels on coral are `ink` (5.5:1); white on coral fails (2.8:1). Coral text on light grounds uses `coral-text`.
- `teal` means progress and understanding: roadmap stages reached, the فاهم؟ check. Labels on teal are `ink`; teal text uses `teal-text`.
- `sun` is for small highlights only (a new-word marker, a milestone). Never a large field.
- `slate` is secondary text. `hairline` draws dividers; input borders use `slate` so they reach 3:1.
- Avoid gold-and-sand palettes, pink-purple-orange gradients and anything that echoes the Instagram camera.

## Typography

- Headlines: **Nunito** (`display` family), weights 700–800. Picked from the guide's candidates (Nunito, Poppins, DM Sans) for its rounded warmth; revisit when the wordmark is drawn.
- Body and UI: **Inter** (`sans`).
- Arabic UI: **IBM Plex Sans Arabic** (`arabic`). Transcripts: **Noto Naskh Arabic** (`naskh`) with tashkeel.
- Arabic is a brand asset: wherever Arabic and Latin appear together they should look balanced, which means Arabic sets about 1.4× the Latin size (`transcript` 26px next to `body` 16px) with tall line height so vowel marks never collide.
- Every Arabic element carries `dir="rtl"` and `lang="arz"`; the interface around it stays left-to-right English.
- All four are Google Fonts; load them with a real fallback stack (already in the family tokens).

## Layout, shape and depth

- Spacing runs on a 4px base: `space-4` card padding on mobile, `space-6` on desktop, `space-12` between sections.
- Corners are friendly: `radius-md` buttons, `radius-lg` video cards and the player, `radius-pill` for level badges and the hours pill. No sharp corners.
- Depth is soft: `shadow-sm` for cards, `shadow-md` for the word tooltip and sheets. Prefer space over borders.
- Lists end. No infinite scroll layouts; every list and session has a visible end.

## Imagery

- Photography: real hosts, real places, natural light. No stock models, never AI-generated faces.
- Illustration: hand-drawn, warm and simple, matching the drawings in the Superbeginner videos.
- No pyramids, camels or other tourist clichés.

## Iconography

No icon set chosen yet. Use a rounded line set at 2px stroke with round caps so icons match Nunito's softness; icons inherit `ink` or `slate`, never coral text colour.

## Logo

No logo exists yet. Until the designer delivers it, set the name as lowercase **instik** in Nunito 800 in `ink`; in sentences write **Instik** with a capital I. Directions under exploration: the dot of the i as a play button or speech bubble, or a speech-bubble tail on the final k. A native designer will propose the Arabic wordmark.

## Motion and sound

Calm, short, purposeful. No bouncing, no confetti. One soft, optional sound when an hour is added.

## Product behaviours the design must show

No infinite scroll; a "Done for today" screen; honest hours only; a rhythm view (days you watched) instead of streaks; level check offered, never forced; every video shows its host; autoplay-next off by default; kind, rare notifications.

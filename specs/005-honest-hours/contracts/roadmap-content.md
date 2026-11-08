# Contract: Roadmap estimates in `content/languages.json`

Stage hour estimates are an open product decision (`docs/product.md`, "Still to decide"). Until it is made they are **clearly marked placeholders** held in data, read through one function, and always presented to learners as "an estimate".

## Shape

An optional `roadmap` object on a language:

```json
{
  "code": "arz",
  "slug": "arabic-egyptian",
  "roadmap": {
    "status": "placeholder",
    "note": "PLACEHOLDER estimates until decided (docs/product.md, Still to decide). Cumulative hours at which each stage ends.",
    "stageEndsAtHours": {
      "HEAR_IT": 30,
      "FOLLOW_IT": 100,
      "UNDERSTAND_IT": 250
    }
  }
}
```

| Field | Rule |
|---|---|
| `roadmap` | Optional. Absent means "no estimates"; the Roadmap then omits every "more hours" line and shows the ring without a stage target |
| `status` | `"placeholder"` or `"decided"` (required when `roadmap` exists) |
| `note` | Required and non-empty while `status` is `"placeholder"`; it must contain the word `PLACEHOLDER` so it cannot be missed in review |
| `stageEndsAtHours` | Object keyed by `HEAR_IT`, `FOLLOW_IT`, `UNDERSTAND_IT`; each a positive number of **cumulative** hours at which the learner reaches the next stage. Values must be strictly increasing in stage order. Any subset that starts at `HEAR_IT` and has no gaps is allowed; `JOIN_IN` has no end and is not a key |

Invalid content fails `next build` through `languages.schema.ts`, with one readable list of problems (constitution VIII), like the rest of the file.

## Accessor

```ts
// src/lib/languages.ts
getRoadmapEstimates(language: Language): { endsAtHours: Partial<Record<Stage, number>>; status: "placeholder" | "decided" } | undefined
```

All code reads estimates through this function. Nothing else imports the JSON shape, so replacing the placeholders is a data edit.

## How the numbers are used

- `stages.ts` takes `endsAtHours` and the learner's total hours; it does not know about languages.
- Remaining hours for the current stage: `ends − max(totalHours, start)` where `start` is the previous stage's end (or 0), rounded **up** to a whole hour with a minimum of 1 while the stage is unfinished, worded "About N more hours to <next stage> (an estimate)".
- Passing the estimate advances the stage (forward only). There is never a negative, "overdue" or "behind" figure.
- At `JOIN_IN`, or when a stage has no estimate, the line is omitted and the ring is full for `JOIN_IN` and empty otherwise.

## Placeholder values (this release)

| Language | HEAR_IT | FOLLOW_IT | UNDERSTAND_IT | Status |
|---|---|---|---|---|
| Egyptian Arabic (`arz`) | 30 | 100 | 250 | placeholder |
| Spanish (`es`) | none | none | none | no block (coming soon) |

The values are invented to make the screens work. They carry no claim about how long learning takes and must not appear in marketing copy.

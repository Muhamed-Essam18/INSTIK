# Contract: Content Files

The interface for content editors. Field rules are in [../data-model.md](../data-model.md).

## Example video file: `content/arabic-egyptian/videos/at-the-cafe.json`

```json
{
  "sample": true,
  "title": "At the café",
  "titleArabic": "في الكافيه",
  "slug": "at-the-cafe",
  "stage": "follow-it",
  "topic": "food",
  "host": "salma",
  "durationSeconds": 520,
  "access": "free",
  "playbackId": "sample-playback-id-at-the-cafe"
}
```

## Example host file: `content/arabic-egyptian/hosts/salma.json`

```json
{
  "sample": true,
  "slug": "salma",
  "name": "Salma",
  "nameArabic": "سلمى",
  "story": "[Sample] ...",
  "topics": ["Alexandria", "Food", "Family", "The sea"],
  "photo": null,
  "order": 1
}
```

## Example transcript: `content/arabic-egyptian/videos/at-the-cafe.vtt`

```text
WEBVTT

NOTE sample

00:00:02.000 --> 00:00:05.500
...
```

## Build behaviour

| Situation | Result |
|---|---|
| All files valid | Build succeeds |
| Any rule in data-model "Cross-file rules" or any field rule broken | Build fails with `Invalid content in content/<language>` and one line per problem naming the file |
| Unknown stage, topic or access value | Fails; message lists the allowed values |
| File name and `slug` differ | Fails |
| Extra unknown field in a JSON file | Fails (strict objects) so typos are caught |
| `.vtt` with no matching video | Fails |
| Video with no `.vtt` | Allowed |
| `coming-soon` language with no folder | Allowed |

## Marking sample content

Every shipped sample JSON file has `"sample": true`; sample transcripts start with `NOTE sample`; host stories and the glossary are marked the same way. Real content removes the marker.

## Adding a video

1. Upload the video in the video host dashboard and copy its playback id.
2. Add `videos/<slug>.json` (and optionally `<slug>.vtt`).
3. Run the build or tests; fix any reported problem.

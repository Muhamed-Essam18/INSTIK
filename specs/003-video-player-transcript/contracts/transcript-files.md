# Contract: Transcript and Glossary Files

Extends [the spec 002 content contract](../../002-content-and-library/contracts/content-files.md). Field rules are in [../data-model.md](../data-model.md).

## Transcript: `content/arabic-egyptian/videos/at-the-cafe.vtt`

```text
WEBVTT

NOTE sample

00:00:02.000 --> 00:00:04.000
صَباح الخَيْر!
ṣabāḥ el-khēr!
Good morning!

00:00:04.500 --> 00:00:08.000
عَايْزَة قَهْوَة مِن فَضْلَك.
ʿāyza ahwa min faḍlak.
I would like a coffee, please.
```

Each cue has exactly three text lines for Egyptian Arabic: Arabic script (with tashkeel), transliteration, English. A layer with nothing to show is written as `-`. No markup is needed for word links; they come from the glossary.

## Glossary: `content/arabic-egyptian/glossary.json`

```json
{
  "sample": true,
  "entries": [
    { "id": "ahwa", "word": "القَهْوَة", "base": "قهوة", "transliteration": "el-ahwa", "english": "the coffee" },
    { "id": "men-fadlak", "word": "مِن فَضْلَك", "base": "من فضلك", "transliteration": "min faḍlak", "english": "please" }
  ]
}
```

Any Arabic word in a transcript that matches a glossary `word` (ignoring tashkeel and punctuation) is tappable in the player; a run of words matching a multi-word entry is one tappable unit. Words with no entry are plain text.

## Build behaviour

| Situation | Result |
|---|---|
| Cue with the wrong number of lines | Fails: `<file>: transcript: line N: expected 3 lines (script, transliteration, english), found M` |
| Empty script line or script line `-` | Fails: names the file and line |
| Two glossary entries that match the same text without tashkeel | Fails: `glossary.json: word: ambiguous ...` |
| Word in a transcript with no glossary entry | Allowed; not tappable |
| Video without a transcript | Allowed; the page shows "transcript is on its way" |
| `playbackId` missing in a video file | Allowed; the page shows the friendly placeholder instead of a player |
| `.vtt` header, timing and ordering problems | Fail, as in spec 002 |

## Adding a language

Add its `transcriptLayers` in `content/languages.json`; transcript cues then need one line per layer in that order, without `tashkeel`.

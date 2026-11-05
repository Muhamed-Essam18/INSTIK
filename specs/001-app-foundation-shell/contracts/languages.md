# Contract: `content/languages.json`

## Shape

```json
{
  "languages": [
    {
      "code": "arz",
      "slug": "arabic-egyptian",
      "name": "Arabic",
      "variety": "Egyptian",
      "nativeName": "مصري",
      "script": "arabic",
      "direction": "rtl",
      "status": "available",
      "fonts": { "ui": "arabic", "transcript": "naskh" },
      "transcriptLayers": ["script", "tashkeel", "transliteration", "english"]
    },
    {
      "code": "es",
      "slug": "spanish",
      "name": "Spanish",
      "nativeName": "Español",
      "script": "latin",
      "direction": "ltr",
      "status": "coming-soon",
      "fonts": { "ui": "sans", "transcript": "sans" },
      "transcriptLayers": ["script", "english"]
    }
  ]
}
```

## Validation (build fails on any violation)

| Rule | Example failure message |
|---|---|
| File parses as JSON with a non-empty `languages` array | `languages.json: expected a non-empty "languages" array` |
| Required fields present: `code`, `slug`, `name`, `nativeName`, `script`, `direction`, `status`, `fonts`, `transcriptLayers` | `languages[1]: "direction" is required` |
| `slug` matches `^[a-z0-9]+(-[a-z0-9]+)*$` | `languages[0].slug: "Arabic Egyptian" is not a valid slug` |
| `direction` is `rtl` or `ltr` | `languages[0].direction: expected "rtl" or "ltr"` |
| `status` is `available` or `coming-soon` | `languages[1].status: expected "available" or "coming-soon"` |
| `script` is `arabic` or `latin` | `languages[0].script: expected "arabic" or "latin"` |
| `fonts.ui` and `fonts.transcript` are one of `display`, `sans`, `arabic`, `naskh` | `languages[0].fonts.ui: unknown font token` |
| `transcriptLayers` is a non-empty list of `script`, `tashkeel`, `transliteration`, `english`, no repeats | `languages[0].transcriptLayers: duplicate "script"` |
| `slug` and `code` unique across the set | `languages: duplicate slug "spanish"` |
| At least one language has `status: "available"` | `languages: at least one language must be available` |

## Consumers

- `generateStaticParams` for `/learn/[language]`
- The `[language]` layout (resolve, coming-soon notice, not found)
- Header navigation (default language)
- `TargetText` (direction, code, fonts, size)

## Changing the file

Adding a language is adding an entry. No code change is needed unless the language uses a script
or font token the schema does not yet list; extending those lists is a schema change with a test.

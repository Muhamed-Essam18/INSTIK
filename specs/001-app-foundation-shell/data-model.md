# Data Model: App Foundation and Shell

This spec has no database. Its only data is the language file, validated when the app is built.
Entities map to the spec's Key Entities.

## Language

Source: `content/languages.json` (an object with a `languages` array). Format details are in
[contracts/languages.md](contracts/languages.md).

| Field | Type | Rules |
|---|---|---|
| `code` | string | BCP 47 style code used for the `lang` attribute (Egyptian Arabic: `arz`, Spanish: `es`). Unique. |
| `slug` | string | URL segment. Lowercase letters, digits and single hyphens. Unique. Egyptian Arabic: `arabic-egyptian`. |
| `name` | string | Learner-facing language name (`Arabic`, `Spanish`). |
| `variety` | string | Learner-facing variety (`Egyptian`). Optional for languages without one. |
| `nativeName` | string | Name written in the language's own script, used in target-language blocks. |
| `script` | `"arabic"` or `"latin"` | Selects fonts and size rules. Further scripts are added with the schema when a language needs them. |
| `direction` | `"rtl"` or `"ltr"` | Written into `dir` on every target-language block. |
| `status` | `"available"` or `"coming-soon"` | Only `available` languages get learning pages. |
| `fonts` | object | `ui` and `transcript` token names for the language (Arabic: `arabic` and `naskh`). |
| `transcriptLayers` | array of `"script"`, `"tashkeel"`, `"transliteration"`, `"english"` | Which layers the player offers. Stored now, used by the player spec. |

**Set-level rules**

- At least one language has `status: "available"`.
- `slug` and `code` are unique across the set.
- The first available language is the default language used by navigation outside language paths.

**Derived values** (computed in `src/lib/languages.ts`, not stored)

- `defaultLanguage`: first available language.
- `getLanguageBySlug(slug)`: the language or `undefined`.
- `isAvailable(language)`: `status === "available"`.

**State**: none at runtime. A language moves from `coming-soon` to `available` by editing the file.

## Screen

Not stored. A fixed table in `src/lib/routes.ts`.

| Screen | Scope | Path |
|---|---|---|
| Landing | independent | `/` |
| Onboarding | independent | `/onboarding` |
| Pricing | independent | `/pricing` |
| Library | language | `/learn/[language]` |
| Player | language | `/learn/[language]/watch` |
| Done for today | language | `/learn/[language]/done` |
| Roadmap | language | `/learn/[language]/roadmap` |
| Host | language | `/learn/[language]/hosts` |

## Target-language block

Not stored. A rendering contract: given a `Language` and text, output an element with
`dir = language.direction`, `lang = language.code`, the language's font family and the size rules
for its script. Text is passed through unchanged.

## Initial data

| Language | code | slug | direction | script | status |
|---|---|---|---|---|---|
| Arabic (Egyptian) | `arz` | `arabic-egyptian` | `rtl` | `arabic` | `available` |
| Spanish | `es` | `spanish` | `ltr` | `latin` | `coming-soon` |

## Post-design constitution re-check

Principles I–X still pass: data stays file-based (VIII), every language-scoped screen is keyed by
slug (IV), no learner data is introduced (X), and nothing outside the MVP list is added (I).

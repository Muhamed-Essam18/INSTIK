# Contract: Content Import

## Command

```text
npm run import:content                    import and print the report (runs `tsx scripts/import-content.ts`)
npm run import:content -- --dry-run       print what would happen; write nothing
npm run import:content -- --json          print the report as JSON
```

The script runs with `tsx` (a devDependency), not plain Node: Node's TypeScript stripping cannot resolve the extensionless
relative imports used by the validators and the generated Prisma client. The script and the modules it imports MUST NOT
import `server-only`, `db()` or `env()`; it builds its own Prisma client from `DATABASE_URL`. It loads `.env.local` then
`.env` and needs `DATABASE_URL`. Exit code `0` when nothing failed and nothing is
incomplete; `1` otherwise; `2` for a setup problem (no database, unreadable `content/languages.json`).

## What is imported

For each language in `content/languages.json` that has a `content/<slug>/` folder: `hosts/*.json`, `videos/*.json`,
`videos/*.vtt`, `glossary.json`. Videos are created `APPROVED` with an initial status event (actor label `import`, note
`Imported from content files`). Sample markers are kept in `sample`.

## Rules

- Identity: hosts and videos by `(languageCode, slug)`, glossary entries by `(languageCode, entryKey)`.
- A row that already exists is left exactly as it is and counted as `alreadyPresent`.
- A video with no `.vtt` file is complete and is imported Approved without a transcript.
- A video whose `.vtt` exists but is unreadable, empty or invalid is saved as `DRAFT` with an initial event whose note is
  `Import incomplete: <reason>`, counted as `incomplete`, and completed (transcript added, status to `APPROVED`, event
  written) by a later run once the file is valid.
- Anything that cannot be saved at all (fails its schema, unknown host, unknown stage or topic, duplicate slug in the
  files, unknown language folder) is `failed` with the reason, and the run continues.
- Each video, with its segments and events, is written in one transaction.
- The import writes through its own store and never calls the status change service (`changeStatus`).

## Report

```json
{
  "dryRun": false,
  "languages": [
    {
      "language": "arabic-egyptian",
      "hosts":    { "imported": 2, "alreadyPresent": 0, "failed": [] },
      "videos":   { "imported": 8, "alreadyPresent": 0, "incomplete": [], "failed": [] },
      "transcripts": { "imported": 2 },
      "glossary": { "imported": 41, "alreadyPresent": 0, "failed": [] }
    }
  ],
  "ok": true
}
```

- `incomplete` and `failed` items are objects: `{ "item": "videos/my-family.vtt", "reason": "line 7: ..." }`.
- Text output prints one line per group, then one indented line per incomplete or failed item, and ends with
  `Done: all content is in the database.` or `Needs attention: N items.`.
- A second run on a complete database reports every group as `alreadyPresent` with zero `imported`.

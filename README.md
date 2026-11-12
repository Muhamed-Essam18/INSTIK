This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.


## Adding content

Videos, transcripts, glossaries and hosts now live in the database; learners only ever see **Approved**
videos. The files under `content/<language-slug>/` (for example `content/arabic-egyptian/videos/at-the-cafe.json`)
are the source of the one-time import of the sample content, and only `content/languages.json` stays live data.
See `specs/002-content-and-library/contracts/content-files.md` for the file formats.

## Creator programme data

- **Owners**: set `OWNER_EMAILS` (comma-separated emails of the Instik team; see `.env.example`). Owners are never stored,
  so removing an email withdraws the role at the next check. An owner invites creators at `/owner/creators`; the link
  works once, lasts 7 days and must be opened signed in with the invited address.
- **Import the sample content** into the database: `npm run import:content` (add `-- --dry-run` to see what would
  happen, `-- --json` for a machine-readable report). It is safe to run again: rows that already exist are never
  changed. A video whose transcript file is present but invalid is saved as a hidden Draft and reported; fix the file
  and run again to complete it. Exit code `0` means nothing failed or is incomplete, `1` means something needs
  attention, `2` means a setup problem (for example no `DATABASE_URL`).
- The import runs with `tsx` (a dev dependency) because the validators and the generated Prisma client use
  extensionless imports that plain Node cannot resolve.

## Video playback

Each video's `playbackId` (in its JSON file) chooses the source: an id starting with `sample-` plays the 30 s sample clip in `public/sample/sample-clip.mp4`; any other id is played through Mux (`@mux/mux-player-react`); no id shows a friendly placeholder. To change the sample clip, run `scripts/make-sample-clip.mjs` (its header says how to do it without installing ffmpeg). Transcript files have one line per layer in each cue; see `specs/003-video-player-transcript/contracts/transcript-files.md`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

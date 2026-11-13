# Quickstart: Creator Panel and Video Upload

How to run this feature locally and check it end to end. Details: [data-model.md](data-model.md), [contracts/](contracts/).

## Prerequisites

1. Spec 8 is applied (roles, invites, database content) and `OWNER_EMAILS` includes your email.
2. A **Mux** account with a test environment. Create an access token (Mux Video read/write) and a webhook signing secret.
3. A **Vercel Blob** store (public) and its read/write token: in the Vercel dashboard, Storage → Create → Blob, then copy the token.
4. A tunnel so Mux can reach your machine (Mux cannot call `localhost`).

## Environment (`.env.local`; see `.env.example`)

```text
MUX_TOKEN_ID=...
MUX_TOKEN_SECRET=...
MUX_WEBHOOK_SECRET=...
BLOB_READ_WRITE_TOKEN=...
SITE_URL=http://localhost:3000     # used as the upload CORS origin
```

Set all three Mux values or none. Without them the upload page shows a calm "uploads are not set up yet" note and the rest of the site works.

## Local tunnel for webhooks

```text
npm run dev
cloudflared tunnel --url http://localhost:3000      # or: ngrok http 3000
```

Copy the `https://…` address the tunnel prints. In the Mux dashboard (test environment) → Settings → Webhooks → Create new
webhook, URL `<tunnel address>/api/mux/webhook`, and copy its signing secret into `MUX_WEBHOOK_SECRET`. Restart `npm run dev`.
Quick tunnel addresses change on every start, so update the webhook URL each time.

## Database

```text
npm run db:migrate
```

## Checks

1. **Creator access**: sign in as a creator (accept an invite from spec 8). `/creator` shows the panel and four nav items. A learner
   opening `/creator/videos` sees the not-found page.
2. **Host page**: `/creator/host`: set photo (try a 5 MB file and a PDF: both refused), both names, story, topics. Open the public
   host page and confirm the changes, Arabic name right-to-left.
3. **Upload**: `/creator/upload`, drop a short MP4. The progress bar moves; fill details while it uploads; try Submit with a
   box unticked (blocked, named); tick all and Submit. In the tunnel/Mux logs you see the webhook arrive. My videos shows
   Processing and then In review without a refresh-free guess: reload to confirm.
4. **Submit before ready**: submit while still Processing; confirm the video reaches In review on its own.
5. **Save draft**: save with partial details, leave, return from My videos, continue.
6. **Failure**: start an upload and close the tab: the video shows "Uploading" and, 75 minutes later (1 hour link plus a
   15-minute grace; to test sooner, move `uploadStartedAt` back in the database), "Upload didn't finish" and can be restarted.
   Upload a text file renamed `.mp4`: Mux errors it and the video returns to Draft with a plain note. Choose a file over 4 GB: it is
   refused before uploading. Upload a video longer than 30 minutes: after processing it returns to Draft with the plain note.
7. **Changes requested**: in the database set a video to `CHANGES_REQUESTED` with a ready current file and add a history entry
   with a note (owner screens come in spec 10). Open its status page: note, history, Upload a new version, Edit details. Upload a
   new version: the video stays in Changes requested and shows "New version processing", then "New version ready to submit", with
   the note still visible. Re-tick the checklist and Submit: it returns to In review, the new file is the video's file and the old
   Mux asset is gone. Repeat with a broken file: the video stays in Changes requested with a "didn't work" message and its old file.
   A Rejected video offers no actions.
8. **Isolation**: as creator B open creator A's `/creator/videos/<id>`: not-found.
9. **Delete**: delete a draft (confirmation): it disappears from My videos, its Mux asset is deleted, and its history rows are still
   in the database. An In review video offers no delete.

## Automated checks

```text
npm run lint && npm run typecheck && npm test && npm run build
```

Unit tests need no Mux, Blob or database: they cover the state machine additions, webhook parsing and idempotency, submit rules,
photo validation and creator read scoping.

# Research: Creator Panel and Video Upload

No NEEDS CLARIFICATION items remained after `/speckit-clarify`. These are the technical decisions.

## R1. Direct upload to Mux

- **Decision**: A server action (creator only, own video only, through the shared `canUpload` check) calls Mux `video.uploads.create`
  with `cors_origin` set to the site origin (`SITE_URL`, else the request origin), `timeout` 3600 seconds,
  `new_asset_settings: { playback_policies: ["signed"], passthrough: <videoId>, video_quality: "basic" }`. It saves the returned
  upload id on the video and returns only the one-time URL. The browser sends the file with `@mux/upchunk` (chunked, resumable on a
  dropped connection) and shows the percentage from its `progress` event. The browser refuses files over 4 GB before starting.
- **Rationale**: Matches the product brief and constitution XIII; the file never touches our server. UpChunk has no built-in
  styling, so the bar follows the design tokens. `passthrough` carries our video id.
- **Mux size limit**: a search of the Mux documentation found no stated byte limit for direct uploads (only a client-side
  `maxFileSize` setting in Mux's own uploader, and a `file_too_large` error with no number). 4 GB is therefore our own limit,
  enforced in the browser; confirm Mux's real limit with Mux before launch (tracked in the Polish tasks). The 30-minute length
  limit is enforced on the server when the asset is ready.
- **Alternatives**: Mux uploader web component (harder to style); proxying through a route handler (forbidden by XIII).
- **Note**: Signed playback for every creator upload; the owner may add a public playback id for free videos at approval (spec 10).
  The status page preview signs a token with the existing `signPlaybackTokens`.

## R2. State machine changes (shared with spec 10)

- **Decision**: Keep `src/lib/content/status.ts` as the one machine. Add `UPLOADING → DRAFT` for the system (first upload cancelled,
  errored or expired) and a creator `PROCESSING → IN_REVIEW` (their submission completes it); the existing system move
  `PROCESSING → IN_REVIEW` stays. Change the status service so the automatic note applies only when the caller passed none (the
  too-long note differs from the generic failure note). Two flags on `Video` carry what the path cannot: `assetReadyAt` and
  `submittedAt`. When both are set and the status is `PROCESSING` the video moves to `IN_REVIEW` once.
  - Submit before ready: set `submittedAt`; the ready notice completes it.
  - Submit after ready: move now.
  - Ready while not submitted: set `assetReadyAt`, stay in `PROCESSING` (shown as "Ready to submit").
- **Attribution**: The `IN_REVIEW` entry is recorded as the creator's (id and name) even when the webhook completes it, because the
  creator made the submission (design: "Submitted · You"). The webhook builds the creator actor from the video's host user and calls
  the existing service, so ownership and transition checks apply unchanged.
- **Rationale**: One path, one history, no new status. Spec 10 only adds owner moves (already in the table).
- **Alternatives**: A `READY` status (changes learner-visible rules and spec 8 tests).

## R3. Webhook

- **Decision**: `POST /api/mux/webhook` (contract in [contracts/mux-webhook.md](contracts/mux-webhook.md)). Raw body, verify with
  `mux.webhooks.unwrap` and `MUX_WEBHOOK_SECRET`, bad signature 400 with no body. Parse the verified event with zod; handle upload
  asset created, asset created, ready, errored, upload errored and cancelled, for the current file and for a pending new version.
- **Only the webhook moves a first upload to Processing.** There is no client-side "upload finished" action: it would let the
  browser drive a system-only move. The page shows "Uploaded, processing" from the browser's own upload-complete event.
- **Idempotency and order**: Every handler is conditional on current state, and each status move is conditional on the previous
  status (already in `setStatus`), so repeats, retries and out-of-order notices neither duplicate history nor undo progress. An
  unknown, replaced or soft-deleted video changes nothing and answers 200; only transient store failures answer 500.
- **Rationale**: Same shape as the Stripe webhook; no event table needed because every effect is idempotent.

## R4. New version while in Changes requested

- **Decision**: The video stays in `CHANGES_REQUESTED`. The new file is a pending version in `pending*` fields (data-model.md).
  On resubmit the pending file becomes the current one and the previous Mux asset is deleted (its id is read inside the swap
  transaction, so no "previous asset" column is needed). A failed or over-long pending file is cleared and `pendingFailure`
  explains it on the status page; the earlier file and the status are untouched.
- **Rationale**: Matches the clarified spec (the video stays in Changes requested with the note visible), keeps the current file
  safe until the swap, and creates no history noise for work in progress. The existing `CHANGES_REQUESTED → UPLOADING` move is left in
  the machine (spec 8 tests) but unused here.
- **Alternatives**: Moving to `UPLOADING` (loses the Changes requested label and the filter, and a failed upload has nowhere good
  to return to).

## R5. Host photos

- **Decision**: Vercel Blob public store. A server action receives the file in the form data, checks size (max 2 MB) and type by
  reading the first bytes (JPEG, PNG or WebP; the declared type is not trusted), then `put`s it under
  `host-photos/<hostId>/<random>.<ext>` and saves the URL in `Host.photo`; the previous blob is deleted after the save. Next
  `serverActions.bodySizeLimit` is raised to 3 MB (applies to all actions, which are all small). `next.config` gets
  `images.remotePatterns` for the store host.
- **Rationale**: Documented in quickstart, no extra service, works on Vercel. Photos are small and public by nature.
- **Alternatives**: Client upload tokens (more moving parts); storing in Postgres (bloat); Mux (not for images).

## R6. Drafts have missing data; stage is a proposal

- **Decision**: `Video.stage`, `topic` and `durationSeconds` become nullable; a new `proposedStage` holds the creator's choice and
  `stage` is only ever set by the owner (spec 10 pre-fills it from the proposal), so constitution VIII ("stage… set by the owner,
  never by the creator") holds with no amendment. `slug` is `draft-<id>` until first submit, then from the title (unique within the
  language, numeric suffix on conflict). `title` defaults to empty; `access` defaults to `FULL`. The learner mapper skips and logs an
  Approved row missing `stage`, `topic` or `durationSeconds` rather than crash a page.
- **Alternatives**: Placeholder values (would leak into reviewers' views); a separate draft table (duplicates the model).

## R7. Display status and filters

- **Decision**: A pure `displayStatus(video, now)` maps stored status and flags to what the creator sees (data-model.md table),
  including "Ready to submit", "Upload didn't finish" and the three "New version…" labels. Filters: All, In review, Changes requested,
  Live, Drafts (Draft, Upload didn't finish, Ready to submit). Counts come from the same function so rows and counts agree (FR-031).
- **Latest note**: the note of the video's newest history entry, or none; shortened to about 60 characters in the list.

## R8. Abandoned uploads and draft deletion

- **Decision**: A first upload whose status is `UPLOADING`, with no asset id, and whose link is older than the link lifetime
  (1 hour) plus a 15-minute grace period (`UPLOAD_URL_LIFETIME_SECONDS + UPLOAD_GRACE_SECONDS`, 75 minutes) shows "Upload didn't
  finish"; starting again first moves it `UPLOADING → DRAFT` (system, plain note) and then starts a new upload. The same rule
  labels a pending new version "New version didn't finish". No background job. Deleting a draft is a **soft delete** (`deletedAt`):
  the Mux assets are deleted, the row and its history stay, and every read filters it out. This keeps the append-only trigger on
  `VideoStatusEvent` (spec 8) intact; the cascade delete the first plan assumed would have been refused by that trigger.
- **Alternatives**: Dropping the trigger for drafts (weakens the spec 8 guarantee); a cleanup job (new infrastructure).

## R9. Local development for webhooks

- **Decision**: Document a tunnel (`cloudflared tunnel --url http://localhost:3000` or `ngrok http 3000`) and registering
  `<tunnel>/api/mux/webhook` in the Mux dashboard test environment, copying the signing secret to `MUX_WEBHOOK_SECRET`.

## R10. Environment

- **Decision**: Add optional `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, `MUX_WEBHOOK_SECRET` (all three together or none, like the
  signing pair) and `BLOB_READ_WRITE_TOKEN`. With any missing, the matching feature shows a calm "not set up" notice; nothing
  crashes at build. `.env.example` is updated.

## R11. The shared upload permission

- **Decision**: One pure function `canUpload(actor)` in `src/lib/creator/can-upload.ts`, true for a creator (including an owner who
  is also a creator) and false for everyone else. `createUpload` and `submitVideo` both call it first. Spec 10 extends it with
  "not paused" (constitution XI and XIII), so pausing needs no change to the actions. Owners who are not creators do not upload
  in this spec (constitution XIII allows an owner to request a link; nothing here needs it).

## R12. Data Access Layer boundary

- **Decision**: `tests/unit/dal-boundary.test.ts` lists the only modules allowed to import the database client. The new stores
  `src/lib/creator/store.ts` and `src/lib/mux/store.ts` are added to that list on purpose (task T006); server actions and the webhook
  route call these stores and never import the client. The in-memory database helper `tests/helpers/content-db.ts` gains the new columns.

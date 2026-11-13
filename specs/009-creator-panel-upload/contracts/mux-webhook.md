# Contract: Mux webhook

`POST /api/mux/webhook`, called only by Mux.

## Request handling

1. If `MUX_WEBHOOK_SECRET` or the Mux token settings are missing: respond 503, no body.
2. Read the raw body as text. Verify with Mux's `webhooks.unwrap(rawBody, headers)`. Failure: 400, no body, no logging of the body.
3. Parse the verified event with zod; unknown event types: 200 and ignore.
4. Apply (below). Success or "nothing to do": 200. Transient failure: 500 (Mux retries).
5. Responses never carry a body; logs contain event id and type only.

## Finding the video and which file

The event's upload id or asset id (or the passthrough video id) finds the video. It then decides whether the event is about the
video's **current** file (matches `muxUploadId` / `muxAssetId`) or its **pending** new version (matches `pendingUploadId` /
`pendingAssetId`). An id that matches neither (a replaced or deleted file) changes nothing.

## Events handled

| Event | Fields used | Effect on the current file | Effect on a pending new version |
| --- | --- | --- | --- |
| `video.upload.asset_created` | `data.id` (upload), `data.asset_id` | Store `muxAssetId`; UPLOADING → PROCESSING (system) | Store `pendingAssetId`; no status change |
| `video.asset.created` | `data.id`, `data.passthrough` | Store `muxAssetId` if empty; UPLOADING → PROCESSING if still UPLOADING | Store `pendingAssetId` if empty |
| `video.asset.ready` | `data.id`, `data.duration`, `data.playback_ids[]` (the signed one) | If duration is over 1,800 s: delete the asset and PROCESSING → DRAFT with the note "That video is longer than 30 minutes. Please upload a shorter one." Otherwise store duration (ceil, at least 1) and playback id, set `assetReadyAt`; if `submittedAt` is set, move to IN_REVIEW as the creator | Over 1,800 s: delete the asset, clear the pending fields, set `pendingFailure` to the same plain message. Otherwise store the pending duration and playback id, set `pendingReadyAt`; if `submittedAt` is set, swap the pending file in, move CHANGES_REQUESTED → IN_REVIEW as the creator, delete the old Mux asset |
| `video.asset.errored` | `data.id` | PROCESSING → DRAFT with the standard plain note | Clear the pending fields, set `pendingFailure` ("The new version didn't work. Please try again."), clear `submittedAt` |
| `video.upload.errored`, `video.upload.cancelled` | `data.id` | UPLOADING → DRAFT with the standard plain note | Same as above |

## Guarantees

- Repeated or out-of-order events leave one history entry per real change (every write and move is conditional on current state).
- An event for a file that is no longer the video's current or pending file changes nothing.
- An event for an unknown or soft-deleted video changes nothing and answers 200.
- Status moves go through `createStatusService`, so ownership and transition checks apply unchanged.

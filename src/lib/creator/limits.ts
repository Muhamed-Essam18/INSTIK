// The upload limits in one place (spec 9, FR-018). The team may change them here.

/** Files over this are refused in the browser before the upload starts (the file never reaches our server to check it there). */
export const MAX_UPLOAD_BYTES = 4 * 1024 ** 3;

/** A video longer than this is refused once the video host has processed it. */
export const MAX_DURATION_SECONDS = 1800;

/** How long a one-time upload link works. */
export const UPLOAD_URL_LIFETIME_SECONDS = 3600;

/** Extra time before an upload with no file at the host is called "didn't finish". */
export const UPLOAD_GRACE_SECONDS = 900;

/** An upload whose link is older than this and has no asset has not finished and will not. */
export const UPLOAD_GIVE_UP_SECONDS = UPLOAD_URL_LIFETIME_SECONDS + UPLOAD_GRACE_SECONDS;

export const ACCEPTED_EXTENSIONS = [".mp4", ".mov"] as const;
export const ACCEPTED_MIME_TYPES = ["video/mp4", "video/quicktime"] as const;

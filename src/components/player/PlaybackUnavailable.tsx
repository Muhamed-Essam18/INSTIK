import Link from "next/link";

/**
 * Shown in place of the player when a video's playback tokens could not be made (a launch setting is missing or wrong).
 * Calm and blameless: the learner did nothing wrong and nothing here looks broken. The cause is logged on the server.
 */
export function PlaybackUnavailable({ libraryHref }: { libraryHref: string }) {
  return (
    <div
      role="status"
      className="relative flex aspect-video flex-col items-center justify-center gap-3 overflow-hidden rounded-lg bg-ink px-6 text-center text-cream"
    >
      <p className="m-0 text-body-lg">This video can&apos;t play right now. Please try again in a little while.</p>
      <Link href={libraryHref} className="inline-flex min-h-11 items-center text-label text-cream underline hover:text-cream">
        Back to the Library
      </Link>
    </div>
  );
}

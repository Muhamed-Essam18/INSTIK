import Link from "next/link";
import { signInPath } from "@/lib/routes";

type Props = { videoTitle: string; hostName: string; returnTo: string };

/** Shown to a visitor who tried to open a video: who and what they were going to watch, never the video itself. */
export function SignInPrompt({ videoTitle, hostName, returnTo }: Props) {
  return (
    <aside aria-label="Sign in to watch" className="mx-auto mb-space-8 flex max-w-[720px] flex-col gap-space-2 rounded-lg bg-paper p-space-6 shadow-sm">
      <p className="m-0 text-heading font-bold text-ink">Create a free account to watch and save your hours</p>
      <p className="m-0 text-body text-slate">
        You were going to watch <strong className="font-semibold text-ink">{videoTitle}</strong> with {hostName}.
      </p>
      <Link href={signInPath(returnTo)} className="inline-flex min-h-11 items-center self-start text-label underline">
        Already have an account? Sign in
      </Link>
    </aside>
  );
}

import Link from "next/link";
import { Suspense } from "react";
import { signInPath } from "@/lib/routes";
import { getLearner } from "@/lib/session";
import { nav } from "@/lib/marketing/copy";

/** "Log in" for visitors; nothing for a signed-in learner. Reads the session, so it sits behind Suspense. */
async function LogIn() {
  if (await getLearner()) return null;
  return <LogInLink />;
}

function LogInLink() {
  return (
    <Link
      href={signInPath()}
      className="inline-flex min-h-11 items-center px-3.5 text-[15px] font-semibold text-ink no-underline hover:text-ink"
    >
      {nav.logIn}
    </Link>
  );
}

export function LogInSlot() {
  return (
    <Suspense fallback={<LogInLink />}>
      <LogIn />
    </Suspense>
  );
}

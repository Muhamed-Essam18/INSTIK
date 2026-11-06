import Link from "next/link";
import { SignInForm } from "./SignInForm";
import { accountStep } from "@/lib/onboarding/copy";
import { onboardingFinishPath } from "@/lib/routes";

type Props = { signedIn: boolean; returnTo?: string };

/** Step 4. Create the account; "Start watching" appears only once the learner is signed in. */
export function AccountStep({ signedIn, returnTo }: Props) {
  if (signedIn) {
    return (
      <div className="flex flex-col gap-space-4">
        <p className="m-0 text-body-lg text-ink">{accountStep.signedIn}</p>
        <Link
          href={onboardingFinishPath(returnTo)}
          className="inline-flex h-[52px] items-center self-start rounded-md bg-coral px-7 text-body font-semibold text-ink no-underline hover:text-ink"
        >
          {accountStep.start}
        </Link>
      </div>
    );
  }
  return <SignInForm returnTo={returnTo} />;
}

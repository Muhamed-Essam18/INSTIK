import { Suspense } from "react";
import { languageName } from "@/lib/language-name";
import { defaultLanguage, languages } from "@/lib/languages";
import { waitlist } from "@/lib/marketing/copy";
import { joinWaitlist } from "@/lib/waitlist/actions";
import { waitlistOptions } from "@/lib/waitlist/options";
import { WaitlistForm } from "./WaitlistForm";

const options = waitlistOptions(languages);
const name = languageName(defaultLanguage);

export function WaitlistSection() {
  return (
    <div
      id="waitlist"
      className="flex min-w-0 scroll-mt-4 flex-[1_1_480px] flex-col gap-4 rounded-lg bg-paper p-6 sm:p-10"
    >
      <h2 className="font-display text-[32px] leading-10 font-extrabold">{waitlist.title}</h2>
      <p className="text-[17px] leading-[26px] text-slate">{waitlist.body(name)}</p>
      <Suspense fallback={<div className="h-[120px]" aria-hidden="true" />}>
        <WaitlistForm options={options} join={joinWaitlist} />
      </Suspense>
    </div>
  );
}

import { landing, nav } from "@/lib/marketing/copy";
import { inkButton } from "./buttons";
import { StartCta } from "./StartLink";
import { Wrap } from "./Wrap";

export function FinalCta() {
  return (
    <section className="bg-coral">
      <Wrap className="flex flex-wrap items-center gap-6 py-20">
        <h2 className="min-w-0 flex-[1_1_480px] font-display text-[36px] leading-[42px] font-extrabold text-ink md:text-[48px] md:leading-[54px]">
          {landing.finalCta.title}
        </h2>
        <StartCta className={`${inkButton} h-14 px-7 text-[17px]`}>{nav.start}</StartCta>
      </Wrap>
    </section>
  );
}

import { landing } from "@/lib/marketing/copy";
import { Wrap } from "./Wrap";

export function HowItWorks() {
  const { how } = landing;
  return (
    <section id="how-it-works" className="scroll-mt-4">
      <Wrap className="flex flex-col gap-12 py-16 md:py-24">
        <div className="flex max-w-[640px] flex-col gap-3">
          <h2 className="font-display text-[32px] leading-10 font-extrabold md:text-[40px] md:leading-[46px]">
            {how.title}
          </h2>
          <p className="text-body-lg text-slate">{how.body}</p>
        </div>
        <ol className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {how.steps.map((step, i) => (
            <li key={step.title} className="flex flex-col gap-3 rounded-lg bg-paper p-8">
              <span className="font-display text-[40px] leading-10 font-extrabold text-coral-text">{i + 1}</span>
              <h3 className="text-[20px] leading-7 font-semibold">{step.title}</h3>
              <p className="text-[16px] leading-[25px] text-slate">{step.body}</p>
            </li>
          ))}
        </ol>
      </Wrap>
    </section>
  );
}

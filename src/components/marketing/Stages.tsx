import { languageName } from "@/lib/language-name";
import { defaultLanguage } from "@/lib/languages";
import { landing } from "@/lib/marketing/copy";
import { stageEstimateLabel } from "@/lib/marketing/stage-estimate";
import { Wrap } from "./Wrap";

const name = languageName(defaultLanguage);
const stageKeys = ["HEAR_IT", "FOLLOW_IT", "UNDERSTAND_IT", "JOIN_IN"] as const;
const fills = ["bg-coral", "bg-sun", "bg-teal", "bg-cream"];

export function Stages() {
  const { stages } = landing;
  return (
    <section aria-label={stages.label} className="bg-ink text-cream">
      <Wrap className="flex flex-col gap-10 py-16 md:py-24">
        <div className="flex max-w-[640px] flex-col gap-3">
          <h2 className="font-display text-[32px] leading-10 font-extrabold md:text-[40px] md:leading-[46px]">
            {stages.title}
          </h2>
          <p className="text-body-lg">{stages.body}</p>
        </div>
        <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stages.items.map((item, i) => (
            <li key={item.name} className={`flex flex-col gap-2 rounded-lg p-6 text-ink ${fills[i]}`}>
              <span className="text-label">Stage {i + 1}</span>
              <span className="font-display text-[28px] leading-[34px] font-extrabold">{item.name}</span>
              <span className="text-[15px] leading-[22px]">{item.body(name)}</span>
              <span className="text-label">{stageEstimateLabel(defaultLanguage, stageKeys[i])}</span>
            </li>
          ))}
        </ol>
      </Wrap>
    </section>
  );
}

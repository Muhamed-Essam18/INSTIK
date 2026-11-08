import { PAST_ESTIMATE_LINE, STAGE_DESCRIPTIONS, moreHoursLine } from "@/lib/hours/copy";
import type { StageState } from "@/lib/hours/stages";
import { STAGE_NAMES, type Stage } from "@/lib/learner/profile-rules";

type Props = {
  states: Array<{ stage: Stage; state: StageState }>;
  progress: number;
  moreHours: number | null;
  nextStage: Stage | undefined;
  hasEstimates: boolean;
};

const LABELS: Record<StageState, string> = { done: "Done", here: "You are here", next: "Next", later: "Later" };

const card: Record<StageState, string> = {
  done: "bg-teal text-ink",
  here: "border-2 border-ink bg-paper text-ink",
  next: "bg-paper/50 text-ink",
  later: "bg-paper/50 text-ink",
};

/** The four stages with the current position. "About N more hours" is always called an estimate. */
export function StageList({ states, progress, moreHours, nextStage, hasEstimates }: Props) {
  return (
    <section aria-labelledby="roadmap-heading" className="flex flex-col gap-space-4">
      <h2 id="roadmap-heading" className="m-0 font-display text-[26px] leading-8 font-extrabold text-ink">
        Roadmap
      </h2>
      <ol className="m-0 grid list-none grid-cols-1 gap-space-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
        {states.map(({ stage, state }) => {
          const line = state === "here" ? moreHoursLine(moreHours, nextStage) : null;
          const pastEstimate = state === "here" && hasEstimates && moreHours === null && nextStage !== undefined;
          return (
            <li
              key={stage}
              aria-current={state === "here" ? "step" : undefined}
              className={`flex flex-col gap-space-2 rounded-lg p-space-6 ${card[state]}`}
            >
              <span
                className={`text-caption font-semibold ${state === "here" ? "text-coral-text" : state === "done" ? "text-ink" : "text-slate"}`}
              >
                {LABELS[state]}
              </span>
              <span className="font-display text-[24px] leading-[30px] font-extrabold">{STAGE_NAMES[stage]}</span>
              <span className={`text-label font-normal ${state === "next" || state === "later" ? "text-slate" : ""}`}>
                {STAGE_DESCRIPTIONS[stage]}
              </span>
              {state === "here" && hasEstimates ? (
                <>
                  <span
                    role="progressbar"
                    aria-label={`Progress through ${STAGE_NAMES[stage]}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(progress * 100)}
                    className="block h-2 rounded-pill bg-coral-tint"
                  >
                    <span className="block h-2 rounded-pill bg-coral" style={{ width: `${Math.round(progress * 100)}%` }} />
                  </span>
                  {line ? <span className="text-caption text-slate">{line}</span> : null}
                  {pastEstimate ? <span className="text-caption text-slate">{PAST_ESTIMATE_LINE}</span> : null}
                </>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

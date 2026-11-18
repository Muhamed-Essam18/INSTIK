"use client";

import { useCallback, useState, type ReactNode } from "react";
import type { GlossaryRow } from "@/lib/review/glossary";
import type { Checks } from "@/lib/review/rules";
import { allTicked } from "@/lib/review/rules";
import type { SegmentView } from "@/lib/review/service";
import { DecisionBar } from "./DecisionBar";
import { FinalClassification } from "./FinalClassification";
import { ReviewChecklist } from "./ReviewChecklist";
import { TranscriptEditor } from "./TranscriptEditor";

/**
 * The working part of the review screen (docs/design/OwnerReview.dc.html): player, checklist and classification on the left,
 * the transcript on the right, the decision bar below. It holds the two facts the decision bar needs: all ticked, and a segment exists.
 * `readOnly` (a video in Changes requested) shows the same thing with every control off and no decision bar.
 */
export function ReviewWorkspace({
  videoId,
  player,
  checks: initialChecks,
  stage,
  access,
  segments,
  entries,
  lang,
  dir,
  scriptLabel,
  creatorName,
  readOnly,
  readOnlyNote,
}: {
  videoId: string;
  player: ReactNode;
  checks: Checks;
  stage: string;
  access: "FREE" | "FULL";
  segments: readonly SegmentView[];
  entries: Record<string, GlossaryRow>;
  lang: string;
  dir: "rtl" | "ltr";
  scriptLabel: string;
  creatorName: string;
  readOnly: boolean;
  readOnlyNote?: ReactNode;
}) {
  const [checks, setChecks] = useState(initialChecks);
  const [count, setCount] = useState(segments.length);
  const onCount = useCallback((n: number) => setCount(n), []);

  return (
    <div className="flex flex-col gap-space-6">
      <div className="grid gap-space-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="flex flex-col gap-space-6">
          {player}
          <ReviewChecklist videoId={videoId} checks={checks} onChange={setChecks} readOnly={readOnly} />
          <FinalClassification videoId={videoId} initialStage={stage} initialAccess={access} readOnly={readOnly} />
        </div>
        <TranscriptEditor
          videoId={videoId}
          segments={segments}
          entries={entries}
          lang={lang}
          dir={dir}
          scriptLabel={scriptLabel}
          readOnly={readOnly}
          onCount={onCount}
        />
      </div>
      {readOnly ? readOnlyNote : <DecisionBar videoId={videoId} creatorName={creatorName} canApprove={allTicked(checks) && count > 0} />}
    </div>
  );
}

"use client";

import { useId, useState } from "react";
import { stages } from "@/lib/content/taxonomy";
import { setClassification } from "@/lib/review/actions";
import { SaveStatus, type SaveState } from "./SaveStatus";

const select = "h-[52px] rounded-sm border border-slate bg-paper px-space-3 text-body font-normal text-ink";

/** The final stage (pre-filled from the creator's proposal) and who can watch (Instik decides). Saves on change. */
export function FinalClassification({
  videoId,
  initialStage,
  initialAccess,
  readOnly,
}: {
  videoId: string;
  initialStage: string;
  initialAccess: "FREE" | "FULL";
  readOnly: boolean;
}) {
  const stageId = useId();
  const accessId = useId();
  const [stage, setStage] = useState(initialStage);
  const [access, setAccess] = useState<"FREE" | "FULL">(initialAccess);
  const [state, setState] = useState<SaveState>("idle");
  const [message, setMessage] = useState<string>();

  async function save(next: { stage: string; access: "FREE" | "FULL" }) {
    setStage(next.stage);
    setAccess(next.access);
    setState("saving");
    setMessage(undefined);
    try {
      const result = await setClassification({ videoId, ...next });
      if (result.ok) setState("saved");
      else {
        setState("error");
        setMessage(result.message);
      }
    } catch {
      setState("error");
      setMessage("Something went wrong. Please try again.");
    }
  }

  return (
    <div className="flex flex-col gap-space-3 rounded-lg border border-hairline bg-paper p-space-6">
      <div className="flex flex-wrap gap-space-6">
        <label htmlFor={stageId} className="flex flex-col gap-1.5 text-label text-ink">
          Stage
          <select id={stageId} value={stage} disabled={readOnly} onChange={(e) => void save({ stage: e.target.value, access })} className={select}>
            {stages.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor={accessId} className="flex flex-col gap-1.5 text-label text-ink">
          Access
          <select
            id={accessId}
            value={access}
            disabled={readOnly}
            aria-describedby={`${accessId}-hint`}
            onChange={(e) => void save({ stage, access: e.target.value as "FREE" | "FULL" })}
            className={select}
          >
            <option value="FULL">Full access</option>
            <option value="FREE">Free</option>
          </select>
          <span id={`${accessId}-hint`} className="text-caption font-medium text-slate">
            Instik decides
          </span>
        </label>
      </div>
      <SaveStatus state={state} />
      {message && (
        <p role="alert" className="m-0 text-label text-coral-text">
          {message}
        </p>
      )}
    </div>
  );
}

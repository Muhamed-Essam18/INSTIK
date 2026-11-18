"use client";

import { useId, useState } from "react";
import { setChecklist } from "@/lib/review/actions";
import { checklistItems, type CheckKey, type Checks } from "@/lib/review/rules";
import { SaveStatus, type SaveState } from "./SaveStatus";

/** The five review checks (docs/design/OwnerReview.dc.html). Each tick saves on its own; the screen is told so the decision bar can react. */
export function ReviewChecklist({
  videoId,
  checks,
  onChange,
  readOnly,
}: {
  videoId: string;
  checks: Checks;
  onChange: (checks: Checks) => void;
  readOnly: boolean;
}) {
  const heading = useId();
  const [state, setState] = useState<SaveState>("idle");
  const [message, setMessage] = useState<string>();

  async function toggle(key: CheckKey, checked: boolean) {
    const previous = checks;
    onChange({ ...checks, [key]: checked });
    setState("saving");
    setMessage(undefined);
    try {
      const result = await setChecklist({ videoId, key, checked });
      if (result.ok) {
        setState("saved");
      } else {
        onChange(previous);
        setState("error");
        setMessage(result.message);
      }
    } catch {
      onChange(previous);
      setState("error");
      setMessage("Something went wrong. Please try again.");
    }
  }

  return (
    <section aria-labelledby={heading} className="flex flex-col gap-space-4 rounded-lg border border-hairline bg-paper p-space-6">
      <div className="flex items-baseline justify-between gap-space-4">
        <h2 id={heading} className="m-0 font-display text-heading text-ink">
          Review checklist
        </h2>
        <SaveStatus state={state} />
      </div>
      <ul className="m-0 flex list-none flex-col gap-space-1 p-0 text-body">
        {checklistItems.map(({ key, label }) => (
          <li key={key}>
            <label className="flex min-h-11 cursor-pointer items-start gap-space-3 py-1.5">
              <input
                type="checkbox"
                checked={checks[key]}
                disabled={readOnly}
                onChange={(e) => void toggle(key, e.target.checked)}
                className="mt-0.5 size-5 shrink-0 accent-teal"
              />
              <span>{label}</span>
            </label>
          </li>
        ))}
      </ul>
      {message && (
        <p role="alert" className="m-0 text-label text-coral-text">
          {message}
        </p>
      )}
    </section>
  );
}

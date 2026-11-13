"use client";

import { useId } from "react";
import { CHECKLIST_ITEMS } from "@/lib/creator/rules";

type Props = {
  checked: readonly boolean[];
  onChange: (next: boolean[]) => void;
  error?: string;
};

/** "Before you submit": the five items from the design, each a real checkbox. Submitting needs every one ticked. */
export function Checklist({ checked, onChange, error }: Props) {
  const errorId = useId();
  return (
    <fieldset aria-describedby={error ? errorId : undefined} className="m-0 flex flex-col gap-space-3 rounded-lg border border-hairline bg-paper p-space-4">
      <legend className="px-space-2 font-display text-[20px] leading-7 font-extrabold text-ink">Before you submit</legend>
      {CHECKLIST_ITEMS.map((item, index) => (
        <label key={item} className="flex min-h-11 items-start gap-space-3 text-body text-ink">
          <input
            type="checkbox"
            checked={checked[index] ?? false}
            onChange={(e) => onChange(CHECKLIST_ITEMS.map((_, i) => (i === index ? e.target.checked : (checked[i] ?? false))))}
            className="mt-1 size-5 shrink-0 accent-ink"
          />
          {item}
        </label>
      ))}
      {error && (
        <p id={errorId} role="alert" className="m-0 text-label text-coral-text">
          {error}
        </p>
      )}
    </fieldset>
  );
}

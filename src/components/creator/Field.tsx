import type { ReactNode } from "react";

/** The ids a control needs to point at its hint and its error, so a screen reader reads them after the label. */
export const describedBy = (id: string, hint: boolean, error: boolean): string | undefined => {
  const parts = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : undefined;
};

type Props = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  /** The control; it must have `id` and `aria-describedby={describedBy(id, …)}`. */
  children: ReactNode;
};

/** A label above its control, then the hint and the error. The label is only the field's name, so that is its accessible name. */
export function Field({ id, label, hint, error, children }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-label text-ink">
        {label}
      </label>
      {children}
      {hint && (
        <span id={`${id}-hint`} className="text-caption text-slate">
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} role="alert" className="text-label text-coral-text">
          {error}
        </span>
      )}
    </div>
  );
}

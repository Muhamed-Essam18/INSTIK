"use client";

import { useRef } from "react";
import type { ReactNode } from "react";

type Option<T extends string | number> = { id: T; content: ReactNode };

type Props<T extends string | number> = {
  label: string;
  value: T | undefined;
  options: ReadonlyArray<Option<T>>;
  onChange: (id: T) => void;
  /** Layout classes for the group (a column by default). */
  className?: string;
  /** Classes for each card, added to the shared look. */
  cardClassName?: string;
};

const card =
  "flex min-h-11 items-center gap-space-4 rounded-lg border-2 bg-paper px-space-6 py-space-4 text-left text-ink cursor-pointer";

/**
 * A group of radio-style cards. Operable by keyboard like native radios: Tab reaches the selected card (or the
 * first), arrow keys move and select. The selected card has a thicker ink border and a check mark, never colour alone.
 */
export function ChoiceGroup<T extends string | number>({
  label,
  value,
  options,
  onChange,
  className = "flex flex-col gap-space-3",
  cardClassName = "",
}: Props<T>) {
  const refs = useRef(new Map<T, HTMLButtonElement>());
  const tabbable = options.some((o) => o.id === value) ? value : options[0]?.id;

  function onKeyDown(event: React.KeyboardEvent, index: number) {
    const step = ["ArrowDown", "ArrowRight"].includes(event.key) ? 1 : ["ArrowUp", "ArrowLeft"].includes(event.key) ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = options[(index + step + options.length) % options.length];
    onChange(next.id);
    refs.current.get(next.id)?.focus();
  }

  return (
    <div role="radiogroup" aria-label={label} className={className}>
      {options.map((option, index) => {
        const checked = option.id === value;
        return (
          <button
            key={String(option.id)}
            ref={(el) => {
              if (el) refs.current.set(option.id, el);
              else refs.current.delete(option.id);
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={option.id === tabbable ? 0 : -1}
            onClick={() => onChange(option.id)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={`${card} ${checked ? "border-ink" : "border-paper"} ${cardClassName}`}
          >
            {option.content}
            {checked && (
              <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" className="shrink-0">
                <path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );
}

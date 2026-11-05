type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  label: string;
  options: readonly Option<T>[];
  selected: T | null;
  onSelect: (value: T) => void;
};

/** A labelled row of pill buttons; the pressed one has aria-pressed. */
export function FilterGroup<T extends string>({ label, options, selected, onSelect }: Props<T>) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-space-2">
      <span aria-hidden="true" className="w-16 text-label text-ink">
        {label}
      </span>
      {options.map(({ value, label: text }) => {
        const on = selected === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={on}
            onClick={() => onSelect(value)}
            className={`min-h-11 cursor-pointer rounded-pill border px-4 text-label ${
              on ? "border-ink bg-ink text-cream" : "border-slate bg-paper text-ink"
            }`}
          >
            {text}
          </button>
        );
      })}
    </div>
  );
}

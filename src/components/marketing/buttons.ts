const base = "inline-flex items-center justify-center rounded-md font-semibold no-underline";

/** Coral fill with an ink label (never coral text). */
export const coralButton = `${base} bg-coral text-ink hover:text-ink`;
/** Ink fill with a cream label. */
export const inkButton = `${base} bg-ink text-cream hover:text-cream`;
/** Ink outline on white. */
export const outlineButton = `${base} border border-ink text-ink hover:text-ink`;

export const headerButton = `${coralButton} h-12 px-[22px] text-[15px]`;
export const largeButton = `${coralButton} h-14 px-7 text-[17px]`;

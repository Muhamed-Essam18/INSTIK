export type SaveState = "idle" | "saving" | "saved" | "unsaved" | "error";

const words: Record<SaveState, string> = { idle: "", saving: "Saving…", saved: "Saved", unsaved: "Not saved yet", error: "Not saved yet" };

/** A small live indicator beside an autosaving control. Colour is never the only signal: the words say it. */
export function SaveStatus({ state, id }: { state: SaveState; id?: string }) {
  return (
    <span id={id} role="status" aria-live="polite" className={`text-caption ${state === "unsaved" || state === "error" ? "text-coral-text" : "text-slate"}`}>
      {words[state]}
    </span>
  );
}

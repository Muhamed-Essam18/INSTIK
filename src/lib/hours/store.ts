// A tiny client store of total seconds per language, for the header Hours pill. The server seeds it; every
// heartbeat and every added or removed entry writes the newer total. Use it with useSyncExternalStore.

type Totals = Readonly<Record<string, number>>;

let totals: Totals = {};
let version = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export const hoursStore = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot(): Totals {
    return totals;
  },
  getServerSnapshot(): Totals {
    return EMPTY;
  },

  /** Sets totals from the server's render. A value already written after a newer heartbeat is not lowered by an older render. */
  seed(next: Totals, seededAtVersion = version) {
    if (seededAtVersion !== version) return;
    const merged: Record<string, number> = { ...totals };
    let changed = false;
    for (const [code, seconds] of Object.entries(next)) {
      if (merged[code] !== seconds) {
        merged[code] = seconds;
        changed = true;
      }
    }
    if (!changed) return;
    totals = merged;
    emit();
  },

  /** Writes one language's newest total (from a heartbeat or an added or removed entry). */
  set(languageCode: string, seconds: number) {
    version += 1;
    if (totals[languageCode] === seconds) return;
    totals = { ...totals, [languageCode]: seconds };
    emit();
  },

  /** The current write counter; pass it to `seed` so an older server render cannot overwrite newer writes. */
  version(): number {
    return version;
  },

  reset() {
    totals = {};
    version = 0;
    emit();
  },
};

const EMPTY: Totals = Object.freeze({});

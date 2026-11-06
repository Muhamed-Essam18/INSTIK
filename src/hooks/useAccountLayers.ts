"use client";

import { useCallback, useState } from "react";
import { saveLayers } from "@/lib/learner/preference-actions";
import type { Layers } from "@/lib/player/preferences";

type Options = {
  /** The learner's layers as the server read them from their account. */
  initial: Layers;
  languageCode: string;
  /** The layer names this language uses; others are never sent. */
  allowed: readonly string[];
};

/**
 * The learner's transcript layers, kept on their account. A change shows on screen at once and is saved in the
 * background; if saving fails the choice stays on screen, a note is shown, and the next change sends the full state.
 * Returns `[layers, setLayers, saveFailed]`.
 */
export function useAccountLayers({ initial, languageCode, allowed }: Options): [Layers, (next: Layers) => void, boolean] {
  const [layers, setLocal] = useState(initial);
  const [failed, setFailed] = useState(false);

  const setLayers = useCallback(
    (next: Layers) => {
      setLocal(next);
      const sent = Object.fromEntries(Object.entries(next).filter(([name]) => allowed.includes(name)));
      saveLayers({ languageCode, layers: sent }).then(
        (result) => setFailed(!result.ok),
        () => setFailed(true),
      );
    },
    [languageCode, allowed],
  );

  return [layers, setLayers, failed];
}

"use client";

import { useCallback, useState } from "react";
import { saveAnswer } from "@/lib/learner/preference-actions";
import type { Understood } from "@/lib/player/preferences";

type Options = {
  /** The learner's answer for this video as the server read it from their account. */
  initial: Understood | undefined;
  languageCode: string;
  videoSlug: string;
};

/**
 * The learner's فاهم؟ answer for one video, kept on their account. A new answer shows at once and replaces the old
 * one; if saving fails it stays on screen and a note is shown. Returns `[answer, setAnswer, saveFailed]`.
 */
export function useAccountAnswer({ initial, languageCode, videoSlug }: Options): [Understood | undefined, (next: Understood) => void, boolean] {
  const [answer, setLocal] = useState(initial);
  const [failed, setFailed] = useState(false);

  const setAnswer = useCallback(
    (next: Understood) => {
      setLocal(next);
      saveAnswer({ languageCode, videoSlug, answer: next }).then(
        (result) => setFailed(!result.ok),
        () => setFailed(true),
      );
    },
    [languageCode, videoSlug],
  );

  return [answer, setAnswer, failed];
}

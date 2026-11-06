"use client";

import { useStoredValue } from "@/hooks/useStoredValue";
import { AUTOPLAY_KEY, autoplaySchema } from "@/lib/player/preferences";

/** "Autoplay next": off by default, remembered on this device. */
export function AutoplaySwitch() {
  const [on, setOn] = useStoredValue(AUTOPLAY_KEY, autoplaySchema, false);
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => setOn(!on)}
      className="flex min-h-11 cursor-pointer items-center gap-2.5 border-0 bg-transparent px-1 text-label font-medium text-slate"
    >
      Autoplay next
      <span
        aria-hidden="true"
        data-track=""
        className={`flex h-[26px] w-11 items-center rounded-pill p-[3px] ${on ? "justify-end bg-teal" : "justify-start bg-slate"}`}
      >
        <span className="block size-5 rounded-pill bg-paper" />
      </span>
    </button>
  );
}

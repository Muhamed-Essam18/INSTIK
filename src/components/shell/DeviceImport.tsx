"use client";

import { useEffect, useRef } from "react";
import { useHydrated } from "@/hooks/useStoredValue";
import { importDevicePreferences } from "@/lib/learner/preference-actions";
import { collectDeviceChoices, removeDeviceKeys } from "@/lib/player/device-import";

type Props = { languages: readonly { slug: string; code: string }[] };

/**
 * Renders nothing. Once, after a learner signs in, moves the transcript layers and فاهم؟ answers kept on this device
 * to their account, then forgets the ones that moved. If anything goes wrong the device copy stays and it tries
 * again next time.
 */
export function DeviceImport({ languages }: Props) {
  const hydrated = useHydrated();
  const started = useRef(false);

  useEffect(() => {
    if (!hydrated || started.current) return;
    started.current = true;
    const device = collectDeviceChoices(languages);
    const nothing = Object.keys(device.layers).length === 0 && Object.keys(device.answers).length === 0;
    if (nothing) return;
    importDevicePreferences(device).then(
      (result) => {
        if (result.ok) removeDeviceKeys(languages, result.remove);
      },
      () => {
        // Keep everything on the device; the next page load tries again.
      },
    );
    // Runs once, after the device has been read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  return null;
}

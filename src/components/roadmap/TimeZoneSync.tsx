"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { syncTimeZone } from "@/lib/hours/actions";

/**
 * Tells the server which time zone this browser is in, so days are placed correctly. Renders nothing. The page
 * is refreshed once, only when the stored zone actually changed.
 */
export function TimeZoneSync() {
  const router = useRouter();
  useEffect(() => {
    let timeZone: string;
    try {
      timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }
    if (!timeZone) return;
    let cancelled = false;
    void syncTimeZone({ timeZone })
      .then((result) => {
        if (!cancelled && result.ok && result.changed) router.refresh();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [router]);
  return null;
}

"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { z } from "zod";
import { parseStored, readRaw, subscribeStored, writeStored } from "@/lib/player/preferences";

const noopSubscribe = () => () => {};

/** False on the server and during hydration, true afterwards. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

/**
 * A value remembered on this device. On the server and during hydration it is always `defaultValue`, so
 * server HTML and the first client render match; the stored value is read once the page has hydrated.
 * Stored data that is missing, corrupt or the wrong shape falls back to the default.
 * Returns `[value, setValue, ready]`; `ready` turns true once the stored value has been read.
 */
export function useStoredValue<T>(
  key: string,
  schema: z.ZodType<T>,
  defaultValue: T,
): [T, (next: T) => void, boolean] {
  const raw = useSyncExternalStore(
    subscribeStored,
    () => readRaw(key),
    () => null,
  );
  const ready = useHydrated();
  const value = useMemo(() => parseStored(raw, schema) ?? defaultValue, [raw, schema, defaultValue]);
  const setValue = useCallback((next: T) => writeStored(key, next), [key]);
  return [value, setValue, ready];
}

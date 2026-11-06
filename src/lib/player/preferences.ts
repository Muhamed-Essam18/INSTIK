import { z } from "zod";

export const layersSchema = z.object({
  script: z.boolean(),
  tashkeel: z.boolean(),
  transliteration: z.boolean(),
  english: z.boolean(),
});
export type Layers = z.infer<typeof layersSchema>;

export const DEFAULT_LAYERS: Layers = { script: true, tashkeel: true, transliteration: true, english: false };

export const understoodSchema = z.enum(["mostly", "some", "not-yet"]);
export type Understood = z.infer<typeof understoodSchema>;

export const autoplaySchema = z.boolean();

export const layersKey = (language: string) => `instik:v1:${language}:layers`;
export const understoodKey = (language: string, video: string) => `instik:v1:${language}:understood:${video}`;
export const AUTOPLAY_KEY = "instik:v1:autoplay";
/** sessionStorage: carries "play the next video" across one navigation. */
export const AUTOPLAY_NEXT_KEY = "instik:v1:autoplay-next";

// If localStorage is unavailable (private mode, blocked), values live here for the current visit.
const memory = new Map<string, string>();
const listeners = new Set<() => void>();

/** Raw stored string for a key, or null. Never throws. */
export function readRaw(key: string): string | null {
  try {
    const stored = window.localStorage.getItem(key);
    if (stored !== null) return stored;
  } catch {
    // fall through to the in-memory copy
  }
  return memory.get(key) ?? null;
}

export function parseStored<T>(raw: string | null, schema: z.ZodType<T>): T | undefined {
  if (raw === null) return undefined;
  try {
    const result = schema.safeParse(JSON.parse(raw));
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}

/** The stored value, or undefined when missing, corrupt, of the wrong shape, or storage throws. */
export function readStored<T>(key: string, schema: z.ZodType<T>): T | undefined {
  return parseStored(readRaw(key), schema);
}

/** Saves a value and tells subscribers. Never throws; the value still works for this visit without storage. */
export function writeStored(key: string, value: unknown): void {
  const raw = JSON.stringify(value);
  memory.set(key, raw);
  try {
    window.localStorage.setItem(key, raw);
  } catch {
    // keep the in-memory copy only
  }
  listeners.forEach((listener) => listener());
}

/** Every key stored on this device or kept for this visit. Never throws. */
export function listStoredKeys(): string[] {
  const keys = new Set(memory.keys());
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key !== null) keys.add(key);
    }
  } catch {
    // storage is unavailable: only this visit's copies exist
  }
  return [...keys];
}

/** Removes every stored value whose key matches, from both the in-memory copy and the device. Never throws. */
export function removeStoredWhere(matches: (key: string) => boolean): void {
  for (const key of [...memory.keys()]) if (matches(key)) memory.delete(key);
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key !== null && matches(key)) keys.push(key);
    }
    keys.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // storage is unavailable: nothing was persisted there to remove
  }
  listeners.forEach((listener) => listener());
}

export function subscribeStored(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** Test helper: forget the in-memory copies. */
export function resetStoredMemory(): void {
  memory.clear();
}

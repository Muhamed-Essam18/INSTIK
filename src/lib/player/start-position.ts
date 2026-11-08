// The `?t=<seconds>` a "Keep watching" link carries. Pure and strict: anything odd means "from the start".

/** A whole-second start position, or 0 for a missing, odd, negative value or one at or beyond the duration. */
export function startPosition(param: string | null | undefined, duration: number): number {
  if (typeof param !== "string" || !/^\d{1,7}(\.\d+)?$/.test(param.trim())) return 0;
  const seconds = Math.floor(Number(param));
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  if (Number.isFinite(duration) && duration > 0 && seconds >= duration) return 0;
  return seconds;
}

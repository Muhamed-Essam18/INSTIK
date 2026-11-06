/**
 * Index of the last cue whose start is at or before `time`, or -1 before the first cue.
 * Cues must be sorted by start (the transcript parser guarantees it). Only starts matter, so a gap keeps
 * the previous cue current and the last cue stays current after it ends.
 */
export function findCueIndex(cues: readonly { start: number }[], time: number): number {
  let low = 0;
  let high = cues.length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (cues[mid].start <= time) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found;
}

// The one soft chime played when an hour is added (only when the learner turned it on).
// The sound is synthesised by scripts/make-chime.mjs, so there is no third-party audio and no licence to track.

let audio: HTMLAudioElement | null = null;

/** Plays the chime once, quietly. A refused or failed play (autoplay rules, no audio) is ignored. */
export function playChime(): void {
  try {
    if (typeof Audio === "undefined") return;
    audio ??= new Audio("/sounds/hour-chime.wav");
    audio.volume = 0.4;
    audio.currentTime = 0;
    const started = audio.play();
    if (started && typeof started.catch === "function") started.catch(() => {});
  } catch {
    // no audio available: stay silent
  }
}

/** For tests. */
export function resetChime(): void {
  audio = null;
}

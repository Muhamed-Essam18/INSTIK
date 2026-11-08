// Honest hours, client side: a pure reducer that turns player events into counted seconds.
// Time counts only while the video is playing AND the tab is visible, never across a seek, and never for the same
// second of video twice in a row. No timers, no DOM: callers pass the wall clock (ms) and media position (s).

/** A stretch of counted watching, on the device's clock. */
export type Interval = { startWall: number; endWall: number; seconds: number };

export type CounterState = {
  playing: boolean;
  visible: boolean;
  rate: number;
  /** Baseline sample: where the last sample was and when. Null until a sample can be trusted. */
  position: number | null;
  wall: number | null;
  /** The last whole second of video that was credited. */
  lastCreditedSecond: number | null;
  /** After a seek back into the just-credited second, that second is not credited again. */
  skipSecond: number | null;
  /** Interval being built, and intervals already closed. */
  current: Interval | null;
  done: Interval[];
  /** Fractions of a second carried to the next interval so nothing is lost to rounding. */
  carry: number;
};

export type CounterEvent =
  | { type: "playing"; wall: number; position: number }
  | { type: "pause" | "waiting" | "ended"; wall: number; position: number }
  | { type: "timeupdate"; wall: number; position: number }
  | { type: "seeking"; wall: number; position: number }
  | { type: "visibility"; visible: boolean; wall: number; position: number }
  | { type: "ratechange"; rate: number; wall: number; position: number };

/** A gap between samples longer than this (a frozen or throttled tab) is not credited. */
export const MAX_GAP_SECONDS = 5;
/** Slack allowed between how far the video moved and how far real time moved before a jump counts as a seek. */
export const SEEK_SLACK_SECONDS = 0.75;
/** Credits closer together than this (ms) belong to the same interval. */
const JOIN_WITHIN_MS = 1500;
/** An interval is closed once it would last longer than this (ms). */
const MAX_INTERVAL_MS = 15_000;

export function initialCounter(): CounterState {
  return {
    playing: false,
    visible: true,
    rate: 1,
    position: null,
    wall: null,
    lastCreditedSecond: null,
    skipSecond: null,
    current: null,
    done: [],
    carry: 0,
  };
}

const rebase = (s: CounterState, wall: number, position: number): CounterState => ({
  ...s,
  position,
  wall,
});

const clearBaseline = (s: CounterState): CounterState => ({ ...s, position: null, wall: null });

function addCredit(s: CounterState, fromWall: number, toWall: number, seconds: number): CounterState {
  const cur = s.current;
  if (cur && fromWall - cur.endWall <= JOIN_WITHIN_MS && toWall - cur.startWall <= MAX_INTERVAL_MS) {
    return { ...s, current: { startWall: cur.startWall, endWall: toWall, seconds: cur.seconds + seconds } };
  }
  const done = cur ? [...s.done, cur] : s.done;
  return { ...s, done, current: { startWall: fromWall, endWall: toWall, seconds } };
}

/** Credits the span from the baseline to this sample, if it is a trustworthy stretch of real playing. */
function sample(s: CounterState, wall: number, position: number): CounterState {
  if (!s.playing || !s.visible) return clearBaseline(s);
  if (s.position === null || s.wall === null) return rebase(s, wall, position);

  const dWall = (wall - s.wall) / 1000;
  if (!(dWall > 0)) return s; // out of order or repeated: ignore, keep the baseline
  const dPos = position - s.position;
  const next = rebase(s, wall, position);

  if (dWall > MAX_GAP_SECONDS) return next; // frozen tab: the gap is not credited
  if (!(dPos > 0) || dPos > s.rate * dWall + SEEK_SLACK_SECONDS) return next; // stalled, or a jump (seek)

  // Leave out the part of this stretch that falls inside a second that was just credited before a seek back.
  let countedMedia = dPos;
  let skipSecond = s.skipSecond;
  if (skipSecond !== null) {
    const overlap = Math.max(0, Math.min(position, skipSecond + 1) - Math.max(s.position, skipSecond));
    countedMedia -= overlap;
    if (position >= skipSecond + 1) skipSecond = null;
  }
  const credit = Math.max(0, Math.min(dWall, countedMedia / s.rate));
  if (credit <= 0) return { ...next, skipSecond };

  return { ...addCredit(next, s.wall, wall, credit), skipSecond, lastCreditedSecond: Math.ceil(position) - 1 };
}

export function reduceCounter(state: CounterState, event: CounterEvent): CounterState {
  switch (event.type) {
    case "playing": {
      const s = { ...state, playing: true };
      return s.visible ? rebase(s, event.wall, event.position) : clearBaseline(s);
    }
    case "pause":
    case "waiting":
    case "ended": {
      // Credit up to this moment, then stop until playing resumes.
      const credited = sample(state, event.wall, event.position);
      return clearBaseline({ ...credited, playing: false });
    }
    case "timeupdate":
      return sample(state, event.wall, event.position);
    case "seeking": {
      // The jump adds nothing. A seek into the second just credited does not credit that second again.
      const into = state.lastCreditedSecond !== null && Math.floor(event.position) === state.lastCreditedSecond;
      const s = { ...state, skipSecond: into ? state.lastCreditedSecond : null };
      return s.playing && s.visible ? rebase(s, event.wall, event.position) : clearBaseline(s);
    }
    case "visibility": {
      if (!event.visible) return clearBaseline({ ...sample(state, event.wall, event.position), visible: false });
      const s = { ...state, visible: true };
      return s.playing ? rebase(s, event.wall, event.position) : clearBaseline(s);
    }
    case "ratechange": {
      const credited = sample(state, event.wall, event.position);
      return { ...credited, rate: event.rate > 0 ? event.rate : 1 };
    }
  }
}

/**
 * Takes the closed intervals (and closes the open one) as whole seconds, carrying fractions to the next call.
 * An interval worth less than one whole second keeps its fraction in `carry` and is dropped.
 */
export function takeIntervals(state: CounterState): { state: CounterState; intervals: Interval[] } {
  const all = state.current ? [...state.done, state.current] : state.done;
  let carry = state.carry;
  const intervals: Interval[] = [];
  for (const interval of all) {
    const total = interval.seconds + carry;
    const whole = Math.floor(total);
    carry = total - whole;
    if (whole >= 1) intervals.push({ ...interval, seconds: whole });
  }
  return { state: { ...state, done: [], current: null, carry }, intervals };
}

/** Counted seconds not yet taken, for display and tests. */
export function pendingSeconds(state: CounterState): number {
  const all = state.current ? [...state.done, state.current] : state.done;
  return all.reduce((n, i) => n + i.seconds, 0) + state.carry;
}

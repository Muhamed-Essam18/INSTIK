import { describe, expect, it } from "vitest";
import {
  initialCounter,
  pendingSeconds,
  reduceCounter,
  takeIntervals,
  type CounterEvent,
  type CounterState,
} from "@/lib/hours/counter";

/** A tiny player simulator: wall clock in ms, media position in seconds, events fed to the reducer. */
class Sim {
  state: CounterState = initialCounter();
  wall = 1_000_000;
  position = 0;
  rate = 1;
  private playingNow = false;

  feed(event: CounterEvent) {
    this.state = reduceCounter(this.state, event);
  }
  play() {
    this.playingNow = true;
    this.feed({ type: "playing", wall: this.wall, position: this.position });
  }
  pause() {
    this.playingNow = false;
    this.feed({ type: "pause", wall: this.wall, position: this.position });
  }
  /** Time passes; when playing, the video advances and timeupdate fires four times a second. */
  run(seconds: number, fireEvents = true) {
    const steps = Math.round(seconds * 4);
    for (let i = 0; i < steps; i++) {
      this.wall += 250;
      if (this.playingNow) this.position += 0.25 * this.rate;
      if (fireEvents && this.playingNow) this.feed({ type: "timeupdate", wall: this.wall, position: this.position });
    }
  }
  /** Time passes with no events at all (a frozen tab). */
  freeze(seconds: number) {
    this.wall += seconds * 1000;
    if (this.playingNow) this.position += seconds * this.rate;
  }
  hide() {
    this.feed({ type: "visibility", visible: false, wall: this.wall, position: this.position });
  }
  show() {
    this.feed({ type: "visibility", visible: true, wall: this.wall, position: this.position });
  }
  seek(to: number) {
    this.position = to;
    this.feed({ type: "seeking", wall: this.wall, position: this.position });
    this.feed({ type: "timeupdate", wall: this.wall, position: this.position });
  }
  setRate(rate: number) {
    this.rate = rate;
    this.feed({ type: "ratechange", rate, wall: this.wall, position: this.position });
  }
  get counted() {
    return pendingSeconds(this.state);
  }
}

describe("counter: what counts", () => {
  it("credits steady play, about 60s for 60s", () => {
    const s = new Sim();
    s.play();
    s.run(60);
    expect(s.counted).toBeGreaterThan(59);
    expect(s.counted).toBeLessThanOrEqual(60.01);
  });

  it("credits nothing while paused, then counts again after play", () => {
    const s = new Sim();
    s.play();
    s.run(5);
    s.pause();
    s.run(60);
    expect(s.counted).toBeCloseTo(5, 0);
    s.play();
    s.run(10);
    expect(s.counted).toBeCloseTo(15, 0);
  });

  it("does not count a hidden span, and starts a new baseline when visible again", () => {
    const s = new Sim();
    s.play();
    s.run(10);
    s.hide();
    s.run(30); // playing continues but the tab is hidden
    s.show();
    s.run(10);
    expect(s.counted).toBeGreaterThan(19);
    expect(s.counted).toBeLessThan(20.6);
  });

  it("does not count a muted background tab (hidden)", () => {
    const s = new Sim();
    s.play();
    s.hide();
    s.run(120);
    expect(s.counted).toBe(0);
  });

  it("counts a visible muted video (the learner is reading the transcript)", () => {
    const s = new Sim();
    s.play();
    s.run(20);
    expect(s.counted).toBeGreaterThan(19);
  });

  it("adds nothing for a seek forward of five minutes", () => {
    const s = new Sim();
    s.play();
    s.run(10);
    s.seek(s.position + 300);
    s.run(10);
    expect(s.counted).toBeGreaterThan(19);
    expect(s.counted).toBeLessThan(20.6);
  });

  it("adds nothing for a seek back", () => {
    const s = new Sim();
    s.position = 100;
    s.play();
    s.run(10);
    s.seek(20);
    s.run(10);
    expect(s.counted).toBeGreaterThan(19);
    expect(s.counted).toBeLessThan(20.6);
  });

  it("does not credit the just-credited second again after a seek back into it", () => {
    const s = new Sim();
    s.position = 10.0;
    s.play();
    s.run(0.75); // plays 10.0 to 10.75
    const before = s.counted;
    s.seek(10.0);
    s.run(0.75); // replays the same second
    expect(s.counted).toBeCloseTo(before, 1);
    s.run(1); // plays on into new time
    expect(s.counted).toBeGreaterThan(before + 0.7);
  });

  it("counts a loop of a longer span as real time", () => {
    const s = new Sim();
    s.position = 0;
    s.play();
    for (let i = 0; i < 4; i++) {
      s.run(5);
      s.seek(0);
    }
    expect(s.counted).toBeGreaterThan(19);
  });

  it("repeating one second over and over adds only the first pass", () => {
    const s = new Sim();
    s.position = 30;
    s.play();
    s.run(1);
    const first = s.counted;
    for (let i = 0; i < 20; i++) {
      s.seek(30);
      s.run(0.9);
    }
    expect(s.counted).toBeLessThan(first + 0.6);
  });

  it("counts about 60s for 60s of wall time at 0.75 speed", () => {
    const s = new Sim();
    s.setRate(0.75);
    s.play();
    s.run(60);
    expect(s.counted).toBeGreaterThan(59);
    expect(s.counted).toBeLessThanOrEqual(60.01);
  });

  it("credits at most 5s for a ten-minute frozen-tab gap (here, nothing)", () => {
    const s = new Sim();
    s.play();
    s.run(10);
    const before = s.counted;
    s.freeze(600);
    s.feed({ type: "timeupdate", wall: s.wall, position: s.position });
    expect(s.counted - before).toBeLessThanOrEqual(5);
  });

  it("ignores out-of-order or negative-time events", () => {
    const s = new Sim();
    s.play();
    s.run(5);
    const before = s.counted;
    s.feed({ type: "timeupdate", wall: s.wall - 3000, position: s.position - 3 });
    s.feed({ type: "timeupdate", wall: s.wall, position: s.position });
    expect(s.counted).toBeCloseTo(before, 3);
  });

  it("stops counting on waiting and on ended", () => {
    const s = new Sim();
    s.play();
    s.run(5);
    s.feed({ type: "waiting", wall: s.wall, position: s.position });
    const stalled = s.counted;
    s.run(30);
    expect(s.counted).toBeCloseTo(stalled, 3);
    s.feed({ type: "ended", wall: s.wall, position: s.position });
    s.run(30);
    expect(s.counted).toBeCloseTo(stalled, 3);
  });

  it("does not count a stalled position (buffering without a waiting event)", () => {
    const s = new Sim();
    s.play();
    s.run(5);
    const before = s.counted;
    for (let i = 0; i < 40; i++) {
      s.wall += 250;
      s.feed({ type: "timeupdate", wall: s.wall, position: s.position });
    }
    expect(s.counted).toBeCloseTo(before, 3);
  });
});

describe("counter: intervals", () => {
  it("closes intervals around gaps and at 15 seconds, keeping the total", () => {
    const s = new Sim();
    s.play();
    s.run(40);
    s.pause();
    s.run(20);
    s.play();
    s.run(10);
    const { intervals } = takeIntervals(s.state);
    expect(intervals.length).toBeGreaterThanOrEqual(4);
    for (const i of intervals) {
      expect(i.endWall - i.startWall).toBeLessThanOrEqual(20_000);
      expect(i.seconds).toBeLessThanOrEqual((i.endWall - i.startWall) / 1000 + 0.01);
    }
    const total = intervals.reduce((n, i) => n + i.seconds, 0);
    expect(total).toBeGreaterThan(48);
  });

  it("carries fractions between takes so nothing is lost", () => {
    const s = new Sim();
    s.play();
    let counted = 0;
    for (let i = 0; i < 120; i++) {
      s.run(0.5);
      const taken = takeIntervals(s.state);
      s.state = taken.state;
      counted += taken.intervals.reduce((n, x) => n + x.seconds, 0);
    }
    counted += pendingSeconds(s.state);
    expect(counted).toBeGreaterThan(59);
    expect(counted).toBeLessThanOrEqual(60.01);
  });

  it("a simulated ten-minute session with a pause and a hidden span is within 2s of the truth (SC-001)", () => {
    const s = new Sim();
    s.play();
    s.run(200);
    s.pause();
    s.run(60);
    s.play();
    s.run(100);
    s.hide();
    s.run(30);
    s.show();
    s.run(240);
    const truth = 200 + 100 + 240; // playing and visible
    let counted = 0;
    const taken = takeIntervals(s.state);
    counted += taken.intervals.reduce((n, x) => n + x.seconds, 0) + taken.state.carry;
    expect(Math.abs(counted - truth)).toBeLessThanOrEqual(2);
  });
});

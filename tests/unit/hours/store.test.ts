import { beforeEach, describe, expect, it, vi } from "vitest";
import { hoursStore } from "@/lib/hours/store";

beforeEach(() => hoursStore.reset());

describe("hoursStore", () => {
  it("seeds totals and notifies subscribers", () => {
    const listener = vi.fn();
    const off = hoursStore.subscribe(listener);
    hoursStore.seed({ arz: 3600 });
    expect(hoursStore.getSnapshot()).toEqual({ arz: 3600 });
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    hoursStore.set("arz", 4000);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("does not let an older server render lower a newer heartbeat total", () => {
    const seenBefore = hoursStore.version();
    hoursStore.set("arz", 5000);
    hoursStore.seed({ arz: 3600 }, seenBefore);
    expect(hoursStore.getSnapshot().arz).toBe(5000);
  });

  it("keeps the snapshot stable when nothing changes", () => {
    hoursStore.seed({ arz: 100 });
    const first = hoursStore.getSnapshot();
    hoursStore.seed({ arz: 100 });
    hoursStore.set("arz", 100);
    expect(hoursStore.getSnapshot()).toBe(first);
  });

  it("returns a stable, empty server snapshot", () => {
    expect(hoursStore.getServerSnapshot()).toBe(hoursStore.getServerSnapshot());
    expect(hoursStore.getServerSnapshot()).toEqual({});
  });

  it("keeps other languages when one changes", () => {
    hoursStore.seed({ arz: 100, es: 50 });
    hoursStore.set("arz", 200);
    expect(hoursStore.getSnapshot()).toEqual({ arz: 200, es: 50 });
  });
});

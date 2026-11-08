import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TimeZoneSync } from "@/components/roadmap/TimeZoneSync";
import { router } from "../../helpers/next-navigation";

const sync = vi.hoisted(() => vi.fn());
vi.mock("@/lib/hours/actions", () => ({ syncTimeZone: sync }));
vi.mock("next/navigation", () => import("../../helpers/next-navigation"));

beforeEach(() => {
  sync.mockReset();
  router.refresh.mockClear();
});
afterEach(cleanup);

describe("TimeZoneSync", () => {
  it("sends the browser's time zone once and renders nothing", async () => {
    sync.mockResolvedValue({ ok: true, changed: false });
    const { container } = render(<TimeZoneSync />);
    await vi.waitFor(() => expect(sync).toHaveBeenCalledTimes(1));
    expect(sync).toHaveBeenCalledWith({ timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
    expect(container.textContent).toBe("");
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("refreshes the page once, only when the stored zone changed", async () => {
    sync.mockResolvedValue({ ok: true, changed: true });
    render(<TimeZoneSync />);
    await vi.waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
  });

  it("ignores an invalid answer and a failure", async () => {
    sync.mockResolvedValue({ ok: false, code: "invalid" });
    render(<TimeZoneSync />);
    await vi.waitFor(() => expect(sync).toHaveBeenCalled());
    expect(router.refresh).not.toHaveBeenCalled();
    cleanup();
    sync.mockRejectedValue(new Error("offline"));
    render(<TimeZoneSync />);
    await vi.waitFor(() => expect(sync).toHaveBeenCalledTimes(2));
    expect(router.refresh).not.toHaveBeenCalled();
  });
});

import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStoredValue } from "@/hooks/useStoredValue";
import { autoplaySchema, resetStoredMemory } from "@/lib/player/preferences";

const KEY = "instik:v1:test-key";

function Probe({ setTo }: { setTo?: boolean }) {
  const [value, setValue, ready] = useStoredValue(KEY, autoplaySchema, false);
  return (
    <div>
      <span data-testid="value">{String(value)}</span>
      <span data-testid="ready">{String(ready)}</span>
      <button onClick={() => setValue(setTo ?? !value)}>set</button>
    </div>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  resetStoredMemory();
  // React reports IS_REACT_ACT_ENVIRONMENT for hydrateRoot inside act
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("useStoredValue", () => {
  it("renders the default on the server even when something is stored", () => {
    window.localStorage.setItem(KEY, "true");
    const html = renderToString(<Probe />);
    expect(html).toContain(">false<");
    expect(html).toContain('data-testid="ready">false<');
  });

  it("hydrates server HTML without a mismatch, then shows the stored value and becomes ready", async () => {
    window.localStorage.setItem(KEY, "true");
    const html = renderToString(<Probe />);
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});

    await act(async () => {
      hydrateRoot(container, <Probe />);
    });

    expect(errors).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="value"]')?.textContent).toBe("true");
    expect(container.querySelector('[data-testid="ready"]')?.textContent).toBe("true");
    container.remove();
  });

  it("falls back to the default for corrupt or wrong-shape stored data", () => {
    window.localStorage.setItem(KEY, "{oops");
    render(<Probe />);
    expect(screen.getByTestId("value").textContent).toBe("false");
    cleanup();
    window.localStorage.setItem(KEY, '"yes"');
    render(<Probe />);
    expect(screen.getByTestId("value").textContent).toBe("false");
  });

  it("writes new values to storage and updates the view", async () => {
    render(<Probe />);
    await act(async () => {
      screen.getByRole("button", { name: "set" }).click();
    });
    expect(screen.getByTestId("value").textContent).toBe("true");
    expect(window.localStorage.getItem(KEY)).toBe("true");
  });

  it("keeps working for the visit when localStorage throws", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(<Probe />);
    expect(screen.getByTestId("value").textContent).toBe("false");
    await act(async () => {
      screen.getByRole("button", { name: "set" }).click();
    });
    expect(screen.getByTestId("value").textContent).toBe("true");
  });
});

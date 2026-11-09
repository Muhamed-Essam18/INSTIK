import { cleanup, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock("@/components/marketing/StartLink", () => ({
  StartCta: ({ className, children }: { className: string; children: React.ReactNode }) => (
    <a href="/onboarding" className={className}>
      {children}
    </a>
  ),
}));

import Landing from "@/app/(marketing)/page";

afterEach(cleanup);

describe("landing page waitlist anchor", () => {
  it("has an element with id waitlist so the onboarding links resolve", () => {
    const { container } = render(<Landing />);
    expect(container.querySelector("#waitlist")).not.toBeNull();
  });

  it("has one main heading", () => {
    const { container } = render(<Landing />);
    expect(container.querySelectorAll("h1")).toHaveLength(1);
  });

  it("does not read the session, so it stays static", () => {
    const source = readFileSync("src/app/(marketing)/page.tsx", "utf8");
    expect(source).not.toMatch(/@\/lib\/session|@\/auth|@\/lib\/db/);
  });
});

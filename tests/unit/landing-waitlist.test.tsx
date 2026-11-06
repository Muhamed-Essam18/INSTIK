import { cleanup, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import Landing from "@/app/(shell)/page";

afterEach(cleanup);

describe("landing page waitlist anchor", () => {
  it("has an element with id waitlist so the onboarding links resolve", () => {
    const { container } = render(<Landing />);
    expect(container.querySelector("#waitlist")).not.toBeNull();
  });

  it("does not read the session, so it stays static", () => {
    const source = readFileSync("src/app/(shell)/page.tsx", "utf8");
    expect(source).not.toMatch(/@\/lib\/session|@\/auth|@\/lib\/db/);
  });
});

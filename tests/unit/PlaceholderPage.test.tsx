import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlaceholderPage } from "@/components/PlaceholderPage";

describe("PlaceholderPage", () => {
  it("renders one h1, the note and the back link", () => {
    render(<PlaceholderPage title="Pricing" note="On its way." backHref="/" backLabel="Back" />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Pricing");
    expect(screen.getByText("On its way.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back" }).getAttribute("href")).toBe("/");
  });
});

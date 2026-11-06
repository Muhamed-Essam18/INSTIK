import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SignInPrompt } from "@/components/watch/SignInPrompt";

afterEach(cleanup);

describe("SignInPrompt", () => {
  const returnTo = "/learn/arabic-egyptian/watch/at-the-cafe";

  it("invites the visitor to create a free account and names the video and its host", () => {
    render(<SignInPrompt videoTitle="At the café" hostName="Salma" returnTo={returnTo} />);
    expect(screen.getByText("Create a free account to watch and save your hours")).toBeTruthy();
    expect(screen.getByText("At the café")).toBeTruthy();
    expect(screen.getByText(/with Salma/)).toBeTruthy();
  });

  it("links returning learners to sign in, keeping the return address", () => {
    render(<SignInPrompt videoTitle="At the café" hostName="Salma" returnTo={returnTo} />);
    const link = screen.getByRole("link", { name: "Already have an account? Sign in" });
    expect(link.getAttribute("href")).toBe(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
  });

  it("never contains a video", () => {
    const { container } = render(<SignInPrompt videoTitle="At the café" hostName="Salma" returnTo={returnTo} />);
    expect(container.querySelector("video, iframe, mux-player")).toBeNull();
  });
});

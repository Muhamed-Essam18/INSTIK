import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DecisionBar } from "@/components/owner/DecisionBar";

const actions = vi.hoisted(() => ({ decide: vi.fn() }));
vi.mock("@/lib/review/actions", () => actions);

beforeEach(() => actions.decide.mockReset());
afterEach(cleanup);

const bar = (canApprove = true) => render(<DecisionBar videoId="v1" creatorName="Salma" canApprove={canApprove} />);
const note = (value: string) => fireEvent.change(screen.getByLabelText("Note to the creator"), { target: { value } });

describe("DecisionBar", () => {
  it("disables Approve with the reason line from the design until it can be approved", () => {
    bar(false);
    const approve = screen.getByRole("button", { name: "Approve and publish" }) as HTMLButtonElement;
    expect(approve.disabled).toBe(true);
    expect(document.getElementById(approve.getAttribute("aria-describedby")!)?.textContent).toMatch(/publishes the video to learners and tells Salma/);
    fireEvent.click(approve);
    expect(actions.decide).not.toHaveBeenCalled();
  });

  it.each(["Reject", "Request changes"])("asks for a note before %s and sends nothing", (name) => {
    bar();
    fireEvent.click(screen.getByRole("button", { name }));
    expect(screen.getByRole("alert").textContent).toMatch(/Write a short note/);
    expect(actions.decide).not.toHaveBeenCalled();
    note("   ");
    fireEvent.click(screen.getByRole("button", { name }));
    expect(actions.decide).not.toHaveBeenCalled();
  });

  it("approves without a note and shows who was told, with a link back to the queue", async () => {
    actions.decide.mockResolvedValue({ ok: true, emailSent: true, message: "Approved and published. Salma has been told." });
    bar();
    fireEvent.click(screen.getByRole("button", { name: "Approve and publish" }));
    await waitFor(() => expect(actions.decide).toHaveBeenCalledWith({ videoId: "v1", decision: "approve", note: "" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Approved and published. Salma has been told."));
    expect(screen.getByRole("link", { name: "Back to the review queue" }).getAttribute("href")).toBe("/owner");
    expect(screen.queryByRole("button", { name: "Reject" })).toBeNull();
  });

  it("says plainly when the email did not go", async () => {
    actions.decide.mockResolvedValue({ ok: true, emailSent: false, message: "Rejected. We couldn't email Salma. Please tell them yourself." });
    bar();
    note("Not for us.");
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/couldn't email Salma/));
  });

  it("shows a refusal and changes nothing on screen", async () => {
    actions.decide.mockResolvedValue({ ok: false, kind: "not-in-review", message: "This video isn't waiting for review any more, so nothing was changed." });
    bar();
    fireEvent.click(screen.getByRole("button", { name: "Approve and publish" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/nothing was changed/));
    expect(screen.getByRole("button", { name: "Approve and publish" })).toBeTruthy();
  });

  it("disables every button while a decision is in flight, so it cannot be sent twice", async () => {
    let finish!: (value: unknown) => void;
    actions.decide.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    bar();
    fireEvent.click(screen.getByRole("button", { name: "Approve and publish" }));
    await waitFor(() => expect((screen.getByRole("button", { name: "Reject" }) as HTMLButtonElement).disabled).toBe(true));
    expect((screen.getByRole("button", { name: "Request changes" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Approve and publish" }));
    expect(actions.decide).toHaveBeenCalledTimes(1);
    finish({ ok: true, emailSent: true, message: "Approved and published. Salma has been told." });
    await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
  });
});

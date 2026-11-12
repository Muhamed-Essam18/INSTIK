import { describe, expect, it } from "vitest";
import { parseOwnerEmails, resolveRole } from "@/lib/roles/rules";

describe("parseOwnerEmails", () => {
  it("trims, lower-cases and splits on commas", () => {
    expect(parseOwnerEmails(" A@Instik.test , b@instik.test ")).toEqual(["a@instik.test", "b@instik.test"]);
  });

  it("drops blanks, invalid entries and duplicates", () => {
    expect(parseOwnerEmails("a@x.com,,not-an-email, A@X.com ,b@x")).toEqual(["a@x.com"]);
  });

  it("gives no owners for an unset or empty value", () => {
    expect(parseOwnerEmails(undefined)).toEqual([]);
    expect(parseOwnerEmails("")).toEqual([]);
    expect(parseOwnerEmails(" , ")).toEqual([]);
  });
});

describe("resolveRole", () => {
  const owners = ["boss@instik.test"];

  it("is learner by default and creator after accepting an invitation", () => {
    expect(resolveRole({ email: "a@x.com", role: "LEARNER" }, owners)).toBe("learner");
    expect(resolveRole({ email: "a@x.com", role: "CREATOR" }, owners)).toBe("creator");
  });

  it("is owner when the email is on the list, whatever is stored", () => {
    expect(resolveRole({ email: "boss@instik.test", role: "LEARNER" }, owners)).toBe("owner");
    expect(resolveRole({ email: "boss@instik.test", role: "CREATOR" }, owners)).toBe("owner");
  });

  it("matches the email without regard to case or spaces", () => {
    expect(resolveRole({ email: " Boss@Instik.test ", role: "LEARNER" }, owners)).toBe("owner");
  });

  it("gives nobody the owner role when the list is empty", () => {
    expect(resolveRole({ email: "boss@instik.test", role: "LEARNER" }, [])).toBe("learner");
  });

  it("withdraws the owner role when the email leaves the list", () => {
    expect(resolveRole({ email: "boss@instik.test", role: "CREATOR" }, owners)).toBe("owner");
    expect(resolveRole({ email: "boss@instik.test", role: "CREATOR" }, [])).toBe("creator");
  });
});

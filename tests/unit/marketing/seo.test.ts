import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { siteUrl } from "@/lib/site";

describe("sitemap", () => {
  it("lists exactly the four marketing pages", () => {
    const urls = sitemap().map((e) => e.url);
    const base = siteUrl();
    expect(urls).toEqual([base, `${base}/pricing`, `${base}/about`, `${base}/privacy`]);
  });
});

describe("robots", () => {
  it("keeps account, onboarding and learning pages out and names the sitemap", () => {
    const r = robots();
    const rules = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rules.allow).toBe("/");
    expect(rules.disallow).toEqual(["/api/", "/sign-in", "/onboarding", "/settings", "/learn"]);
    expect(r.sitemap).toBe(`${siteUrl()}/sitemap.xml`);
  });
});

describe("siteUrl", () => {
  it("prefers SITE_URL, then the Vercel production URL, then localhost", () => {
    expect(siteUrl({ SITE_URL: "https://instik.example/", VERCEL_PROJECT_PRODUCTION_URL: "x.vercel.app" })).toBe(
      "https://instik.example",
    );
    expect(siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "x.vercel.app" })).toBe("https://x.vercel.app");
    expect(siteUrl({})).toBe("http://localhost:3000");
  });
});

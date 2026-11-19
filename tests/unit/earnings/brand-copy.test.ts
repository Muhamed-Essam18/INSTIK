import { readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  adjustmentRefusal,
  amountProblem,
  closeRefusal,
  CLOSE_CONFIRM,
  ESTIMATED,
  LEFTOVER_CENTS_HELP,
  netZeroExplanation,
  NO_VIEWS,
  NOT_ENTERED,
  payoutRefusal,
  saveRefusal,
  type AdjustmentRefusal,
  type CloseRefusal,
  type PayoutRefusal,
  type SaveReason,
} from "@/lib/earnings/messages";
import { grantDone, grantRefusal, removeDone, removeRefusal, reasonLabel } from "@/lib/grants/messages";
import type { GrantRefusal, RemoveRefusal } from "@/lib/grants/service";
import { REQUEST_CLOSED, REQUEST_POSTED, REQUEST_SAVED, requestRefusal } from "@/lib/requests/messages";
import type { RequestRefusal } from "@/lib/requests/service";

// Brand behaviours as acceptance criteria (constitution II, spec 11 FR-039, FR-040): short, calm, never shaming; estimates are called estimates;
// no streaks, no infinite scroll, no tests; creators are never compared with each other.

const save: SaveReason[] = ["month", "future", "closed", "stale", "negative", "not-whole", "too-large", "read-only"];
const adjust: AdjustmentRefusal[] = ["month", "future", "closed", "not-whole", "zero", "too-large", "no-note", "note-too-long"];
const close: CloseRefusal[] = ["month", "not-ended", "no-revenue"];
const payout: PayoutRefusal[] = ["month", "open", "nothing-to-pay", "already-paid", "empty", "too-long", "not-found", "not-paid", "already-reversed"];
const grant: GrantRefusal[] = ["email", "reason", "note-too-long", "no-account", "already-granted"];
const remove: RemoveRefusal[] = ["email", "note-too-long", "no-account", "no-grant"];
const request: RequestRefusal[] = ["stage", "topic", "empty", "too-long", "not-found", "closed"];

const copy = [
  ...save.map((r) => saveRefusal(r, "grossCents")),
  ...adjust.map(adjustmentRefusal),
  ...close.map(closeRefusal),
  ...payout.map(payoutRefusal),
  ...(["empty", "negative", "too-large", "too-many-decimals", "not-a-number"] as const).map((r) => amountProblem(r, "Payment fees")),
  CLOSE_CONFIRM("October 2026"),
  netZeroExplanation("€0.00"),
  NOT_ENTERED,
  NO_VIEWS,
  LEFTOVER_CENTS_HELP,
  ...grant.map(grantRefusal),
  ...remove.map(removeRefusal),
  grantDone("mona@example.com"),
  removeDone("mona@example.com"),
  ...Object.values(reasonLabel),
  ...request.map(requestRefusal),
  REQUEST_POSTED,
  REQUEST_SAVED,
  REQUEST_CLOSED,
];

describe("the new messages", () => {
  it("are short sentences, never shaming or alarming", () => {
    expect(copy.length).toBeGreaterThan(40);
    for (const text of copy) {
      expect(text.length, text).toBeLessThan(200);
      expect(text, text).not.toMatch(/failed|error|invalid|wrong|you must|forbidden|denied|illegal|violation|streak|overdue|behind|lost/i);
    }
  });

  it("say what to do next when something was not accepted, in plain words", () => {
    expect(saveRefusal("stale")).toMatch(/Reload/);
    expect(closeRefusal("no-revenue")).toMatch(/Enter this month's revenue first/);
    expect(closeRefusal("not-ended")).toMatch(/once it has/);
    expect(payoutRefusal("empty")).toMatch(/Add a reference/);
    expect(adjustmentRefusal("no-note")).toMatch(/Add a short note/);
    expect(grantRefusal("no-account")).toMatch(/sign in once first/);
    expect(requestRefusal("empty")).toMatch(/Write a sentence or two/);
  });

  it("call this month's figures estimates, and say 'Payment pending' rather than anything late", () => {
    expect(ESTIMATED).toBe("estimated");
    expect(readFileSync("src/components/creator/EarningsCard.tsx", "utf8")).toMatch(/payment pending/);
    expect(readFileSync("src/components/creator/EarningsCard.tsx", "utf8")).toMatch(/\(estimated\)/);
    expect(readFileSync("src/components/owner/StatementCard.tsx", "utf8")).toMatch(/"Estimated"/);
  });
});

const strip = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const creatorFiles = ["StatTile", "WeeklyViews", "EarningsCard", "AnswerBar", "TopVideos", "RequestsList"].map((n) => `src/components/creator/${n}.tsx`);
const ownerFiles = ["RevenueForm", "MonthPicker", "StatementCard", "CreatorSharesTable", "CloseMonthButton", "MarkPaidButton", "UndoPaymentButton", "PayoutHistory", "AdjustmentForm", "GrantForm", "RemoveGrantButton", "GrantHistory", "RequestForm", "RequestsTable"].map((n) => `src/components/owner/${n}.tsx`);
const screens = ["CreatorScreen", "OwnerEarningsScreen", "OwnerAccessScreen", "OwnerRequestsScreen"].map((n) => `src/components/screens/${n}.tsx`);
const sources = [...creatorFiles, ...ownerFiles, ...screens];

describe("the new screens and components", () => {
  it("finds the files", () => {
    expect(sources.length).toBe(24);
    for (const file of sources) expect(statSync(file).isFile(), file).toBe(true);
  });

  it.each(sources)("%s has no streak, infinite scroll, test or shaming wording", (file) => {
    const text = strip(readFileSync(file, "utf8"));
    expect(text).not.toMatch(/streak/i);
    expect(text).not.toMatch(/IntersectionObserver|infinite|load more|show more/i);
    expect(text).not.toMatch(/quiz|\bscore\b|you missed|overdue|falling behind/i);
  });

  it.each([...creatorFiles, "src/components/screens/CreatorScreen.tsx"])("%s never compares a creator with others", (file) => {
    const text = strip(readFileSync(file, "utf8"));
    expect(text).not.toMatch(/other creators|everyone else|leaderboard|\brank(ing|ed)?\b|compared (to|with)|top creators/i);
  });

  it("uses colour tokens only, never raw colours", () => {
    for (const file of sources) expect(strip(readFileSync(file, "utf8")), file).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(/);
  });

  it("every Arabic word sets its own language and direction", () => {
    for (const file of sources) {
      const text = strip(readFileSync(file, "utf8"));
      for (const match of text.matchAll(/[؀-ۿ]+/g)) {
        // Arabic is either inside an element that sets lang="ar" just before it, or part of a text alternative (an aria-label).
        const before = text.slice(Math.max(0, (match.index ?? 0) - 160), match.index);
        expect(`${file}: ${before}`).toMatch(/lang="ar"|aria-label|label\s*=\s*`/);
      }
    }
    expect(readFileSync("src/components/creator/TopVideos.tsx", "utf8")).toMatch(/lang="ar" dir="rtl"/);
  });

  it("lists end: the top videos, weeks, requests, history and months are all capped", () => {
    expect(readFileSync("src/lib/earnings/dashboard-data.ts", "utf8")).toMatch(/TOP_VIDEOS = 5/);
    expect(readFileSync("src/lib/earnings/months.ts", "utf8")).toMatch(/lastFiveWeeks/);
    expect(readFileSync("src/lib/requests/service.ts", "utf8")).toMatch(/OPEN_LIST_LIMIT = 20/);
    expect(readFileSync("src/lib/earnings/service.ts", "utf8")).toMatch(/PAYOUT_HISTORY = 100/);
    expect(readFileSync("src/lib/earnings/service.ts", "utf8")).toMatch(/MONTH_LIST = 24/);
    expect(readFileSync("src/lib/grants/service.ts", "utf8")).toMatch(/HISTORY = 100/);
  });
});

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// The database guards of spec 11 (FR-003, FR-023, FR-028, FR-029, FR-034): this reads the migration that creates them,
// so a rule cannot be dropped without a test noticing.

const dir = path.join(process.cwd(), "prisma", "migrations");
const names = readdirSync(dir);
const first = names.find((name) => name.endsWith("_creator_earnings"));
const second = names.find((name) => name.endsWith("_creator_earnings_triggers"));
const tables = first ? readFileSync(path.join(dir, first, "migration.sql"), "utf8") : "";
const sql = second ? readFileSync(path.join(dir, second, "migration.sql"), "utf8") : "";

describe("the earnings migrations", () => {
  it("exist, the triggers one after the tables one", () => {
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(names.indexOf(second!)).toBeGreaterThan(names.indexOf(first!));
  });

  it("creates every table the triggers guard before the triggers", () => {
    for (const table of ["CountedView", "RevenueChange", "RevenueAdjustment", "Payout", "CreatorEarning", "AccessGrantEvent", "MonthlyRevenue", "EarningsMonth"]) {
      expect(tables, table).toMatch(new RegExp(`CREATE TABLE "${table}"`));
    }
  });
});

describe("append-only tables", () => {
  const appendOnly = ["RevenueChange", "RevenueAdjustment", "CountedView", "CreatorEarning", "Payout", "AccessGrantEvent"];

  it.each(appendOnly)("%s refuses UPDATE and DELETE with a row trigger", (table) => {
    expect(sql).toMatch(new RegExp(`CREATE TRIGGER "${table}_append_only"\\s+BEFORE UPDATE OR DELETE ON "${table}"\\s+FOR EACH ROW`));
  });

  it("always refuses changes to the revenue history and adjustments", () => {
    expect(sql).toMatch(/"refuse_history_change"/);
    expect(sql).toMatch(/RAISE EXCEPTION '% is append-only/);
  });

  it("lets deleting an account set the reference columns to NULL and nothing else (counted views, earnings, payouts)", () => {
    expect(sql).toMatch(/"refuse_change_except_set_null"\('userId', 'creatorId'\)/);
    expect(sql).toMatch(/"refuse_change_except_set_null"\('creatorId'\)/);
    expect(sql).toMatch(/may only be set to NULL/);
  });

  it("lets deleting an account cascade to its grant events, and clear the owner reference", () => {
    expect(sql).toMatch(/NOT EXISTS \(SELECT 1 FROM "User" WHERE "id" = OLD\."userId"\)/);
    expect(sql).toMatch(/NEW\."byId" IS NULL/);
  });

  it("creates each trigger after its function", () => {
    for (const fn of ["refuse_history_change", "refuse_change_except_set_null", "refuse_grant_event_change", "refuse_closed_month_change", "refuse_closed_earnings_month_change"]) {
      expect(sql.indexOf(`FUNCTION "${fn}"`), fn).toBeGreaterThanOrEqual(0);
      expect(sql.indexOf(`FUNCTION "${fn}"`), fn).toBeLessThan(sql.indexOf(`EXECUTE FUNCTION "${fn}"`));
    }
  });
});

describe("a closed month never changes", () => {
  it("locks the month's revenue (insert, update and delete)", () => {
    expect(sql).toMatch(/CREATE TRIGGER "MonthlyRevenue_closed_month"\s+BEFORE INSERT OR UPDATE OR DELETE ON "MonthlyRevenue"/);
  });

  it("refuses a new adjustment for a closed month", () => {
    expect(sql).toMatch(/CREATE TRIGGER "RevenueAdjustment_closed_month"\s+BEFORE INSERT ON "RevenueAdjustment"/);
  });

  it("refuses any update or delete of a closed EarningsMonth row", () => {
    expect(sql).toMatch(/CREATE TRIGGER "EarningsMonth_closed"\s+BEFORE UPDATE OR DELETE ON "EarningsMonth"/);
    expect(sql).toMatch(/OLD\."status" = 'CLOSED'/);
  });
});

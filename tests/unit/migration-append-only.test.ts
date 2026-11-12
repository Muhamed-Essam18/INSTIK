import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Status history is append-only (spec FR-021): the database refuses UPDATE and DELETE of a status event. This reads the
// migration that creates the trigger, so the rule cannot be dropped without a test noticing.

const dir = path.join(process.cwd(), "prisma", "migrations");
const migration = readdirSync(dir).find((name) => name.endsWith("_creator_content"));
const sql = migration ? readFileSync(path.join(dir, migration, "migration.sql"), "utf8") : "";

describe("the creator content migration", () => {
  it("exists", () => {
    expect(migration).toBeDefined();
  });

  it("creates the status event table and refuses UPDATE and DELETE on it with a row trigger", () => {
    expect(sql).toMatch(/CREATE TABLE "VideoStatusEvent"/);
    expect(sql).toMatch(/CREATE TRIGGER "VideoStatusEvent_append_only"\s+BEFORE UPDATE OR DELETE ON "VideoStatusEvent"\s+FOR EACH ROW/);
    expect(sql).toMatch(/RAISE EXCEPTION/);
  });

  it("creates the trigger after the table", () => {
    expect(sql.indexOf('CREATE TABLE "VideoStatusEvent"')).toBeLessThan(sql.indexOf("CREATE TRIGGER"));
  });
});

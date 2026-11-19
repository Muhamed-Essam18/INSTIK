-- Spec 11 database guards. The service enforces these rules too; the triggers keep them true for any code outside the app.
-- They are a separate migration because the tables are created (and may be applied) before the triggers are added.
-- Deleting an account is a deliberate act: it may cascade (AccessGrantEvent) or set a reference to NULL, and nothing else may change.

-- 1. Always append-only: no change, no exception.
CREATE OR REPLACE FUNCTION "refuse_history_change"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: % is not allowed', TG_TABLE_NAME, TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "RevenueChange_append_only"
BEFORE UPDATE OR DELETE ON "RevenueChange"
FOR EACH ROW EXECUTE FUNCTION "refuse_history_change"();

CREATE TRIGGER "RevenueAdjustment_append_only"
BEFORE UPDATE OR DELETE ON "RevenueAdjustment"
FOR EACH ROW EXECUTE FUNCTION "refuse_history_change"();

-- 2. Append-only, except that the named reference columns may be set to NULL (what ON DELETE SET NULL does).
CREATE OR REPLACE FUNCTION "refuse_change_except_set_null"() RETURNS trigger AS $$
DECLARE
  col text;
  old_row jsonb;
  new_row jsonb;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    old_row := to_jsonb(OLD);
    new_row := to_jsonb(NEW);
    FOREACH col IN ARRAY TG_ARGV LOOP
      IF new_row -> col <> 'null'::jsonb AND new_row -> col IS DISTINCT FROM old_row -> col THEN
        RAISE EXCEPTION '% is append-only: % may only be set to NULL', TG_TABLE_NAME, col;
      END IF;
      old_row := old_row - col;
      new_row := new_row - col;
    END LOOP;
    IF old_row = new_row THEN
      RETURN NEW;
    END IF;
  END IF;
  RAISE EXCEPTION '% is append-only: % is not allowed', TG_TABLE_NAME, TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "CountedView_append_only"
BEFORE UPDATE OR DELETE ON "CountedView"
FOR EACH ROW EXECUTE FUNCTION "refuse_change_except_set_null"('userId', 'creatorId');

CREATE TRIGGER "CreatorEarning_append_only"
BEFORE UPDATE OR DELETE ON "CreatorEarning"
FOR EACH ROW EXECUTE FUNCTION "refuse_change_except_set_null"('creatorId');

CREATE TRIGGER "Payout_append_only"
BEFORE UPDATE OR DELETE ON "Payout"
FOR EACH ROW EXECUTE FUNCTION "refuse_change_except_set_null"('creatorId');

-- 3. Grant history: like the pause history, a DELETE is allowed only when the account itself is gone (cascade);
--    an UPDATE may only clear the owner reference (ON DELETE SET NULL).
CREATE OR REPLACE FUNCTION "refuse_grant_event_change"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM "User" WHERE "id" = OLD."userId") THEN
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW."byId" IS NULL AND (to_jsonb(NEW) - 'byId') = (to_jsonb(OLD) - 'byId') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'AccessGrantEvent is append-only: % is not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AccessGrantEvent_append_only"
BEFORE UPDATE OR DELETE ON "AccessGrantEvent"
FOR EACH ROW EXECUTE FUNCTION "refuse_grant_event_change"();

-- 4. A closed month never changes: its revenue, adjustments and the month row itself are locked.
CREATE OR REPLACE FUNCTION "refuse_closed_month_change"() RETURNS trigger AS $$
DECLARE
  target text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target := OLD."month";
  ELSE
    target := NEW."month";
  END IF;
  IF EXISTS (SELECT 1 FROM "EarningsMonth" WHERE "month" = target AND "status" = 'CLOSED') THEN
    RAISE EXCEPTION 'Month % is closed: % on % is not allowed', target, TG_OP, TG_TABLE_NAME;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "MonthlyRevenue_closed_month"
BEFORE INSERT OR UPDATE OR DELETE ON "MonthlyRevenue"
FOR EACH ROW EXECUTE FUNCTION "refuse_closed_month_change"();

CREATE TRIGGER "RevenueAdjustment_closed_month"
BEFORE INSERT ON "RevenueAdjustment"
FOR EACH ROW EXECUTE FUNCTION "refuse_closed_month_change"();

CREATE OR REPLACE FUNCTION "refuse_closed_earnings_month_change"() RETURNS trigger AS $$
BEGIN
  IF OLD."status" = 'CLOSED' THEN
    RAISE EXCEPTION 'Month % is closed: % on EarningsMonth is not allowed', OLD."month", TG_OP;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "EarningsMonth_closed"
BEFORE UPDATE OR DELETE ON "EarningsMonth"
FOR EACH ROW EXECUTE FUNCTION "refuse_closed_earnings_month_change"();

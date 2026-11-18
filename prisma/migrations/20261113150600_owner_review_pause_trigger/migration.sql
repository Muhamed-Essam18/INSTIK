-- Pause history is append-only: refuse any UPDATE or DELETE of a pause event, so the rule holds even for code outside the app.
-- (Deleting a creator account removes their events by cascade; that is a deliberate account deletion, not an edit of history.)
CREATE OR REPLACE FUNCTION "refuse_pause_event_change"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM "User" WHERE "id" = OLD."userId") THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'CreatorPauseEvent is append-only: % is not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "CreatorPauseEvent_append_only"
BEFORE UPDATE OR DELETE ON "CreatorPauseEvent"
FOR EACH ROW EXECUTE FUNCTION "refuse_pause_event_change"();

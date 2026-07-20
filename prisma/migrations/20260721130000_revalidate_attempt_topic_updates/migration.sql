BEGIN;

-- Recheck the destination scope even when a link changes topic within the same
-- attempt. The original trigger handled moved links but missed this mutation.
CREATE OR REPLACE FUNCTION enforce_attempt_topic_scope()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'AssessmentAttemptTopic' THEN
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
      PERFORM assert_attempt_topic_scope(OLD."attemptId");
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
      PERFORM assert_attempt_topic_scope(NEW."attemptId");
    END IF;
  ELSE
    PERFORM assert_attempt_topic_scope(NEW."id");
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMIT;

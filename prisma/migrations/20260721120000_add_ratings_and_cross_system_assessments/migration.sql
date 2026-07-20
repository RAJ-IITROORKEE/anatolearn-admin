BEGIN;

-- Existing feedback intentionally remains unrated. Install the default only
-- after the nullable column exists so it applies exclusively to future rows.
ALTER TABLE "Feedback" ADD COLUMN "rating" DECIMAL(2,1);
ALTER TABLE "Feedback" ALTER COLUMN "rating" SET DEFAULT 4.5;
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_rating_check"
  CHECK (
    "rating" IS NULL
    OR ("rating" BETWEEN 0.5 AND 5 AND "rating" * 2 = floor("rating" * 2))
  );

ALTER TABLE "AssessmentAttempt" ALTER COLUMN "organSystemId" DROP NOT NULL;

DROP TRIGGER "AssessmentAttemptTopic_scope" ON "AssessmentAttemptTopic";

-- Validate the complete topic set at transaction commit. A singular system is
-- retained only for one-system scopes; mixed scopes must store NULL.
CREATE OR REPLACE FUNCTION assert_attempt_topic_scope(scope_attempt_id UUID)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  stored_system UUID;
  system_count INTEGER;
  sole_system UUID;
BEGIN
  SELECT attempt."organSystemId", COUNT(DISTINCT topic."organSystemId")::int,
    MIN(topic."organSystemId"::text)::uuid
  INTO stored_system, system_count, sole_system
  FROM "AssessmentAttempt" attempt
  LEFT JOIN "AssessmentAttemptTopic" link ON link."attemptId" = attempt."id"
  LEFT JOIN "Topic" topic ON topic."id" = link."topicId"
  WHERE attempt."id" = scope_attempt_id
  GROUP BY attempt."organSystemId";

  IF system_count IS NULL THEN
    RETURN;
  END IF;
  IF system_count = 0 THEN
    RAISE EXCEPTION 'Assessment attempt must retain at least one topic';
  ELSIF system_count = 1 AND stored_system IS DISTINCT FROM sole_system THEN
    RAISE EXCEPTION 'Single-system attempt scope must retain its organ system';
  ELSIF system_count > 1 AND stored_system IS NOT NULL THEN
    RAISE EXCEPTION 'Mixed-system attempt scope must not retain a singular organ system';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION enforce_attempt_topic_scope()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'AssessmentAttemptTopic' THEN
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
      PERFORM assert_attempt_topic_scope(OLD."attemptId");
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE')
      AND (TG_OP = 'INSERT' OR OLD."attemptId" IS DISTINCT FROM NEW."attemptId") THEN
      PERFORM assert_attempt_topic_scope(NEW."attemptId");
    END IF;
  ELSE
    PERFORM assert_attempt_topic_scope(NEW."id");
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE CONSTRAINT TRIGGER "AssessmentAttemptTopic_scope"
AFTER INSERT OR UPDATE OR DELETE ON "AssessmentAttemptTopic"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_attempt_topic_scope();

CREATE CONSTRAINT TRIGGER "AssessmentAttempt_scope"
AFTER INSERT OR UPDATE OF "organSystemId" ON "AssessmentAttempt"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_attempt_topic_scope();

REVOKE ALL PRIVILEGES ON FUNCTION assert_attempt_topic_scope(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION enforce_attempt_topic_scope() FROM PUBLIC, anon, authenticated;

COMMIT;

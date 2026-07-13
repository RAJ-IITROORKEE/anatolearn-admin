-- Required snapshot columns cannot be safely synthesized for historical attempts.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "AssessmentAttempt") THEN
    RAISE EXCEPTION 'Assessment snapshot migration requires an empty AssessmentAttempt table';
  END IF;
END;
$$;

ALTER TABLE "AttemptQuestion"
  ADD COLUMN "topicIdSnapshot" UUID NOT NULL,
  ADD COLUMN "topicTitleSnapshot" TEXT NOT NULL,
  ADD COLUMN "difficultySnapshot" "Difficulty" NOT NULL,
  ADD COLUMN "conceptTagSnapshot" TEXT,
  ADD COLUMN "organSystemIdSnapshot" UUID NOT NULL,
  ADD COLUMN "organSystemNameSnapshot" TEXT NOT NULL,
  ADD COLUMN "mediaIdSnapshot" UUID;

CREATE INDEX "AssessmentAttempt_userId_createdAt_id_idx" ON "AssessmentAttempt"("userId", "createdAt", "id");
CREATE INDEX "AttemptQuestion_topicIdSnapshot_difficultySnapshot_idx" ON "AttemptQuestion"("topicIdSnapshot", "difficultySnapshot");
CREATE INDEX "AttemptQuestion_organSystemIdSnapshot_difficultySnapshot_idx" ON "AttemptQuestion"("organSystemIdSnapshot", "difficultySnapshot");

ALTER TABLE "AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_status_timing_check"
  CHECK (
    ("status" = 'IN_PROGRESS' AND "completedAt" IS NULL AND "durationSeconds" IS NULL
      AND "correctCount" = 0 AND "incorrectCount" = 0 AND "unansweredCount" = "totalQuestionCount" AND "scorePercentage" = 0)
    OR
    ("status" IN ('COMPLETED', 'AUTO_SUBMITTED') AND "completedAt" IS NOT NULL AND "durationSeconds" IS NOT NULL)
    OR
    ("status" = 'ABANDONED' AND "completedAt" IS NOT NULL)
  );
ALTER TABLE "AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_expiry_consistency_check"
  CHECK ("assessmentType" = 'QUIZ' OR "expiresAt" = "startedAt" + ("timeLimitSeconds" * interval '1 second'));

CREATE OR REPLACE FUNCTION prevent_attempt_snapshot_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."attemptId" IS DISTINCT FROM NEW."attemptId"
    OR OLD."sourceQuestionId" IS DISTINCT FROM NEW."sourceQuestionId"
    OR OLD."sourceQuestionSnapshotId" IS DISTINCT FROM NEW."sourceQuestionSnapshotId"
    OR OLD."displayOrder" IS DISTINCT FROM NEW."displayOrder"
    OR OLD."questionTextSnapshot" IS DISTINCT FROM NEW."questionTextSnapshot"
    OR OLD."imageUrlSnapshot" IS DISTINCT FROM NEW."imageUrlSnapshot"
    OR OLD."mediaIdSnapshot" IS DISTINCT FROM NEW."mediaIdSnapshot"
    OR OLD."explanationSnapshot" IS DISTINCT FROM NEW."explanationSnapshot"
    OR OLD."optionsSnapshot" IS DISTINCT FROM NEW."optionsSnapshot"
    OR OLD."correctOptionKey" IS DISTINCT FROM NEW."correctOptionKey"
    OR OLD."topicIdSnapshot" IS DISTINCT FROM NEW."topicIdSnapshot"
    OR OLD."topicTitleSnapshot" IS DISTINCT FROM NEW."topicTitleSnapshot"
    OR OLD."difficultySnapshot" IS DISTINCT FROM NEW."difficultySnapshot"
    OR OLD."conceptTagSnapshot" IS DISTINCT FROM NEW."conceptTagSnapshot"
    OR OLD."organSystemIdSnapshot" IS DISTINCT FROM NEW."organSystemIdSnapshot"
    OR OLD."organSystemNameSnapshot" IS DISTINCT FROM NEW."organSystemNameSnapshot"
  THEN RAISE EXCEPTION 'Attempt question snapshots are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "AttemptQuestion_snapshot_immutable"
BEFORE UPDATE ON "AttemptQuestion"
FOR EACH ROW EXECUTE FUNCTION prevent_attempt_snapshot_mutation();

CREATE OR REPLACE FUNCTION enforce_attempt_lifecycle_immutability()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."userId" IS DISTINCT FROM NEW."userId"
    OR OLD."assessmentType" IS DISTINCT FROM NEW."assessmentType"
    OR OLD."organSystemId" IS DISTINCT FROM NEW."organSystemId"
    OR OLD."requestedQuestionCount" IS DISTINCT FROM NEW."requestedQuestionCount"
    OR OLD."totalQuestionCount" IS DISTINCT FROM NEW."totalQuestionCount"
    OR OLD."timeLimitSeconds" IS DISTINCT FROM NEW."timeLimitSeconds"
    OR OLD."startedAt" IS DISTINCT FROM NEW."startedAt"
    OR OLD."expiresAt" IS DISTINCT FROM NEW."expiresAt"
    OR OLD."retakeSourceId" IS DISTINCT FROM NEW."retakeSourceId"
  THEN RAISE EXCEPTION 'Assessment attempt scope and timing are immutable';
  END IF;
  IF OLD."status" <> 'IN_PROGRESS' AND (
    OLD."status" IS DISTINCT FROM NEW."status"
    OR OLD."correctCount" IS DISTINCT FROM NEW."correctCount"
    OR OLD."incorrectCount" IS DISTINCT FROM NEW."incorrectCount"
    OR OLD."unansweredCount" IS DISTINCT FROM NEW."unansweredCount"
    OR OLD."scorePercentage" IS DISTINCT FROM NEW."scorePercentage"
    OR OLD."durationSeconds" IS DISTINCT FROM NEW."durationSeconds"
    OR OLD."completedAt" IS DISTINCT FROM NEW."completedAt"
  ) THEN RAISE EXCEPTION 'Terminal assessment results are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "AssessmentAttempt_lifecycle_immutable"
BEFORE UPDATE ON "AssessmentAttempt"
FOR EACH ROW EXECUTE FUNCTION enforce_attempt_lifecycle_immutability();

CREATE OR REPLACE FUNCTION enforce_attempt_answer_lifecycle()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (OLD."answeredOptionKey" IS DISTINCT FROM NEW."answeredOptionKey"
    OR OLD."isCorrect" IS DISTINCT FROM NEW."isCorrect"
    OR OLD."answeredAt" IS DISTINCT FROM NEW."answeredAt"
    OR OLD."timeSpentSeconds" IS DISTINCT FROM NEW."timeSpentSeconds")
    AND NOT EXISTS (
      SELECT 1 FROM "AssessmentAttempt"
      WHERE "id" = NEW."attemptId" AND "status" = 'IN_PROGRESS'
    )
  THEN RAISE EXCEPTION 'Answers cannot change after an attempt is terminal';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "AttemptQuestion_answer_lifecycle"
BEFORE UPDATE ON "AttemptQuestion"
FOR EACH ROW EXECUTE FUNCTION enforce_attempt_answer_lifecycle();

CREATE OR REPLACE FUNCTION enforce_attempt_child_insert_lifecycle()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "AssessmentAttempt"
    WHERE "id" = NEW."attemptId" AND "status" = 'IN_PROGRESS'
  ) THEN RAISE EXCEPTION 'Attempt children can only be added while in progress';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "AttemptQuestion_insert_lifecycle"
BEFORE INSERT ON "AttemptQuestion"
FOR EACH ROW EXECUTE FUNCTION enforce_attempt_child_insert_lifecycle();
CREATE TRIGGER "AssessmentAttemptTopic_insert_lifecycle"
BEFORE INSERT ON "AssessmentAttemptTopic"
FOR EACH ROW EXECUTE FUNCTION enforce_attempt_child_insert_lifecycle();

CREATE OR REPLACE FUNCTION prevent_attempt_history_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Assessment history cannot be deleted';
END;
$$;

CREATE TRIGGER "AttemptQuestion_no_delete" BEFORE DELETE ON "AttemptQuestion"
FOR EACH ROW EXECUTE FUNCTION prevent_attempt_history_delete();
CREATE TRIGGER "AssessmentAttemptTopic_no_update_or_delete" BEFORE UPDATE OR DELETE ON "AssessmentAttemptTopic"
FOR EACH ROW EXECUTE FUNCTION prevent_attempt_history_delete();
CREATE TRIGGER "AssessmentAttempt_no_delete" BEFORE DELETE ON "AssessmentAttempt"
FOR EACH ROW EXECUTE FUNCTION prevent_attempt_history_delete();

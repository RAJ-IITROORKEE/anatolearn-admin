ALTER TABLE "Feedback" ADD COLUMN "trashedAt" TIMESTAMPTZ(3), ADD COLUMN "purgeAfter" TIMESTAMPTZ(3), ADD COLUMN "nextPurgeAttemptAt" TIMESTAMPTZ(3);

ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_trash_consistency" CHECK (
  ("trashedAt" IS NULL AND "purgeAfter" IS NULL AND "nextPurgeAttemptAt" IS NULL)
  OR ("trashedAt" IS NOT NULL AND "purgeAfter" = "trashedAt" + interval '30 days' AND "nextPurgeAttemptAt" >= "purgeAfter")
);

CREATE INDEX "Feedback_trash_due_idx" ON "Feedback" ("nextPurgeAttemptAt", "purgeAfter", "id") WHERE "trashedAt" IS NOT NULL;

CREATE TRIGGER enforce_safe_trash_delete
  BEFORE DELETE ON "Feedback"
  FOR EACH ROW EXECUTE FUNCTION enforce_safe_trash_delete();

CREATE TRIGGER enforce_trash_restore_deadline
  BEFORE UPDATE ON "Feedback"
  FOR EACH ROW EXECUTE FUNCTION enforce_trash_restore_deadline();

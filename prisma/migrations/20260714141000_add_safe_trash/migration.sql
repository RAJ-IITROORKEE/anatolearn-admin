ALTER TABLE "OrganSystem" ADD COLUMN "trashedAt" TIMESTAMPTZ(3), ADD COLUMN "purgeAfter" TIMESTAMPTZ(3), ADD COLUMN "nextPurgeAttemptAt" TIMESTAMPTZ(3);
ALTER TABLE "Topic" ADD COLUMN "trashedAt" TIMESTAMPTZ(3), ADD COLUMN "purgeAfter" TIMESTAMPTZ(3), ADD COLUMN "nextPurgeAttemptAt" TIMESTAMPTZ(3);
ALTER TABLE "ContentLesson" ADD COLUMN "trashedAt" TIMESTAMPTZ(3), ADD COLUMN "purgeAfter" TIMESTAMPTZ(3), ADD COLUMN "nextPurgeAttemptAt" TIMESTAMPTZ(3);
ALTER TABLE "Flashcard" ADD COLUMN "trashedAt" TIMESTAMPTZ(3), ADD COLUMN "purgeAfter" TIMESTAMPTZ(3), ADD COLUMN "nextPurgeAttemptAt" TIMESTAMPTZ(3);
ALTER TABLE "Question" ADD COLUMN "trashedAt" TIMESTAMPTZ(3), ADD COLUMN "purgeAfter" TIMESTAMPTZ(3), ADD COLUMN "nextPurgeAttemptAt" TIMESTAMPTZ(3);
ALTER TABLE "MediaAsset" ADD COLUMN "trashedAt" TIMESTAMPTZ(3), ADD COLUMN "purgeAfter" TIMESTAMPTZ(3), ADD COLUMN "nextPurgeAttemptAt" TIMESTAMPTZ(3);

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['OrganSystem', 'Topic', 'ContentLesson', 'Flashcard', 'Question'] LOOP
    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I CHECK (("trashedAt" IS NULL AND "purgeAfter" IS NULL AND "nextPurgeAttemptAt" IS NULL) OR ("trashedAt" IS NOT NULL AND "purgeAfter" = "trashedAt" + interval ''30 days'' AND "nextPurgeAttemptAt" >= "purgeAfter" AND "status" = ''ARCHIVED''::"PublishStatus"))',
      table_name,
      table_name || '_trash_consistency'
    );
  END LOOP;
END;
$$;

ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_trash_consistency" CHECK (
  ("trashedAt" IS NULL AND "purgeAfter" IS NULL AND "nextPurgeAttemptAt" IS NULL)
  OR ("trashedAt" IS NOT NULL AND "purgeAfter" = "trashedAt" + interval '30 days' AND "nextPurgeAttemptAt" >= "purgeAfter" AND "archivedAt" IS NOT NULL)
);

CREATE INDEX "OrganSystem_trash_due_idx" ON "OrganSystem" ("nextPurgeAttemptAt", "purgeAfter", "id") WHERE "trashedAt" IS NOT NULL;
CREATE INDEX "Topic_trash_due_idx" ON "Topic" ("nextPurgeAttemptAt", "purgeAfter", "id") WHERE "trashedAt" IS NOT NULL;
CREATE INDEX "ContentLesson_trash_due_idx" ON "ContentLesson" ("nextPurgeAttemptAt", "purgeAfter", "id") WHERE "trashedAt" IS NOT NULL;
CREATE INDEX "Flashcard_trash_due_idx" ON "Flashcard" ("nextPurgeAttemptAt", "purgeAfter", "id") WHERE "trashedAt" IS NOT NULL;
CREATE INDEX "Question_trash_due_idx" ON "Question" ("nextPurgeAttemptAt", "purgeAfter", "id") WHERE "trashedAt" IS NOT NULL;
CREATE INDEX "MediaAsset_trash_due_idx" ON "MediaAsset" ("nextPurgeAttemptAt", "purgeAfter", "id") WHERE "trashedAt" IS NOT NULL;

CREATE TABLE "MediaPurgeJob" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "mediaAssetId" UUID NOT NULL,
  "bucket" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseToken" UUID,
  "leaseUntil" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MediaPurgeJob_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MediaPurgeJob_attemptCount_check" CHECK ("attemptCount" >= 0),
  CONSTRAINT "MediaPurgeJob_lease_check" CHECK (("leaseToken" IS NULL) = ("leaseUntil" IS NULL))
);
CREATE UNIQUE INDEX "MediaPurgeJob_bucket_path_key" ON "MediaPurgeJob" ("bucket", "path");
CREATE INDEX "MediaPurgeJob_nextAttemptAt_leaseUntil_id_idx" ON "MediaPurgeJob" ("nextAttemptAt", "leaseUntil", "id");
CREATE INDEX "MediaPurgeJob_mediaAssetId_idx" ON "MediaPurgeJob" ("mediaAssetId");

CREATE OR REPLACE FUNCTION enforce_safe_trash_delete() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF OLD."trashedAt" IS NULL OR OLD."purgeAfter" IS NULL OR OLD."purgeAfter" > clock_timestamp() THEN
    RAISE EXCEPTION 'Direct hard delete is forbidden before safe trash retention expires';
  END IF;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION enforce_trash_restore_deadline() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF OLD."trashedAt" IS NOT NULL AND NEW."trashedAt" IS NULL AND clock_timestamp() >= OLD."purgeAfter" THEN
    RAISE EXCEPTION USING ERRCODE = 'PZ001', MESSAGE = 'Trash retention deadline has expired';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['OrganSystem', 'Topic', 'ContentLesson', 'Flashcard', 'Question', 'MediaAsset'] LOOP
    EXECUTE format('CREATE TRIGGER enforce_safe_trash_delete BEFORE DELETE ON %I FOR EACH ROW EXECUTE FUNCTION enforce_safe_trash_delete()', table_name);
    EXECUTE format('CREATE TRIGGER enforce_trash_restore_deadline BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION enforce_trash_restore_deadline()', table_name);
  END LOOP;
END;
$$;

DO $$
DECLARE
  application_schema name := current_schema();
BEGIN
  IF application_schema IS NULL OR application_schema IN ('auth', 'storage') THEN
    RAISE EXCEPTION 'Refusing to alter an unresolved or protected schema';
  END IF;
  EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE %I."MediaPurgeJob" FROM anon, authenticated', application_schema);
  EXECUTE format('ALTER TABLE %I."MediaPurgeJob" ENABLE ROW LEVEL SECURITY', application_schema);
  EXECUTE format('REVOKE ALL PRIVILEGES ON FUNCTION %I.enforce_safe_trash_delete() FROM PUBLIC, anon, authenticated', application_schema);
  EXECUTE format('REVOKE ALL PRIVILEGES ON FUNCTION %I.enforce_trash_restore_deadline() FROM PUBLIC, anon, authenticated', application_schema);
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA %I REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated', application_schema);
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA %I REVOKE ALL PRIVILEGES ON FUNCTIONS FROM PUBLIC, anon, authenticated', application_schema);
END;
$$;

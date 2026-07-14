-- The preceding migration commits all new enum labels before this migration
-- references them in checks and partial indexes.
-- Repeat the empty-table preflight at the structural transaction boundary so
-- rows cannot appear between the enum and structure migrations.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "NotificationCampaign") THEN
    RAISE EXCEPTION 'Phase 6 notification migration requires an empty NotificationCampaign table';
  END IF;
  IF EXISTS (SELECT 1 FROM "NotificationRecipient") THEN
    RAISE EXCEPTION 'Phase 6 notification migration requires an empty NotificationRecipient table';
  END IF;
  IF EXISTS (SELECT 1 FROM "NotificationDelivery") THEN
    RAISE EXCEPTION 'Phase 6 notification migration requires an empty NotificationDelivery table';
  END IF;
END;
$$;

ALTER TABLE "Feedback"
  ADD COLUMN "resolvedById" UUID,
  ADD COLUMN "resolvedAt" TIMESTAMPTZ(3);

-- The previous consistency check guarantees review metadata for existing
-- resolved feedback, so it is the best available resolution audit snapshot.
UPDATE "Feedback"
SET "resolvedById" = "reviewedById",
    "resolvedAt" = "reviewedAt"
WHERE "status" = 'RESOLVED'
  AND "reviewedById" IS NOT NULL
  AND "reviewedAt" IS NOT NULL;

ALTER TABLE "Feedback" DROP CONSTRAINT "Feedback_review_consistency_check";
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_review_resolution_consistency_check"
  CHECK (
    ("status" = 'NEW'
      AND "reviewedById" IS NULL AND "reviewedAt" IS NULL
      AND "resolvedById" IS NULL AND "resolvedAt" IS NULL)
    OR
    ("status" = 'REVIEWED'
      AND "reviewedById" IS NOT NULL AND "reviewedAt" IS NOT NULL
      AND "resolvedById" IS NULL AND "resolvedAt" IS NULL)
    OR
    ("status" = 'RESOLVED'
      AND "reviewedById" IS NOT NULL AND "reviewedAt" IS NOT NULL
      AND "resolvedById" IS NOT NULL AND "resolvedAt" IS NOT NULL)
  );

ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_resolvedById_fkey"
  FOREIGN KEY ("resolvedById") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX "Feedback_status_createdAt_idx";
DROP INDEX "Feedback_userId_createdAt_idx";
CREATE INDEX "Feedback_status_createdAt_id_idx" ON "Feedback"("status", "createdAt", "id");
CREATE INDEX "Feedback_userId_createdAt_id_idx" ON "Feedback"("userId", "createdAt", "id");
CREATE INDEX "Feedback_resolvedById_idx" ON "Feedback"("resolvedById");

ALTER TABLE "NotificationCampaign"
  ADD COLUMN "materializedAt" TIMESTAMPTZ(3),
  ADD COLUMN "processingStartedAt" TIMESTAMPTZ(3),
  ADD COLUMN "processingLeaseUntil" TIMESTAMPTZ(3),
  ADD COLUMN "processingToken" UUID,
  ADD COLUMN "nextProcessAt" TIMESTAMPTZ(3),
  ADD COLUMN "cancelledById" UUID,
  ADD COLUMN "cancelledAt" TIMESTAMPTZ(3),
  ADD COLUMN "failureCode" TEXT,
  ADD COLUMN "failureMessage" TEXT;

ALTER TABLE "NotificationCampaign" ADD CONSTRAINT "NotificationCampaign_cancelledById_fkey"
  FOREIGN KEY ("cancelledById") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX "NotificationCampaign_status_scheduledAt_idx";
DROP INDEX "NotificationCampaign_due_idx";
CREATE INDEX "NotificationCampaign_status_createdAt_id_idx" ON "NotificationCampaign"("status", "createdAt", "id");
CREATE INDEX "NotificationCampaign_status_scheduledAt_id_idx" ON "NotificationCampaign"("status", "scheduledAt", "id");
CREATE INDEX "NotificationCampaign_status_nextProcessAt_id_idx" ON "NotificationCampaign"("status", "nextProcessAt", "id");
CREATE INDEX "NotificationCampaign_cancelledById_idx" ON "NotificationCampaign"("cancelledById");
CREATE INDEX "NotificationCampaign_due_idx"
  ON "NotificationCampaign"("nextProcessAt", "id")
  WHERE "status" IN ('SCHEDULED', 'PROCESSING', 'FAILED') AND "nextProcessAt" IS NOT NULL;

ALTER TABLE "NotificationCampaign" ADD CONSTRAINT "NotificationCampaign_lifecycle_check"
  CHECK (
    (("status" = 'CANCELLED' AND "cancelledById" IS NOT NULL AND "cancelledAt" IS NOT NULL)
      OR ("status" <> 'CANCELLED' AND "cancelledById" IS NULL AND "cancelledAt" IS NULL))
    AND
    (("status" IN ('SENT', 'PARTIAL') AND "sentAt" IS NOT NULL)
      OR ("status" NOT IN ('SENT', 'PARTIAL') AND "sentAt" IS NULL))
    AND
    (("status" = 'PROCESSING'
      AND "processingStartedAt" IS NOT NULL
      AND "processingLeaseUntil" IS NOT NULL
      AND "processingToken" IS NOT NULL
      AND "processingLeaseUntil" > "processingStartedAt")
      OR ("status" <> 'PROCESSING'
        AND "processingLeaseUntil" IS NULL
        AND "processingToken" IS NULL))
    AND ("status" NOT IN ('DRAFT', 'SCHEDULED') OR "processingStartedAt" IS NULL)
    AND ("status" NOT IN ('SENT', 'PARTIAL', 'FAILED') OR "processingStartedAt" IS NOT NULL)
    AND ("materializedAt" IS NULL OR "status" IN ('PROCESSING', 'SENT', 'PARTIAL', 'FAILED'))
    AND ("status" NOT IN ('SENT', 'PARTIAL', 'FAILED') OR "materializedAt" IS NOT NULL)
    AND ("status" <> 'DRAFT' OR ("scheduledAt" IS NULL AND "nextProcessAt" IS NULL))
    AND ("status" <> 'SCHEDULED' OR ("scheduledAt" IS NOT NULL AND "nextProcessAt" IS NOT NULL))
    AND ("nextProcessAt" IS NULL OR "status" IN ('SCHEDULED', 'PROCESSING', 'FAILED'))
  );

CREATE INDEX "NotificationRecipient_campaignId_createdAt_id_idx"
  ON "NotificationRecipient"("campaignId", "createdAt", "id");

ALTER TABLE "NotificationDelivery" DROP CONSTRAINT "NotificationDelivery_deviceTokenId_fkey";
ALTER TABLE "NotificationDelivery"
  ALTER COLUMN "deviceTokenId" SET NOT NULL,
  ADD COLUMN "platformSnapshot" "DevicePlatform" NOT NULL,
  ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "receiptAttemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "nextAttemptAt" TIMESTAMPTZ(3),
  ADD COLUMN "lastAttemptAt" TIMESTAMPTZ(3),
  ADD COLUMN "ticketedAt" TIMESTAMPTZ(3),
  ADD COLUMN "receiptCheckedAt" TIMESTAMPTZ(3),
  ADD COLUMN "processingLeaseUntil" TIMESTAMPTZ(3),
  ADD COLUMN "processingToken" UUID,
  ADD COLUMN "providerErrorMessage" TEXT;

ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_deviceTokenId_fkey"
  FOREIGN KEY ("deviceTokenId") REFERENCES "DeviceToken"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "NotificationDelivery_recipientId_deviceTokenId_key"
  ON "NotificationDelivery"("recipientId", "deviceTokenId");
CREATE INDEX "NotificationDelivery_status_nextAttemptAt_id_idx"
  ON "NotificationDelivery"("status", "nextAttemptAt", "id");
CREATE INDEX "NotificationDelivery_status_ticketedAt_id_idx"
  ON "NotificationDelivery"("status", "ticketedAt", "id");
CREATE INDEX "NotificationDelivery_status_processingLeaseUntil_id_idx"
  ON "NotificationDelivery"("status", "processingLeaseUntil", "id");
DROP INDEX "NotificationDelivery_pending_idx";

ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_attemptCount_nonnegative_check"
  CHECK ("attemptCount" >= 0 AND "receiptAttemptCount" >= 0);
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_lifecycle_check"
  CHECK (
    (("attemptCount" = 0 AND "lastAttemptAt" IS NULL)
      OR ("attemptCount" > 0 AND "lastAttemptAt" IS NOT NULL))
    AND (("providerReceiptId" IS NULL AND "ticketedAt" IS NULL)
      OR ("providerReceiptId" IS NOT NULL AND "ticketedAt" IS NOT NULL))
    AND ("receiptCheckedAt" IS NULL OR "ticketedAt" IS NOT NULL)
    AND (("receiptAttemptCount" = 0 AND "receiptCheckedAt" IS NULL)
      OR ("receiptAttemptCount" > 0 AND "receiptCheckedAt" IS NOT NULL))
    AND (("processingToken" IS NULL AND "processingLeaseUntil" IS NULL)
      OR ("processingToken" IS NOT NULL AND "processingLeaseUntil" IS NOT NULL
        AND "status" IN ('PENDING', 'TICKETED')))
    AND ("status" NOT IN ('SENT', 'FAILED', 'CANCELLED')
      OR ("processingToken" IS NULL AND "processingLeaseUntil" IS NULL))
    AND ("nextAttemptAt" IS NULL OR "status" IN ('PENDING', 'FAILED'))
    AND (
      ("status" = 'PENDING'
        AND "providerReceiptId" IS NULL AND "ticketedAt" IS NULL
        AND "sentAt" IS NULL AND "failedAt" IS NULL)
      OR
      ("status" = 'TICKETED'
        AND "providerReceiptId" IS NOT NULL AND "ticketedAt" IS NOT NULL
        AND "sentAt" IS NULL AND "failedAt" IS NULL)
      OR
      ("status" = 'SENT'
        AND "providerReceiptId" IS NOT NULL AND "ticketedAt" IS NOT NULL
        AND "receiptCheckedAt" IS NOT NULL AND "sentAt" IS NOT NULL
        AND "failedAt" IS NULL AND "nextAttemptAt" IS NULL)
      OR
      ("status" = 'FAILED' AND "sentAt" IS NULL AND "failedAt" IS NOT NULL)
      OR
      ("status" = 'CANCELLED'
        AND "providerReceiptId" IS NULL AND "ticketedAt" IS NULL
        AND "sentAt" IS NULL AND "failedAt" IS NULL AND "nextAttemptAt" IS NULL)
    )
  );

DROP INDEX "Profile_role_isActive_idx";
CREATE INDEX "Profile_role_isActive_createdAt_id_idx" ON "Profile"("role", "isActive", "createdAt", "id");
CREATE INDEX "Profile_role_createdAt_id_idx" ON "Profile"("role", "createdAt", "id");
CREATE INDEX "AssessmentAttempt_status_assessmentType_completedAt_id_idx"
  ON "AssessmentAttempt"("status", "assessmentType", "completedAt", "id");
CREATE INDEX "AuditLog_createdAt_id_idx" ON "AuditLog"("createdAt", "id");

CREATE OR REPLACE FUNCTION enforce_notification_recipient_history()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Notification recipients cannot be deleted';
  END IF;
  IF OLD."id" IS DISTINCT FROM NEW."id"
    OR OLD."campaignId" IS DISTINCT FROM NEW."campaignId"
    OR OLD."userId" IS DISTINCT FROM NEW."userId"
    OR OLD."createdAt" IS DISTINCT FROM NEW."createdAt"
  THEN RAISE EXCEPTION 'Notification recipient identity is immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "NotificationRecipient_history_guard"
BEFORE UPDATE OR DELETE ON "NotificationRecipient"
FOR EACH ROW EXECUTE FUNCTION enforce_notification_recipient_history();

CREATE OR REPLACE FUNCTION enforce_notification_delivery_history()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Notification deliveries cannot be deleted';
  END IF;
  IF OLD."recipientId" IS DISTINCT FROM NEW."recipientId"
    OR OLD."deviceTokenId" IS DISTINCT FROM NEW."deviceTokenId"
    OR OLD."tokenSnapshot" IS DISTINCT FROM NEW."tokenSnapshot"
    OR OLD."platformSnapshot" IS DISTINCT FROM NEW."platformSnapshot"
    OR OLD."createdAt" IS DISTINCT FROM NEW."createdAt"
  THEN RAISE EXCEPTION 'Notification delivery identity and snapshots are immutable';
  END IF;
  IF OLD."status" IN ('SENT', 'CANCELLED') THEN
    RAISE EXCEPTION 'Terminal notification deliveries are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "NotificationDelivery_history_guard"
BEFORE UPDATE OR DELETE ON "NotificationDelivery"
FOR EACH ROW EXECUTE FUNCTION enforce_notification_delivery_history();

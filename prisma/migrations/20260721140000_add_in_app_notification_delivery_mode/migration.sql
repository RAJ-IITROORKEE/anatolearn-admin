CREATE TYPE "NotificationDeliveryMode" AS ENUM ('PUSH', 'IN_APP');

ALTER TABLE "NotificationCampaign"
  ADD COLUMN "deliveryMode" "NotificationDeliveryMode" NOT NULL DEFAULT 'PUSH';

DROP INDEX "NotificationCampaign_due_idx";
CREATE INDEX "NotificationCampaign_due_idx"
  ON "NotificationCampaign"("nextProcessAt", "id")
  WHERE "deliveryMode" = 'PUSH'
    AND "status" IN ('SCHEDULED', 'PROCESSING', 'FAILED')
    AND "nextProcessAt" IS NOT NULL;

ALTER TABLE "NotificationCampaign"
  DROP CONSTRAINT "NotificationCampaign_lifecycle_check";

ALTER TABLE "NotificationCampaign"
  ADD CONSTRAINT "NotificationCampaign_lifecycle_check"
  CHECK (
    (("status" = 'CANCELLED' AND "cancelledById" IS NOT NULL AND "cancelledAt" IS NOT NULL)
      OR ("status" <> 'CANCELLED' AND "cancelledById" IS NULL AND "cancelledAt" IS NULL))
    AND (
      (
        "deliveryMode" = 'IN_APP'
        AND "status" = 'SENT'
        AND "sentAt" IS NOT NULL
        AND "materializedAt" IS NOT NULL
        AND "scheduledAt" IS NULL
        AND "processingStartedAt" IS NULL
        AND "processingLeaseUntil" IS NULL
        AND "processingToken" IS NULL
        AND "nextProcessAt" IS NULL
      )
      OR (
        "deliveryMode" = 'PUSH'
        AND (("status" IN ('SENT', 'PARTIAL') AND "sentAt" IS NOT NULL)
          OR ("status" NOT IN ('SENT', 'PARTIAL') AND "sentAt" IS NULL))
        AND (("status" = 'PROCESSING'
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
      )
    )
  );

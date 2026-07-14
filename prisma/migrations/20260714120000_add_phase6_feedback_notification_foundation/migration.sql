-- Notification lifecycle semantics and required delivery snapshots cannot be
-- inferred safely for existing campaign data.
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

-- These labels must commit before any later migration references them.
ALTER TYPE "NotificationStatus" ADD VALUE 'PROCESSING' BEFORE 'SENT';
ALTER TYPE "NotificationStatus" ADD VALUE 'PARTIAL' AFTER 'SENT';
ALTER TYPE "NotificationStatus" ADD VALUE 'FAILED' AFTER 'PARTIAL';
ALTER TYPE "NotificationDeliveryStatus" ADD VALUE 'TICKETED' BEFORE 'SENT';

CREATE TYPE "PublicationSourceType" AS ENUM ('CONTENT_LESSON', 'FLASHCARD', 'QUESTION');

CREATE TABLE "NotificationPublicationSource" (
  "id" UUID NOT NULL,
  "sourceType" "PublicationSourceType" NOT NULL,
  "sourceId" UUID NOT NULL,
  "campaignId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "NotificationPublicationSource_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NotificationPublicationSource_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "NotificationCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "NotificationPublicationSource_sourceType_sourceId_key"
  ON "NotificationPublicationSource"("sourceType", "sourceId");
CREATE INDEX "NotificationPublicationSource_campaignId_idx"
  ON "NotificationPublicationSource"("campaignId");

REVOKE ALL PRIVILEGES ON TABLE "NotificationPublicationSource" FROM anon, authenticated;
ALTER TABLE "NotificationPublicationSource" ENABLE ROW LEVEL SECURITY;

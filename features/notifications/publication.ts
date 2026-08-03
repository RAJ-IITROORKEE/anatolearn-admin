import "server-only";

import { Prisma } from "@prisma/client";

type PublicationNotification = {
  actorId: string;
  publicationSources: { type: "CONTENT_LESSON" | "FLASHCARD" | "QUESTION"; id: string }[];
  title: string;
  message: string;
};

/** Creates an inbox-only campaign in the same transaction as its publication. */
export async function createPublicationNotification(
  tx: Prisma.TransactionClient,
  input: PublicationNotification,
) {
  const sources = [...new Map(input.publicationSources.map((source) => [`${source.type}:${source.id}`, source])).values()];
  if (!sources.length) return;
  const existing = await tx.notificationPublicationSource.findMany({
    where: { OR: sources.map((source) => ({ sourceType: source.type, sourceId: source.id })) },
    select: { sourceType: true, sourceId: true },
  });
  const existingSources = new Set(existing.map((source) => `${source.sourceType}:${source.sourceId}`));
  const newSources = sources.filter((source) => !existingSources.has(`${source.type}:${source.id}`));
  if (!newSources.length) return;
  const now = new Date();
  const campaign = await tx.notificationCampaign.create({
    data: {
      type: "ANNOUNCEMENT",
      deliveryMode: "IN_APP",
      title: input.title,
      message: input.message,
      targetFilter: { type: "ALL_ACTIVE_USERS" },
      status: "SENT",
      sentAt: now,
      materializedAt: now,
      createdById: input.actorId,
    },
    select: { id: true },
  });
  await tx.notificationPublicationSource.createMany({
    data: newSources.map((source) => ({ campaignId: campaign.id, sourceType: source.type, sourceId: source.id })),
    skipDuplicates: true,
  });
  // Keep recipient materialization in the publishing transaction without loading every learner into Node.
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO "NotificationRecipient" ("campaignId", "userId")
    SELECT ${campaign.id}::uuid, "id"
    FROM "Profile"
    WHERE "role" = 'USER'::"UserRole" AND "isActive" = true
    ON CONFLICT ("campaignId", "userId") DO NOTHING
  `);
}

import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { audienceSchema } from "./schemas";
import { finalCampaignStatus } from "./domain";
import { ExpoPushProvider, ProviderTransientError } from "./provider";

const MAX_SEND_ATTEMPTS = 5;
const MAX_RECEIPT_POLLS = 20;
const RECEIPT_MAX_AGE_MS = 23 * 60 * 60 * 1000;
const PROVIDER_LEASE_MS = 60_000;
const RETRY_MS = [30_000, 60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];

export class StaleNotificationWorkerError extends Error {
  constructor() {
    super("Notification processing lease is no longer owned.");
    this.name = "StaleNotificationWorkerError";
  }
}

function assertOwned(count: number) {
  if (count === 0) throw new StaleNotificationWorkerError();
}

export async function renewCampaignLease(campaignId: string, processingToken: string, leaseUntil: Date) {
  const result = await prisma.notificationCampaign.updateMany({
    where: { id: campaignId, processingToken, status: "PROCESSING" },
    data: { processingLeaseUntil: leaseUntil },
  });
  assertOwned(result.count);
}

export async function completeDeliveryClaim(
  deliveryId: string,
  processingToken: string,
  data: Prisma.NotificationDeliveryUpdateManyMutationInput,
) {
  const result = await prisma.notificationDelivery.updateMany({
    where: { id: deliveryId, processingToken },
    data: { ...data, processingToken: null, processingLeaseUntil: null },
  });
  assertOwned(result.count);
}

export function receiptPollDecision(
  delivery: { ticketedAt: Date; receiptAttemptCount: number },
  outcome: "MISSING" | "TRANSIENT",
  now: Date,
) {
  const receiptAttemptCount = delivery.receiptAttemptCount + 1;
  const unavailable = receiptAttemptCount >= MAX_RECEIPT_POLLS
    || now.getTime() - delivery.ticketedAt.getTime() >= RECEIPT_MAX_AGE_MS;
  if (unavailable) return {
    status: "FAILED" as const,
    receiptAttemptCount,
    receiptCheckedAt: now,
    failedAt: now,
    providerErrorCode: "RECEIPT_UNAVAILABLE",
  };
  void outcome;
  return {
    status: "TICKETED" as const,
    receiptAttemptCount,
    receiptCheckedAt: now,
    providerErrorCode: "RECEIPT_PENDING",
  };
}

async function claimCampaign() {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "NotificationCampaign"
      WHERE "nextProcessAt" <= clock_timestamp()
        AND (
          "status" = 'SCHEDULED'
          OR ("status" = 'PROCESSING' AND "processingLeaseUntil" <= clock_timestamp())
          OR "status" = 'FAILED'
        )
      ORDER BY "nextProcessAt", "id"
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `);
    if (!rows[0]) return null;
    const processingToken = crypto.randomUUID();
    const count = await tx.$executeRaw(Prisma.sql`
      UPDATE "NotificationCampaign"
      SET "status" = 'PROCESSING',
          "processingStartedAt" = COALESCE("processingStartedAt", clock_timestamp()),
          "processingLeaseUntil" = clock_timestamp() + interval '60 seconds',
          "processingToken" = ${processingToken}::uuid,
          "nextProcessAt" = clock_timestamp(),
          "updatedAt" = clock_timestamp()
      WHERE "id" = ${rows[0].id}::uuid
    `);
    assertOwned(count);
    return tx.notificationCampaign.findFirst({ where: { id: rows[0].id, processingToken } });
  });
}

type ClaimedCampaign = NonNullable<Awaited<ReturnType<typeof claimCampaign>>> & { processingToken: string };

function ownedCampaign(campaign: NonNullable<Awaited<ReturnType<typeof claimCampaign>>>): ClaimedCampaign {
  if (!campaign.processingToken) throw new StaleNotificationWorkerError();
  return campaign as ClaimedCampaign;
}

export async function materializeCampaign(campaign: Pick<ClaimedCampaign, "id" | "processingToken" | "targetFilter">) {
  return prisma.$transaction(async (tx) => {
    const owned = await tx.$queryRaw<Array<{ id: string; materializedAt: Date | null }>>(Prisma.sql`
      SELECT "id", "materializedAt" FROM "NotificationCampaign"
      WHERE "id" = ${campaign.id}::uuid
        AND "processingToken" = ${campaign.processingToken}::uuid
        AND "status" = 'PROCESSING'
      FOR UPDATE
    `);
    if (!owned.length) throw new StaleNotificationWorkerError();
    if (owned[0].materializedAt) {
      const renewed = await tx.notificationCampaign.updateMany({
        where: { id: campaign.id, processingToken: campaign.processingToken, status: "PROCESSING" },
        data: { processingLeaseUntil: new Date(Date.now() + PROVIDER_LEASE_MS) },
      });
      assertOwned(renewed.count);
      return false;
    }

    const target = audienceSchema.parse(campaign.targetFilter);
    const users = target.type === "SELECTED_USERS"
      ? await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          SELECT "id" FROM "Profile"
          WHERE "role" = 'USER' AND "isActive" = true
            AND "id" IN (${Prisma.join(target.userIds.map((id) => Prisma.sql`${id}::uuid`))})
          ORDER BY "id" FOR SHARE
        `)
      : await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          SELECT "id" FROM "Profile"
          WHERE "role" = 'USER' AND "isActive" = true
          ORDER BY "id" FOR SHARE
        `);

    if (users.length) await tx.notificationRecipient.createMany({
      data: users.map((user) => ({ campaignId: campaign.id, userId: user.id })),
      skipDuplicates: true,
    });
    const recipients = await tx.notificationRecipient.findMany({
      where: { campaignId: campaign.id, userId: { in: users.map((user) => user.id) } },
      select: { id: true, userId: true },
    });
    if (recipients.length) {
      const byUser = new Map(recipients.map((recipient) => [recipient.userId, recipient.id]));
      const tokens = await tx.$queryRaw<Array<{ id: string; userId: string; expoPushToken: string; platform: "IOS" | "ANDROID" }>>(Prisma.sql`
        SELECT "id", "userId", "expoPushToken", "platform"
        FROM "DeviceToken"
        WHERE "isActive" = true
          AND "userId" IN (${Prisma.join(users.map((user) => Prisma.sql`${user.id}::uuid`))})
        ORDER BY "id" FOR SHARE
      `);
      if (tokens.length) await tx.notificationDelivery.createMany({
        data: tokens.map((token) => ({
          recipientId: byUser.get(token.userId)!,
          deviceTokenId: token.id,
          tokenSnapshot: token.expoPushToken,
          platformSnapshot: token.platform,
        })),
        skipDuplicates: true,
      });
    }
    const renewed = await tx.notificationCampaign.updateMany({
      where: {
        id: campaign.id,
        processingToken: campaign.processingToken,
        status: "PROCESSING",
        materializedAt: null,
      },
      data: {
        materializedAt: new Date(),
        processingLeaseUntil: new Date(Date.now() + PROVIDER_LEASE_MS),
      },
    });
    assertOwned(renewed.count);
    return true;
  });
}

type DeliveryClaim = { rows: Awaited<ReturnType<typeof prisma.notificationDelivery.findMany>>; processingToken: string };

export async function claimDeliveries(campaign: Pick<ClaimedCampaign, "id">, status: "PENDING" | "TICKETED", limit: number): Promise<DeliveryClaim> {
  return prisma.$transaction(async (tx) => {
    const due = new Date(Date.now() - 15_000);
    const rows = await tx.$queryRaw<Array<{ id: string }>>(status === "PENDING" ? Prisma.sql`
      SELECT d."id" FROM "NotificationDelivery" d
      JOIN "NotificationRecipient" r ON r."id" = d."recipientId"
      WHERE r."campaignId" = ${campaign.id}::uuid AND d."status" = 'PENDING'
        AND (d."nextAttemptAt" IS NULL OR d."nextAttemptAt" <= clock_timestamp())
        AND (d."processingToken" IS NULL OR d."processingLeaseUntil" <= clock_timestamp())
      ORDER BY d."id" FOR UPDATE OF d SKIP LOCKED LIMIT ${Math.min(100, limit)}
    ` : Prisma.sql`
      SELECT d."id" FROM "NotificationDelivery" d
      JOIN "NotificationRecipient" r ON r."id" = d."recipientId"
      WHERE r."campaignId" = ${campaign.id}::uuid AND d."status" = 'TICKETED'
        AND d."ticketedAt" <= ${due}
        AND (d."receiptCheckedAt" IS NULL OR d."receiptCheckedAt" <= ${due})
        AND (d."processingToken" IS NULL OR d."processingLeaseUntil" <= clock_timestamp())
      ORDER BY d."id" FOR UPDATE OF d SKIP LOCKED LIMIT ${Math.min(100, limit)}
    `);
    const processingToken = crypto.randomUUID();
    if (!rows.length) return { rows: [], processingToken };
    const ids = rows.map((row) => row.id);
    const claimed = await tx.notificationDelivery.updateMany({
      where: { id: { in: ids }, status },
      data: { processingToken, processingLeaseUntil: new Date(Date.now() + PROVIDER_LEASE_MS) },
    });
    if (claimed.count !== ids.length) throw new StaleNotificationWorkerError();
    return {
      rows: await tx.notificationDelivery.findMany({ where: { id: { in: ids }, processingToken }, orderBy: { id: "asc" } }),
      processingToken,
    };
  });
}

async function sendPending(campaign: ClaimedCampaign, provider: ExpoPushProvider, limit: number) {
  await renewCampaignLease(campaign.id, campaign.processingToken, new Date(Date.now() + PROVIDER_LEASE_MS));
  const claim = await claimDeliveries(campaign, "PENDING", limit);
  if (!claim.rows.length) return 0;
  await renewCampaignLease(campaign.id, campaign.processingToken, new Date(Date.now() + PROVIDER_LEASE_MS));
  const now = new Date();
  try {
    // A process crash after provider acceptance but before persistence is inherently at-least-once.
    const results = await provider.send(claim.rows.map((row) => ({ to: row.tokenSnapshot, title: campaign.title, body: campaign.message })));
    await renewCampaignLease(campaign.id, campaign.processingToken, new Date(Date.now() + PROVIDER_LEASE_MS));
    for (const [index, result] of results.entries()) {
      const row = claim.rows[index];
      if (!row) continue;
      const attemptCount = row.attemptCount + 1;
      if (result.status === "TICKETED") {
        await completeDeliveryClaim(row.id, claim.processingToken, {
          status: "TICKETED", attemptCount, lastAttemptAt: now, nextAttemptAt: null,
          ticketedAt: now, providerReceiptId: result.receiptId,
          providerErrorCode: null, providerErrorMessage: null,
        });
      } else {
        await completeDeliveryClaim(row.id, claim.processingToken, {
          status: "FAILED", attemptCount, lastAttemptAt: now, nextAttemptAt: null,
          failedAt: now, providerErrorCode: result.code, providerErrorMessage: result.message.slice(0, 1000),
        });
        if (result.code === "DeviceNotRegistered") await prisma.deviceToken.updateMany({ where: { id: row.deviceTokenId }, data: { isActive: false } });
      }
    }
  } catch (error) {
    if (!(error instanceof ProviderTransientError)) throw error;
    await renewCampaignLease(campaign.id, campaign.processingToken, new Date(Date.now() + PROVIDER_LEASE_MS));
    for (const row of claim.rows) {
      const attemptCount = row.attemptCount + 1;
      const terminal = attemptCount >= MAX_SEND_ATTEMPTS;
      await completeDeliveryClaim(row.id, claim.processingToken, {
        status: terminal ? "FAILED" : "PENDING",
        attemptCount,
        lastAttemptAt: now,
        nextAttemptAt: terminal ? null : new Date(now.getTime() + RETRY_MS[Math.min(attemptCount - 1, RETRY_MS.length - 1)]),
        ...(terminal && { failedAt: now }),
        providerErrorCode: "PROVIDER_TRANSIENT",
        providerErrorMessage: error.message,
      });
    }
  }
  return claim.rows.length;
}

async function pollReceipts(campaign: ClaimedCampaign, provider: ExpoPushProvider, limit: number) {
  await renewCampaignLease(campaign.id, campaign.processingToken, new Date(Date.now() + PROVIDER_LEASE_MS));
  const claim = await claimDeliveries(campaign, "TICKETED", limit);
  if (!claim.rows.length) return 0;
  await renewCampaignLease(campaign.id, campaign.processingToken, new Date(Date.now() + PROVIDER_LEASE_MS));
  const ids = claim.rows.map((row) => row.providerReceiptId).filter((id): id is string => Boolean(id));
  let receipts: Awaited<ReturnType<ExpoPushProvider["receipts"]>> | null = null;
  let transient: ProviderTransientError | null = null;
  try { receipts = await provider.receipts(ids); }
  catch (error) { if (error instanceof ProviderTransientError) transient = error; else throw error; }
  await renewCampaignLease(campaign.id, campaign.processingToken, new Date(Date.now() + PROVIDER_LEASE_MS));
  const now = new Date();
  for (const row of claim.rows) {
    const result = !transient && row.providerReceiptId ? receipts?.[row.providerReceiptId] : undefined;
    if (!result) {
      const data = receiptPollDecision({ ticketedAt: row.ticketedAt!, receiptAttemptCount: row.receiptAttemptCount }, transient ? "TRANSIENT" : "MISSING", now);
      await completeDeliveryClaim(row.id, claim.processingToken, { ...data, providerErrorMessage: transient?.message ?? "Receipt is not available yet." });
    } else if (result.status === "SENT") {
      await completeDeliveryClaim(row.id, claim.processingToken, {
        status: "SENT", receiptAttemptCount: row.receiptAttemptCount + 1,
        receiptCheckedAt: now, sentAt: now, providerErrorCode: null, providerErrorMessage: null,
      });
    } else {
      await completeDeliveryClaim(row.id, claim.processingToken, {
        status: "FAILED", receiptAttemptCount: row.receiptAttemptCount + 1,
        receiptCheckedAt: now, failedAt: now,
        providerErrorCode: result.code, providerErrorMessage: result.message.slice(0, 1000),
      });
      if (result.code === "DeviceNotRegistered") await prisma.deviceToken.updateMany({ where: { id: row.deviceTokenId }, data: { isActive: false } });
    }
  }
  return claim.rows.length;
}

async function finalizeOrRelease(campaign: ClaimedCampaign) {
  await renewCampaignLease(campaign.id, campaign.processingToken, new Date(Date.now() + PROVIDER_LEASE_MS));
  const recipients = await prisma.notificationRecipient.findMany({
    where: { campaignId: campaign.id },
    select: { deliveries: { select: { status: true } } },
  });
  const active = recipients.some((recipient) => recipient.deliveries.some((delivery) => delivery.status === "PENDING" || delivery.status === "TICKETED"));
  if (active) {
    const next = new Date(Date.now() + 30_000);
    const result = await prisma.notificationCampaign.updateMany({
      where: { id: campaign.id, processingToken: campaign.processingToken, status: "PROCESSING" },
      data: { nextProcessAt: next, processingLeaseUntil: next },
    });
    assertOwned(result.count);
    return null;
  }
  const status = finalCampaignStatus(recipients.map((recipient) => ({ statuses: recipient.deliveries.map((delivery) => delivery.status) })));
  const now = new Date();
  const result = await prisma.notificationCampaign.updateMany({
    where: { id: campaign.id, processingToken: campaign.processingToken, status: "PROCESSING" },
    data: {
      status,
      sentAt: status === "SENT" || status === "PARTIAL" ? now : null,
      failureCode: status === "FAILED" ? "NO_CONFIRMED_DELIVERIES" : null,
      failureMessage: status === "FAILED" ? "No recipient had a receipt-confirmed delivery." : null,
      nextProcessAt: null,
      processingLeaseUntil: null,
      processingToken: null,
    },
  });
  assertOwned(result.count);
  return status;
}

export async function processNotifications(provider: ExpoPushProvider, options: { maxCampaigns?: number; maxDeliveries?: number; maxRuntimeMs?: number } = {}) {
  const maxCampaigns = Math.min(options.maxCampaigns ?? 5, 5);
  const maxDeliveries = Math.min(options.maxDeliveries ?? 500, 500);
  const maxRuntimeMs = Math.min(options.maxRuntimeMs ?? 8_000, 8_000);
  const started = Date.now();
  let campaigns = 0, deliveries = 0, finalized = 0;
  while (campaigns < maxCampaigns && deliveries < maxDeliveries && Date.now() - started < maxRuntimeMs) {
    const row = await claimCampaign();
    if (!row) break;
    campaigns += 1;
    const campaign = ownedCampaign(row);
    try {
      await materializeCampaign(campaign);
      deliveries += await sendPending(campaign, provider, maxDeliveries - deliveries);
      if (deliveries < maxDeliveries) deliveries += await pollReceipts(campaign, provider, maxDeliveries - deliveries);
      if (await finalizeOrRelease(campaign)) finalized += 1;
    } catch (error) {
      if (!(error instanceof StaleNotificationWorkerError)) throw error;
    }
  }
  return { campaigns, deliveries, finalized };
}

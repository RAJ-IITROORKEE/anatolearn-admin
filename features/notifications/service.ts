import "server-only";

import { Prisma, type AuditAction, type NotificationStatus, type NotificationType } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { campaignAuditSnapshot, NotificationError } from "./domain";
import { campaignDto, deliveryDto, learnerNotificationDto } from "./dto";
import type { Audience } from "./schemas";

type Context = { actorId: string; requestId: string; userAgent?: string | null };
type CampaignInput = { type: NotificationType; title: string; message: string; target: Audience };
export type CampaignIntent =
  | { type: "DRAFT" }
  | { type: "SCHEDULE"; scheduledAt: Date }
  | { type: "SEND"; providerReady: boolean };
const asJson = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

async function audit(tx: Prisma.TransactionClient, context: Context, action: AuditAction, campaign: {
  id: string; status: NotificationStatus; type: NotificationType; targetFilter: unknown;
}, before?: { status: NotificationStatus; type: NotificationType; targetFilter: unknown }) {
  const recipientCount = await tx.notificationRecipient.count({ where: { campaignId: campaign.id } });
  await tx.auditLog.create({ data: {
    actorId: context.actorId,
    action,
    entityType: "NotificationCampaign",
    entityId: campaign.id,
    beforeSnapshot: before ? asJson(campaignAuditSnapshot({ ...before, recipientCount })) : Prisma.JsonNull,
    afterSnapshot: asJson(campaignAuditSnapshot({ ...campaign, recipientCount })),
    requestId: context.requestId,
    userAgent: context.userAgent,
  } });
}

async function validateAudience(tx: Prisma.TransactionClient, target: Audience) {
  if (target.type === "ALL_ACTIVE_USERS") return;
  const count = await tx.profile.count({ where: { id: { in: target.userIds }, role: "USER", isActive: true } });
  if (count !== target.userIds.length) throw new NotificationError("INVALID_AUDIENCE", "Every selected learner must be active and accessible.", 422);
}

async function lockCampaign(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "NotificationCampaign" WHERE "id" = ${id}::uuid FOR UPDATE`);
  return tx.notificationCampaign.findUnique({ where: { id } });
}

async function databaseNow(tx: Prisma.TransactionClient) {
  const [clock] = await tx.$queryRaw<Array<{ now: Date }>>(Prisma.sql`SELECT clock_timestamp() AS "now"`);
  if (!clock) throw new NotificationError("DATABASE_CLOCK_UNAVAILABLE", "Database time could not be determined.", 500);
  return clock.now;
}

async function validateIntent(tx: Prisma.TransactionClient, intent: CampaignIntent) {
  if (intent.type === "SCHEDULE") {
    const now = await databaseNow(tx);
    if (intent.scheduledAt.getTime() < now.getTime() + 60_000) {
      throw new NotificationError("SCHEDULE_TOO_SOON", "Schedule time must be at least 60 seconds in the future.", 422);
    }
    return now;
  }
  if (intent.type === "SEND") return databaseNow(tx);
  return null;
}

async function applyIntent(tx: Prisma.TransactionClient, before: Awaited<ReturnType<typeof lockCampaign>> extends infer T ? NonNullable<T> : never, intent: CampaignIntent, context: Context, now: Date | null) {
  if (intent.type === "DRAFT") return before;
  if (intent.type === "SCHEDULE") {
    const after = await tx.notificationCampaign.update({ where: { id: before.id }, data: { status: "SCHEDULED", scheduledAt: intent.scheduledAt, nextProcessAt: intent.scheduledAt } });
    await audit(tx, context, "SCHEDULE", after, before);
    return after;
  }
  const processingStartedAt = now ?? await databaseNow(tx);
  const after = await tx.notificationCampaign.update({ where: { id: before.id }, data: {
    status: "PROCESSING", processingStartedAt, processingLeaseUntil: new Date(processingStartedAt.getTime() + 30_000),
    processingToken: crypto.randomUUID(), nextProcessAt: processingStartedAt,
  } });
  await audit(tx, context, "SEND", after, before);
  return after;
}

function requireProvider(intent: CampaignIntent) {
  if (intent.type === "SEND" && !intent.providerReady) {
    throw new NotificationError("PROVIDER_UNAVAILABLE", "Push notification delivery is not configured.", 503);
  }
}

export async function createCampaignWithIntent(input: CampaignInput, intent: CampaignIntent, context: Context) {
  requireProvider(intent);
  return prisma.$transaction(async (tx) => {
    const now = await validateIntent(tx, intent);
    await validateAudience(tx, input.target);
    const draft = await tx.notificationCampaign.create({ data: {
      type: input.type, title: input.title, message: input.message,
      targetFilter: asJson(input.target), createdById: context.actorId,
    } });
    await audit(tx, context, "CREATE", draft);
    return campaignDto(await applyIntent(tx, draft, intent, context, now));
  });
}

export async function updateCampaignWithIntent(id: string, input: CampaignInput, intent: CampaignIntent, context: Context) {
  requireProvider(intent);
  return prisma.$transaction(async (tx) => {
    const before = await lockCampaign(tx, id);
    if (!before) throw new NotificationError("NOT_FOUND", "Notification campaign was not found.", 404);
    if (before.status !== "DRAFT") throw new NotificationError("INVALID_STATUS", "Only draft campaigns can be updated.", 409);
    const now = await validateIntent(tx, intent);
    await validateAudience(tx, input.target);
    const draft = await tx.notificationCampaign.update({ where: { id }, data: {
      type: input.type, title: input.title, message: input.message, targetFilter: asJson(input.target),
    } });
    await audit(tx, context, "UPDATE", draft, before);
    return campaignDto(await applyIntent(tx, draft, intent, context, now));
  });
}

export async function createCampaign(input: CampaignInput, context: Context) {
  return prisma.$transaction(async (tx) => {
    await validateAudience(tx, input.target);
    const row = await tx.notificationCampaign.create({ data: {
      type: input.type, title: input.title, message: input.message,
      targetFilter: asJson(input.target), createdById: context.actorId,
    } });
    await audit(tx, context, "CREATE", row);
    return campaignDto(row);
  });
}

export async function updateCampaign(id: string, input: Partial<CampaignInput>, context: Context) {
  return prisma.$transaction(async (tx) => {
    const before = await lockCampaign(tx, id);
    if (!before) throw new NotificationError("NOT_FOUND", "Notification campaign was not found.", 404);
    if (before.status !== "DRAFT") throw new NotificationError("INVALID_STATUS", "Only draft campaigns can be updated.", 409);
    if (input.target) await validateAudience(tx, input.target);
    const after = await tx.notificationCampaign.update({ where: { id }, data: {
      type: input.type, title: input.title, message: input.message,
      ...(input.target && { targetFilter: asJson(input.target) }),
    } });
    await audit(tx, context, "UPDATE", after, before);
    return campaignDto(after);
  });
}

export async function listCampaigns(input: { page: number; pageSize: number; status?: NotificationStatus }) {
  const where = { status: input.status };
  const [rows, total] = await prisma.$transaction([
    prisma.notificationCampaign.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (input.page - 1) * input.pageSize, take: input.pageSize }),
    prisma.notificationCampaign.count({ where }),
  ]);
  return { items: rows.map(campaignDto), pagination: { ...input, total, totalPages: Math.ceil(total / input.pageSize) } };
}

const campaignStatuses: NotificationStatus[] = ["DRAFT", "SCHEDULED", "PROCESSING", "SENT", "PARTIAL", "FAILED", "CANCELLED"];

export async function getCampaignStatusCounts() {
  const rows = await prisma.notificationCampaign.groupBy({ by: ["status"], _count: { _all: true } });
  const counts = Object.fromEntries(campaignStatuses.map((status) => [status, 0])) as Record<NotificationStatus, number>;
  for (const row of rows) counts[row.status] = row._count._all;
  return counts;
}

export type CampaignEvidence = {
  recipients: number; read: number; deliveries: number; pending: number; ticketed: number;
  receiptConfirmed: number; failed: number; cancelled: number;
};

const emptyEvidence = (): CampaignEvidence => ({ recipients: 0, read: 0, deliveries: 0, pending: 0, ticketed: 0, receiptConfirmed: 0, failed: 0, cancelled: 0 });

export async function getCampaignEvidence(campaignIds: string[]) {
  const uniqueIds = [...new Set(campaignIds)];
  const result = Object.fromEntries(uniqueIds.map((id) => [id, emptyEvidence()])) as Record<string, CampaignEvidence>;
  if (!uniqueIds.length) return result;
  const rows = await prisma.$queryRaw<Array<{
    campaignId: string; recipients: bigint | number; read: bigint | number; pending: bigint | number;
    ticketed: bigint | number; sent: bigint | number; failed: bigint | number; cancelled: bigint | number;
  }>>(Prisma.sql`
    SELECT c."id" AS "campaignId",
      COUNT(DISTINCT r."id") AS "recipients",
      COUNT(DISTINCT r."id") FILTER (WHERE r."readAt" IS NOT NULL) AS "read",
      COUNT(d."id") FILTER (WHERE d."status" = 'PENDING') AS "pending",
      COUNT(d."id") FILTER (WHERE d."status" = 'TICKETED') AS "ticketed",
      COUNT(d."id") FILTER (WHERE d."status" = 'SENT') AS "sent",
      COUNT(d."id") FILTER (WHERE d."status" = 'FAILED') AS "failed",
      COUNT(d."id") FILTER (WHERE d."status" = 'CANCELLED') AS "cancelled"
    FROM "NotificationCampaign" c
    LEFT JOIN "NotificationRecipient" r ON r."campaignId" = c."id"
    LEFT JOIN "NotificationDelivery" d ON d."recipientId" = r."id"
    WHERE c."id" IN (${Prisma.join(uniqueIds.map((id) => Prisma.sql`${id}::uuid`))})
    GROUP BY c."id"
  `);
  for (const row of rows) {
    const pending = Number(row.pending), ticketed = Number(row.ticketed), sent = Number(row.sent), failed = Number(row.failed), cancelled = Number(row.cancelled);
    result[row.campaignId] = {
      recipients: Number(row.recipients), read: Number(row.read), pending, ticketed,
      receiptConfirmed: sent, failed, cancelled, deliveries: pending + ticketed + sent + failed + cancelled,
    };
  }
  return result;
}

export async function getCampaign(id: string) {
  const row = await prisma.notificationCampaign.findUnique({ where: { id } });
  if (!row) throw new NotificationError("NOT_FOUND", "Notification campaign was not found.", 404);
  return campaignDto(row);
}

export async function scheduleCampaign(id: string, scheduledAt: Date, context: Context) {
  return prisma.$transaction(async (tx) => {
    const [clock] = await tx.$queryRaw<Array<{ now: Date }>>(Prisma.sql`SELECT clock_timestamp() AS "now"`);
    if (!clock || scheduledAt.getTime() < clock.now.getTime() + 60_000) throw new NotificationError("SCHEDULE_TOO_SOON", "Schedule time must be at least 60 seconds in the future.", 422);
    const before = await lockCampaign(tx, id);
    if (!before) throw new NotificationError("NOT_FOUND", "Notification campaign was not found.", 404);
    if (before.status !== "DRAFT") throw new NotificationError("INVALID_STATUS", "Only draft campaigns can be scheduled.", 409);
    const after = await tx.notificationCampaign.update({ where: { id }, data: { status: "SCHEDULED", scheduledAt, nextProcessAt: scheduledAt } });
    await audit(tx, context, "SCHEDULE", after, before);
    return campaignDto(after);
  });
}

export async function cancelCampaign(id: string, context: Context) {
  return prisma.$transaction(async (tx) => {
    const before = await lockCampaign(tx, id);
    if (!before) throw new NotificationError("NOT_FOUND", "Notification campaign was not found.", 404);
    if (before.status === "CANCELLED") return campaignDto(before);
    if (before.status !== "DRAFT" && before.status !== "SCHEDULED") throw new NotificationError("INVALID_STATUS", "Only draft or scheduled campaigns can be cancelled.", 409);
    const [clock] = await tx.$queryRaw<Array<{ now: Date }>>(Prisma.sql`SELECT clock_timestamp() AS "now"`);
    const after = await tx.notificationCampaign.update({ where: { id }, data: {
      status: "CANCELLED", cancelledById: context.actorId, cancelledAt: clock?.now ?? new Date(), scheduledAt: before.scheduledAt, nextProcessAt: null,
    } });
    await tx.notificationDelivery.updateMany({ where: { recipient: { campaignId: id }, status: "PENDING" }, data: { status: "CANCELLED", nextAttemptAt: null } });
    await audit(tx, context, "CANCEL", after, before);
    return campaignDto(after);
  });
}

export async function sendCampaign(id: string, context: Context, providerReady: boolean) {
  if (!providerReady) throw new NotificationError("PROVIDER_UNAVAILABLE", "Push notification delivery is not configured.", 503);
  return prisma.$transaction(async (tx) => {
    const before = await lockCampaign(tx, id);
    if (!before) throw new NotificationError("NOT_FOUND", "Notification campaign was not found.", 404);
    if (before.status !== "DRAFT") throw new NotificationError("INVALID_STATUS", "Only draft campaigns can be sent.", 409);
    const [clock] = await tx.$queryRaw<Array<{ now: Date }>>(Prisma.sql`SELECT clock_timestamp() AS "now"`);
    const now = clock?.now ?? new Date();
    const after = await tx.notificationCampaign.update({ where: { id }, data: {
      status: "PROCESSING", processingStartedAt: now, processingLeaseUntil: new Date(now.getTime() + 30_000),
      processingToken: crypto.randomUUID(), nextProcessAt: now,
    } });
    await audit(tx, context, "SEND", after, before);
    return campaignDto(after);
  });
}

export async function listRecipients(campaignId: string, input: { page: number; pageSize: number }) {
  await getCampaign(campaignId);
  const [rows, total] = await prisma.$transaction([
    prisma.notificationRecipient.findMany({ where: { campaignId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (input.page - 1) * input.pageSize, take: input.pageSize, select: { id: true, userId: true, readAt: true, createdAt: true, _count: { select: { deliveries: true } } } }),
    prisma.notificationRecipient.count({ where: { campaignId } }),
  ]);
  return { items: rows, pagination: { ...input, total, totalPages: Math.ceil(total / input.pageSize) } };
}

export async function listDeliveries(campaignId: string, input: { page: number; pageSize: number }) {
  await getCampaign(campaignId);
  const where = { recipient: { campaignId } };
  const [rows, total] = await prisma.$transaction([
    prisma.notificationDelivery.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (input.page - 1) * input.pageSize, take: input.pageSize }),
    prisma.notificationDelivery.count({ where }),
  ]);
  return { items: rows.map(deliveryDto), pagination: { ...input, total, totalPages: Math.ceil(total / input.pageSize) } };
}

export async function listLearnerNotifications(userId: string, input: { page: number; pageSize: number }) {
  const where = { userId, campaign: { status: { in: ["SENT", "PARTIAL"] as NotificationStatus[] } } };
  const [rows, total] = await prisma.$transaction([
    prisma.notificationRecipient.findMany({ where, include: { campaign: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (input.page - 1) * input.pageSize, take: input.pageSize }),
    prisma.notificationRecipient.count({ where }),
  ]);
  return { items: rows.map(learnerNotificationDto), pagination: { ...input, total, totalPages: Math.ceil(total / input.pageSize) } };
}

export async function markNotificationRead(userId: string, recipientId: string) {
  return prisma.$transaction(async (tx) => {
    const row = await tx.notificationRecipient.findFirst({ where: { id: recipientId, userId, campaign: { status: { in: ["SENT", "PARTIAL"] } } }, include: { campaign: true } });
    if (!row) throw new NotificationError("NOT_FOUND", "Notification was not found.", 404);
    if (row.readAt) return learnerNotificationDto(row);
    await tx.notificationRecipient.updateMany({ where: { id: row.id, readAt: null }, data: { readAt: new Date() } });
    const updated = await tx.notificationRecipient.findUnique({ where: { id: row.id }, include: { campaign: true } });
    if (!updated) throw new NotificationError("NOT_FOUND", "Notification was not found.", 404);
    return learnerNotificationDto(updated);
  });
}

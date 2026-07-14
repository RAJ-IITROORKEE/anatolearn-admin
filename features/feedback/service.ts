import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { adminFeedbackDto, learnerFeedbackDto } from "./dto";
import { FeedbackError, planFeedbackUpdate } from "./domain";
import type { AdminFeedbackListInput, AdminFeedbackUpdateInput, CreateFeedbackInput, MineFeedbackListInput } from "./schemas";

const personSelect = { id: true, fullName: true, email: true, isActive: true } as const;
const adminInclude = {
  user: { select: personSelect }, reviewedBy: { select: personSelect }, resolvedBy: { select: personSelect },
} as const;
export type FeedbackMutationContext = { actorId: string; requestId: string; userAgent?: string };

export async function createFeedback(userId: string, input: CreateFeedbackInput) {
  return learnerFeedbackDto(await prisma.feedback.create({ data: { userId, ...input } }));
}

export async function listMyFeedback(userId: string, input: MineFeedbackListInput) {
  const where: Prisma.FeedbackWhereInput = { userId, type: input.type, status: input.status };
  const [items, total] = await prisma.$transaction([
    prisma.feedback.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (input.page - 1) * input.pageSize, take: input.pageSize }),
    prisma.feedback.count({ where }),
  ]);
  return { items: items.map(learnerFeedbackDto), pagination: { page: input.page, pageSize: input.pageSize, total, totalPages: Math.ceil(total / input.pageSize) } };
}

export async function listAdminFeedback(input: AdminFeedbackListInput) {
  const where: Prisma.FeedbackWhereInput = {
    type: input.type, status: input.status, userId: input.userId,
    ...(input.createdFrom || input.createdTo ? { createdAt: { gte: input.createdFrom, lte: input.createdTo } } : {}),
    ...(input.q ? { OR: [
      { subject: { contains: input.q, mode: "insensitive" } },
      { message: { contains: input.q, mode: "insensitive" } },
      { user: { is: { OR: [
        { fullName: { contains: input.q, mode: "insensitive" } },
        { email: { contains: input.q, mode: "insensitive" } },
      ] } } },
    ] } : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.feedback.findMany({ where, include: adminInclude, orderBy: [{ [input.sortBy]: input.sortOrder }, { id: input.sortOrder }], skip: (input.page - 1) * input.pageSize, take: input.pageSize }),
    prisma.feedback.count({ where }),
  ]);
  return { items: items.map(adminFeedbackDto), pagination: { page: input.page, pageSize: input.pageSize, total, totalPages: Math.ceil(total / input.pageSize) } };
}

export async function getAdminFeedback(id: string) {
  const value = await prisma.feedback.findUnique({ where: { id }, include: adminInclude });
  if (!value) throw new FeedbackError("NOT_FOUND", "Feedback was not found.", 404);
  return adminFeedbackDto(value);
}

export async function updateFeedback(id: string, input: AdminFeedbackUpdateInput, context: FeedbackMutationContext) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Feedback" WHERE "id" = ${id}::uuid FOR UPDATE`);
    const before = await tx.feedback.findUnique({ where: { id }, include: adminInclude });
    if (!before) throw new FeedbackError("NOT_FOUND", "Feedback was not found.", 404);
    const now = new Date();
    const plan = planFeedbackUpdate(before, input, context.actorId, now);
    if (!plan.changed) return adminFeedbackDto(before);
    const updated = await tx.feedback.update({ where: { id }, data: plan.data, include: adminInclude });
    const beforeSnapshot = { status: before.status, reviewedAt: before.reviewedAt?.toISOString() ?? null, resolvedAt: before.resolvedAt?.toISOString() ?? null, adminNotesChanged: false };
    const afterSnapshot = { status: updated.status, reviewedAt: updated.reviewedAt?.toISOString() ?? null, resolvedAt: updated.resolvedAt?.toISOString() ?? null, adminNotesChanged: input.adminNotes !== undefined && input.adminNotes !== before.adminNotes };
    await tx.auditLog.create({ data: {
      actorId: context.actorId, action: plan.action, entityType: "Feedback", entityId: id,
      beforeSnapshot, afterSnapshot, requestId: context.requestId, userAgent: context.userAgent,
    } });
    return adminFeedbackDto(updated);
  });
}

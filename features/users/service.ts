import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { adminUserDetailDto, adminUserListItemDto } from "./dto";
import { UserManagementError } from "./domain";
import type { AdminUserListInput } from "./schemas";

const profileSelect = {
  id: true, fullName: true, email: true, avatarUrl: true, isActive: true,
  lastLoginAt: true, createdAt: true, updatedAt: true,
} as const;

export type UserMutationContext = { actorId: string; requestId: string; userAgent?: string };
export type LearnerPickerOption = { id: string; fullName: string; email: string };

const learnerPickerSelect = { id: true, fullName: true, email: true } as const;

export async function searchActiveLearnerOptions({ page = 1, q }: { page?: number; q?: string }) {
  const safePage = Math.max(1, Math.floor(page));
  const search = q?.trim().slice(0, 200);
  const where: Prisma.ProfileWhereInput = {
    role: "USER", isActive: true,
    ...(search ? { OR: [
      { fullName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ] } : {}),
  };
  const pageSize = 20;
  const [items, total] = await prisma.$transaction([
    prisma.profile.findMany({ where, select: learnerPickerSelect, orderBy: [{ fullName: "asc" }, { id: "asc" }], skip: (safePage - 1) * pageSize, take: pageSize }),
    prisma.profile.count({ where }),
  ]);
  return { items, pagination: { page: safePage, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

export async function getLearnerPickerOptions(ids: string[]): Promise<LearnerPickerOption[]> {
  const uniqueIds = [...new Set(ids)].slice(0, 500);
  if (!uniqueIds.length) return [];
  return prisma.profile.findMany({
    where: { id: { in: uniqueIds }, role: "USER" }, select: learnerPickerSelect,
    orderBy: [{ fullName: "asc" }, { id: "asc" }], take: 500,
  });
}

export async function listLearners(input: AdminUserListInput) {
  const where: Prisma.ProfileWhereInput = {
    role: "USER",
    isActive: input.isActive,
    ...(input.q ? { OR: [
      { fullName: { contains: input.q, mode: "insensitive" } },
      { email: { contains: input.q, mode: "insensitive" } },
    ] } : {}),
    ...(input.createdFrom || input.createdTo ? { createdAt: { gte: input.createdFrom, lte: input.createdTo } } : {}),
  };
  const joinedSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [items, total, active, inactive, joined30Days] = await prisma.$transaction([
    prisma.profile.findMany({
      where, select: profileSelect,
      orderBy: [{ [input.sortBy]: input.sortOrder }, { id: input.sortOrder }],
      skip: (input.page - 1) * input.pageSize, take: input.pageSize,
    }),
    prisma.profile.count({ where }),
    prisma.profile.count({ where: { role: "USER", isActive: true } }),
    prisma.profile.count({ where: { role: "USER", isActive: false } }),
    prisma.profile.count({ where: { role: "USER", createdAt: { gte: joinedSince } } }),
  ]);
  return {
    items: items.map(adminUserListItemDto),
    summary: { total: active + inactive, active, inactive, joined30Days },
    pagination: { page: input.page, pageSize: input.pageSize, total, totalPages: Math.ceil(total / input.pageSize) },
  };
}

export async function getLearner(id: string) {
  const profile = await prisma.profile.findFirst({ where: { id, role: "USER" }, select: profileSelect });
  if (!profile) throw new UserManagementError("NOT_FOUND", "Learner was not found.", 404);
  const [attempts, submittedAttempts, feedback, latest] = await prisma.$transaction([
    prisma.assessmentAttempt.count({ where: { userId: id } }),
    prisma.assessmentAttempt.count({ where: { userId: id, status: { in: ["COMPLETED", "AUTO_SUBMITTED"] } } }),
    prisma.feedback.count({ where: { userId: id } }),
    prisma.assessmentAttempt.aggregate({ where: { userId: id }, _max: { startedAt: true } }),
  ]);
  return adminUserDetailDto(profile, { attempts, submittedAttempts, feedback, lastAttemptAt: latest._max.startedAt });
}

// UI-only aggregate; the public admin user DTO remains unchanged.
export async function getLearnerDeviceCounts(id: string) {
  const [total, active] = await prisma.$transaction([
    prisma.deviceToken.count({ where: { userId: id } }),
    prisma.deviceToken.count({ where: { userId: id, isActive: true } }),
  ]);
  return { total, active, inactive: total - active };
}

export async function setLearnerActivity(id: string, isActive: boolean, context: UserMutationContext) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Profile" WHERE "id" = ${id}::uuid FOR UPDATE`);
    const before = await tx.profile.findUnique({ where: { id }, select: { ...profileSelect, role: true } });
    if (!before || before.role !== "USER") throw new UserManagementError("NOT_FOUND", "Learner was not found.", 404);
    if (before.isActive === isActive) return adminUserListItemDto(before);

    const updated = await tx.profile.update({ where: { id }, data: { isActive }, select: profileSelect });
    if (!isActive) {
      await tx.deviceToken.updateMany({ where: { userId: id, isActive: true }, data: { isActive: false } });
      await tx.notificationDelivery.updateMany({
        where: { deviceToken: { userId: id }, status: "PENDING" },
        data: {
          status: "CANCELLED",
          nextAttemptAt: null,
          processingToken: null,
          processingLeaseUntil: null,
        },
      });
    }
    await tx.auditLog.create({ data: {
      actorId: context.actorId,
      action: isActive ? "ACTIVATE" : "DEACTIVATE",
      entityType: "Profile",
      entityId: id,
      beforeSnapshot: { isActive: before.isActive },
      afterSnapshot: { isActive },
      requestId: context.requestId,
      userAgent: context.userAgent,
    } });
    return adminUserListItemDto(updated);
  });
}

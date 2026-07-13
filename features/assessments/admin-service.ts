import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { adminAttemptDetailDto, adminAttemptListItemDto } from "./admin-dto";
import { AssessmentError } from "./domain";
import { expireDueAttempts, finalizeDueAttemptById } from "./finalization-service";
import type { AdminAttemptListInput } from "@/features/progress/schemas";

const userSelect = { id: true, fullName: true, email: true, isActive: true } as const;

export async function listAdminAttempts(input: AdminAttemptListInput) {
  await expireDueAttempts({ limit: 50 });
  const where: Prisma.AssessmentAttemptWhereInput = {
    userId: input.userId,
    assessmentType: input.assessmentType,
    organSystemId: input.organSystemId,
    status: input.status,
    ...(input.q ? { user: { OR: [
      { fullName: { contains: input.q, mode: "insensitive" } },
      { email: { contains: input.q, mode: "insensitive" } },
    ] } } : {}),
    ...(input.topicId ? { questions: { some: { topicIdSnapshot: input.topicId } } } : {}),
    ...(input.from || input.to ? { startedAt: { gte: input.from, lte: input.to } } : {}),
  };
  const orderBy: Prisma.AssessmentAttemptOrderByWithRelationInput[] = [
    { [input.sortBy]: input.sortOrder },
    { id: input.sortOrder },
  ];
  const [items, total] = await prisma.$transaction([
    prisma.assessmentAttempt.findMany({
      where,
      include: { user: { select: userSelect }, topics: { orderBy: { topicId: "asc" } } },
      orderBy,
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    prisma.assessmentAttempt.count({ where }),
  ]);
  return {
    items: items.map(adminAttemptListItemDto),
    pagination: { page: input.page, pageSize: input.pageSize, total, totalPages: Math.ceil(total / input.pageSize) },
  };
}

export async function getAdminAttempt(id: string) {
  await finalizeDueAttemptById(id);
  const attempt = await prisma.assessmentAttempt.findUnique({
    where: { id },
    include: {
      user: { select: userSelect },
      topics: { orderBy: { topicId: "asc" } },
      questions: { orderBy: { displayOrder: "asc" } },
    },
  });
  if (!attempt) throw new AssessmentError("NOT_FOUND", "Attempt was not found.", 404);
  return adminAttemptDetailDto(attempt);
}

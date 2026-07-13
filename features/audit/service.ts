import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { z } from "zod";
import type { auditLogListSchema } from "./schemas";

export async function listAuditLogs(input: z.infer<typeof auditLogListSchema>) {
  const where: Prisma.AuditLogWhereInput = {
    ...(input.action && { action: input.action }), ...(input.entityType && { entityType: input.entityType }),
    ...(input.entityId && { entityId: input.entityId }), ...(input.actorId && { actorId: input.actorId }),
    ...((input.from || input.to) && { createdAt: { ...(input.from && { gte: input.from }), ...(input.to && { lte: input.to }) } }),
  };
  const [items, total] = await prisma.$transaction([
    prisma.auditLog.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (input.page - 1) * input.pageSize, take: input.pageSize, select: { id: true, action: true, entityType: true, entityId: true, beforeSnapshot: true, afterSnapshot: true, requestId: true, createdAt: true, actor: { select: { id: true, fullName: true, email: true } } } }),
    prisma.auditLog.count({ where }),
  ]);
  return { items, pagination: { page: input.page, pageSize: input.pageSize, total, totalPages: Math.ceil(total / input.pageSize) } };
}

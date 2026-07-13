import { AuditAction } from "@prisma/client";
import { z } from "zod";

export const auditLogListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  action: z.nativeEnum(AuditAction).optional(),
  entityType: z.string().trim().min(1).max(100).optional(),
  entityId: z.string().trim().min(1).max(200).optional(),
  actorId: z.uuid().optional(),
  from: z.iso.datetime().transform((value) => new Date(value)).optional(),
  to: z.iso.datetime().transform((value) => new Date(value)).optional(),
}).refine((value) => !value.from || !value.to || value.from <= value.to, { message: "Invalid date range." });

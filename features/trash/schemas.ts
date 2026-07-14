import { z } from "zod";

import { TRASH_TYPES } from "./domain";

const optionalTrimmed = z.string().trim().min(1).max(100).optional();

export const trashTypeSchema = z.enum(TRASH_TYPES);
export const trashResourceIdSchema = z.string().uuid();
export const trashListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: optionalTrimmed,
  type: trashTypeSchema.optional(),
  expiry: z.enum(["all", "restorable", "expired"]).default("all"),
  eligibility: z.enum(["all", "pending", "eligible", "blocked"]).default("all"),
  sort: z.enum([
    "trashedAt-desc",
    "trashedAt-asc",
    "purgeAfter-desc",
    "purgeAfter-asc",
    "label-asc",
    "label-desc",
    "type-asc",
    "type-desc",
  ]).default("trashedAt-desc"),
}).strict();

export type TrashListInput = z.infer<typeof trashListSchema>;

import { z } from "zod";

const isoDate = z.string().datetime({ offset: true }).transform((value) => new Date(value));
const queryBoolean = z.enum(["true", "false"]).transform((value) => value === "true");

export const adminUserListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().min(1).max(200).optional(),
  isActive: queryBoolean.optional(),
  createdFrom: isoDate.optional(),
  createdTo: isoDate.optional(),
  sortBy: z.enum(["createdAt", "fullName", "email", "lastLoginAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
}).strict().refine((value) => !value.createdFrom || !value.createdTo || value.createdFrom <= value.createdTo, {
  path: ["createdTo"], message: "createdTo must be on or after createdFrom.",
});

export const updateUserActivitySchema = z.object({ isActive: z.boolean() }).strict();
export const userIdSchema = z.string().uuid();
export type AdminUserListInput = z.infer<typeof adminUserListSchema>;

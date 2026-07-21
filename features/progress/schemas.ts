import { z } from "zod";

const uuid = z.string().uuid();
const isoDate = z.string().datetime({ offset: true }).transform((value) => new Date(value));

export const lessonProgressSchema = z.object({ completed: z.boolean() }).strict();
export const dashboardQuerySchema = z.object({ organSystemId: uuid.optional() }).strict();

export const adminAttemptListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().min(1).max(200).optional(),
  userId: uuid.optional(),
  assessmentType: z.enum(["QUIZ", "TEST"]).optional(),
  organSystemId: uuid.optional(),
  topicId: uuid.optional(),
  status: z.enum(["IN_PROGRESS", "COMPLETED", "AUTO_SUBMITTED", "ABANDONED"]).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  sortBy: z.enum(["startedAt", "completedAt", "scorePercentage", "durationSeconds"]).default("startedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
}).strict().refine((value) => !value.from || !value.to || value.from <= value.to, {
  path: ["to"],
  message: "to must be on or after from.",
});

export const resourceIdSchema = uuid;
export type LessonProgressInput = z.infer<typeof lessonProgressSchema>;
export type AdminAttemptListInput = z.infer<typeof adminAttemptListSchema>;

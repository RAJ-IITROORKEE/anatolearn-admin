import { z } from "zod";

const feedbackType = z.enum(["GENERAL", "BUG_REPORT", "QUESTION_REQUEST", "IMPROVEMENT"]);
const feedbackStatus = z.enum(["NEW", "REVIEWED", "RESOLVED"]);
const isoDate = z.string().datetime({ offset: true }).transform((value) => new Date(value));
const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};

export const createFeedbackSchema = z.object({
  type: feedbackType,
  subject: z.string().trim().min(1).max(160),
  message: z.string().trim().min(1).max(5000),
}).strict();

export const mineFeedbackListSchema = z.object({
  ...pagination, type: feedbackType.optional(), status: feedbackStatus.optional(),
}).strict();

export const adminFeedbackListSchema = z.object({
  ...pagination,
  q: z.string().trim().min(1).max(200).optional(),
  type: feedbackType.optional(),
  status: feedbackStatus.optional(),
  userId: z.string().uuid().optional(),
  createdFrom: isoDate.optional(),
  createdTo: isoDate.optional(),
  sortBy: z.enum(["createdAt", "status", "type"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
}).strict().refine((value) => !value.createdFrom || !value.createdTo || value.createdFrom <= value.createdTo, {
  path: ["createdTo"], message: "createdTo must be on or after createdFrom.",
});

export const adminFeedbackUpdateSchema = z.object({
  adminNotes: z.string().trim().max(5000).nullable().optional(),
  status: z.enum(["REVIEWED", "RESOLVED"]).optional(),
}).strict().refine((value) => value.adminNotes !== undefined || value.status !== undefined, "At least one update is required.");

export const feedbackIdSchema = z.string().uuid();
export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>;
export type MineFeedbackListInput = z.infer<typeof mineFeedbackListSchema>;
export type AdminFeedbackListInput = z.infer<typeof adminFeedbackListSchema>;
export type AdminFeedbackUpdateInput = z.infer<typeof adminFeedbackUpdateSchema>;

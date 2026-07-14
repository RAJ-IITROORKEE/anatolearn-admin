import { z } from "zod";

export const expoPushTokenSchema = z.string().max(256).regex(/^Expo(?:nent)?PushToken\[[A-Za-z0-9_-]+\]$/);

export const deviceTokenSchema = z.object({
  expoPushToken: expoPushTokenSchema,
  platform: z.enum(["IOS", "ANDROID"]),
}).strict();

const allAudienceSchema = z.object({ type: z.literal("ALL_ACTIVE_USERS") }).strict();
const selectedAudienceSchema = z.object({
  type: z.literal("SELECTED_USERS"),
  userIds: z.array(z.uuid()).min(1).max(500),
}).strict().refine((value) => new Set(value.userIds).size === value.userIds.length, {
  message: "Selected learner IDs must be unique.",
  path: ["userIds"],
});

export const audienceSchema = z.discriminatedUnion("type", [allAudienceSchema, selectedAudienceSchema]);

const campaignFields = {
  type: z.enum(["DAILY_STUDY", "TEST_REMINDER", "ANNOUNCEMENT"]),
  title: z.string().trim().min(1).max(100),
  message: z.string().trim().min(1).max(1000),
  target: audienceSchema,
};

export const campaignCreateSchema = z.object(campaignFields).strict();
export const campaignUpdateSchema = z.object(campaignFields).partial().strict().refine(
  (value) => Object.keys(value).length > 0,
  "At least one field is required.",
);
export const campaignScheduleSchema = z.object({ scheduledAt: z.iso.datetime({ offset: true }).transform((value) => new Date(value)) }).strict();
export const uuidSchema = z.uuid();
export const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["DRAFT", "SCHEDULED", "PROCESSING", "SENT", "PARTIAL", "FAILED", "CANCELLED"]).optional(),
}).strict();

export type Audience = z.infer<typeof audienceSchema>;

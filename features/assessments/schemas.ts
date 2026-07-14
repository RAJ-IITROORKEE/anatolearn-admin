import { z } from "zod";

const uuid = z.string().uuid();

export const startAssessmentSchema = z.object({
  assessmentType: z.enum(["QUIZ", "TEST"]),
  organSystemId: uuid,
  topicIds: z.array(uuid).min(1).max(100).optional(),
  questionCount: z.number().int().min(5).max(50),
}).strict().superRefine((value, context) => {
  if (value.topicIds && new Set(value.topicIds).size !== value.topicIds.length) {
    context.addIssue({ code: "custom", path: ["topicIds"], message: "Topic IDs must be unique." });
  }
});

export const answerInputSchema = z.object({
  answeredOptionKey: uuid.nullable(),
  timeSpentSeconds: z.number().int().min(0).max(86_400).optional(),
}).strict();

export const attemptListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  assessmentType: z.enum(["QUIZ", "TEST"]).optional(),
  status: z.enum(["IN_PROGRESS", "COMPLETED", "AUTO_SUBMITTED", "ABANDONED"]).optional(),
  organSystemId: uuid.optional(),
}).strict();

export const attemptIdSchema = uuid;
export type StartAssessmentInput = z.infer<typeof startAssessmentSchema>;
export type AnswerInput = z.infer<typeof answerInputSchema>;
export type AttemptListInput = z.infer<typeof attemptListSchema>;

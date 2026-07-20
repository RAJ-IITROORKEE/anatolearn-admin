import { z } from "zod";

const uuid = z.string().uuid();

const assessmentScope = {
  assessmentType: z.enum(["QUIZ", "TEST"]),
  organSystemId: uuid.optional(),
  topicIds: z.array(uuid).min(1).max(100).optional(),
};

function validateScope(value: { organSystemId?: string; topicIds?: string[] }, context: z.RefinementCtx) {
  if (!value.organSystemId && !value.topicIds) {
    context.addIssue({ code: "custom", path: ["topicIds"], message: "Topic IDs are required when organSystemId is omitted." });
  }
  if (value.topicIds && new Set(value.topicIds).size !== value.topicIds.length) {
    context.addIssue({ code: "custom", path: ["topicIds"], message: "Topic IDs must be unique." });
  }
}

export const startAssessmentSchema = z.object({
  ...assessmentScope,
  questionCount: z.number().int().min(5).max(50),
}).strict().superRefine((value, context) => {
  validateScope(value, context);
  if (value.topicIds && value.questionCount < value.topicIds.length) {
    context.addIssue({ code: "custom", path: ["questionCount"], message: "questionCount must be at least the selected topic count." });
  }
});

export const assessmentAvailabilitySchema = z.object(assessmentScope).strict().superRefine(validateScope);

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
export type AssessmentAvailabilityInput = z.infer<typeof assessmentAvailabilitySchema>;
export type AnswerInput = z.infer<typeof answerInputSchema>;
export type AttemptListInput = z.infer<typeof attemptListSchema>;

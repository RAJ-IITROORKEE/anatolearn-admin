import { z } from "zod";

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const uuid = z.string().uuid();
const assessmentType = z.enum(["QUIZ", "TEST"]);
const difficulty = z.enum(["EASY", "MEDIUM", "HARD"]);
const editableStatus = z.enum(["DRAFT", "PUBLISHED"]);
const publishStatus = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);

export const questionOptionInputSchema = z.object({
  id: uuid.optional(),
  optionText: text(1000),
  mediaId: uuid.nullable().optional(),
  isCorrect: z.boolean(),
}).strict();

const optionsSchema = z.array(questionOptionInputSchema).min(2).max(6).superRefine((options, context) => {
  if (options.filter((option) => option.isCorrect).length !== 1) {
    context.addIssue({ code: "custom", message: "Exactly one option must be correct." });
  }
  const ids = options.flatMap((option) => option.id ? [option.id] : []);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: "custom", message: "Existing option IDs must be unique." });
  }
});

export const questionCreateSchema = z.object({
  topicId: uuid,
  assessmentType,
  questionText: text(5000),
  mediaId: uuid.nullable().optional(),
  explanation: text(5000),
  difficulty: difficulty.default("MEDIUM"),
  conceptTag: optionalText(100),
  options: optionsSchema,
}).strict();

export const questionUpdateSchema = z.object({
  topicId: uuid.optional(),
  assessmentType: assessmentType.optional(),
  questionText: text(5000).optional(),
  mediaId: uuid.nullable().optional(),
  explanation: text(5000).optional(),
  difficulty: difficulty.optional(),
  conceptTag: optionalText(100),
  options: optionsSchema.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one field is required.");

const queryBoolean = z.enum(["true", "false"]).transform((value) => value === "true");

export const questionListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(200).optional(),
  assessmentType: assessmentType.optional(),
  topicId: uuid.optional(),
  organSystemId: uuid.optional(),
  difficulty: difficulty.optional(),
  status: publishStatus.optional(),
  isActive: queryBoolean.optional(),
  conceptTag: z.string().trim().min(1).max(100).optional(),
  sortBy: z.enum(["questionText", "createdAt", "updatedAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
}).strict();

export const questionStatusSchema = z.object({ status: editableStatus }).strict();
export const questionActivitySchema = z.object({ isActive: z.boolean() }).strict();
export const questionBulkStatusSchema = z.object({
  ids: z.array(uuid).min(1).max(100),
  status: publishStatus,
}).strict().superRefine((value, context) => {
  if (new Set(value.ids).size !== value.ids.length) {
    context.addIssue({ code: "custom", path: ["ids"], message: "Question IDs must be unique." });
  }
});

export const questionIdSchema = uuid;

export type QuestionCreateInput = z.infer<typeof questionCreateSchema>;
export type QuestionUpdateInput = z.infer<typeof questionUpdateSchema>;
export type QuestionOptionInput = z.infer<typeof questionOptionInputSchema>;
export type QuestionListInput = z.infer<typeof questionListSchema>;

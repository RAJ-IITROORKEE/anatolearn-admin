import { z } from "zod";

const uuid = z.string().uuid();
const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const uniqueIdList = z.array(uuid).min(1).max(500).superRefine((ids, context) => {
  if (new Set(ids).size !== ids.length) context.addIssue({ code: "custom", message: "IDs must be unique." });
});

export const flashcardStatusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);
export const flashcardDifficultySchema = z.enum(["EASY", "MEDIUM", "HARD"]);
export const flashcardIdSchema = uuid;

export const flashcardCreateSchema = z.object({
  topicId: uuid,
  frontText: text(5000),
  backText: text(5000),
  frontMediaId: uuid.nullable().optional(),
  backMediaId: uuid.nullable().optional(),
  difficulty: flashcardDifficultySchema.optional(),
  notes: optionalText(5000),
  displayOrder: z.number().int().min(0),
}).strict();

export const flashcardUpdateSchema = flashcardCreateSchema.partial().strict().refine(
  (value) => Object.keys(value).length > 0,
  "At least one field is required.",
);

export const flashcardStatusUpdateSchema = z.object({ status: flashcardStatusSchema }).strict();

export const flashcardReorderSchema = z.object({
  parentId: uuid,
  ids: uniqueIdList,
}).strict();

export const flashcardBulkStatusSchema = z.object({
  ids: uniqueIdList,
  status: flashcardStatusSchema,
}).strict();

export const flashcardListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(200).optional(),
  status: flashcardStatusSchema.optional(),
  difficulty: flashcardDifficultySchema.optional(),
  topicId: uuid.optional(),
  organSystemId: uuid.optional(),
  sortBy: z.enum(["displayOrder", "frontText", "difficulty", "createdAt", "updatedAt"]).default("displayOrder"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
}).strict();

export const flashcardProgressSchema = z.object({
  eventId: uuid,
  isDifficult: z.boolean().optional(),
  isMastered: z.boolean().optional(),
}).strict();

export type FlashcardCreateInput = z.infer<typeof flashcardCreateSchema>;
export type FlashcardUpdateInput = z.infer<typeof flashcardUpdateSchema>;
export type FlashcardListInput = z.infer<typeof flashcardListQuerySchema>;
export type FlashcardProgressInput = z.infer<typeof flashcardProgressSchema>;

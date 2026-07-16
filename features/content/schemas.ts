import { z } from "zod";

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const slug = z.string().trim().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const uuid = z.string().uuid();
const blockId = text(100).optional();
export const publishStatusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);

export const contentBlockSchema = z.discriminatedUnion("type", [
  z.object({ id: blockId, type: z.literal("heading"), level: z.union([z.literal(2), z.literal(3), z.literal(4)]), text: text(200) }).strict(),
  z.object({ id: blockId, type: z.literal("paragraph"), text: text(5000) }).strict(),
  z.object({ id: blockId, type: z.literal("image"), mediaId: uuid, altText: text(300), caption: optionalText(500) }).strict(),
  z.object({ id: blockId, type: z.literal("callout"), tone: z.enum(["info", "warning", "success"]), title: optionalText(200), text: text(2000) }).strict(),
  z.object({ id: blockId, type: z.literal("bulletList"), items: z.array(text(1000)).min(1).max(50) }).strict(),
  z.object({ id: blockId, type: z.literal("numberedList"), items: z.array(text(1000)).min(1).max(50) }).strict(),
  z.object({ id: blockId, type: z.literal("divider") }).strict(),
]);

export const contentBlocksSchema = z.array(contentBlockSchema).max(200).superRefine((blocks, ctx) => {
  const seen = new Set<string>();
  blocks.forEach((block, index) => {
    if (!block.id) return;
    if (seen.has(block.id)) {
      ctx.addIssue({ code: "custom", path: [index, "id"], message: "Block IDs must be unique." });
    }
    seen.add(block.id);
  });
});

export const organSystemCreateSchema = z.object({
  name: text(120), slug: slug.optional(), shortDescription: text(500), longDescription: optionalText(5000),
  coverMediaId: uuid.nullable().optional(), iconMediaId: uuid.nullable().optional(),
  displayOrder: z.number().int().min(0), isActive: z.boolean().optional(),
}).strict();
export const organSystemUpdateSchema = organSystemCreateSchema.partial().strict().refine((value) => Object.keys(value).length > 0, "At least one field is required.");

export const topicCreateSchema = z.object({
  organSystemId: uuid, title: text(160), slug, summary: optionalText(1000),
  coverMediaId: uuid.nullable().optional(), displayOrder: z.number().int().min(0),
}).strict();
export const topicUpdateSchema = topicCreateSchema.partial().strict().refine((value) => Object.keys(value).length > 0, "At least one field is required.");

export const contentLessonCreateSchema = z.object({
  topicId: uuid, title: text(200), slug, summary: optionalText(1000), contentBlocks: contentBlocksSchema,
  estimatedReadingMinutes: z.number().int().min(0).max(600), displayOrder: z.number().int().min(0),
}).strict();
export const contentLessonUpdateSchema = contentLessonCreateSchema.partial().strict().refine((value) => Object.keys(value).length > 0, "At least one field is required.");

export const statusUpdateSchema = z.object({ status: publishStatusSchema }).strict();
export const organActiveUpdateSchema = z.object({ isActive: z.boolean() }).strict();
export const reorderSchema = z.object({ parentId: uuid.optional(), ids: z.array(uuid).min(1).max(500) }).strict().superRefine((value, ctx) => {
  if (new Set(value.ids).size !== value.ids.length) ctx.addIssue({ code: "custom", path: ["ids"], message: "IDs must be unique." });
});

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(200).optional(), status: publishStatusSchema.optional(),
  organSystemId: uuid.optional(), topicId: uuid.optional(),
  sortBy: z.enum(["displayOrder", "name", "title", "createdAt", "updatedAt"]).default("displayOrder"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
}).strict();

export type ContentBlock = z.infer<typeof contentBlockSchema>;

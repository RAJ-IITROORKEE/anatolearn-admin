import { z } from "zod";

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const slug = z.string().trim().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const uuid = z.string().uuid();
export const slugParamSchema = slug;
export const adminLessonSlugParamsSchema = z.object({
  slug,
  topicSlug: slug,
  lessonSlug: slug,
}).strict();
const blockId = text(100).optional();
export const publishStatusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);

export const richTextFontSizes = ["12px", "14px", "16px", "18px", "20px", "24px"] as const;
export const richTextColors = ["#0F172A", "#334155", "#2563EB", "#7C3AED", "#DC2626", "#C2410C", "#A16207", "#16A34A", "#0F766E", "#BE185D"] as const;
export const richTextHighlights = ["#F1F5F9", "#DBEAFE", "#EDE9FE", "#FEE2E2", "#FFEDD5", "#FEF3C7", "#DCFCE7", "#CCFBF1", "#FCE7F3"] as const;

export const contentBlockSchema = z.discriminatedUnion("type", [
  z.object({ id: blockId, type: z.literal("heading"), level: z.union([z.literal(2), z.literal(3), z.literal(4)]), text: text(200) }).strict(),
  z.object({ id: blockId, type: z.literal("paragraph"), text: text(5000) }).strict(),
  z.object({ id: blockId, type: z.literal("image"), mediaId: uuid, altText: z.string().trim().max(300), caption: optionalText(500) }).strict(),
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

const legacyIdAttrs = { legacyId: blockId };
const alignmentAttrs = { textAlign: z.enum(["left", "center", "right"]).optional(), ...legacyIdAttrs };
const safeLink = z.string().trim().max(2048).refine((value) => {
  if (value.startsWith("/")) return !value.startsWith("//");
  try {
    return ["https:", "http:", "mailto:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}, "Link must use http, https, mailto, or an application-relative path.");

const richTextMarkSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("bold") }).strict(),
  z.object({ type: z.literal("italic") }).strict(),
  z.object({ type: z.literal("underline") }).strict(),
  z.object({ type: z.literal("strike") }).strict(),
  z.object({ type: z.literal("link"), attrs: z.object({ href: safeLink }).strict() }).strict(),
  z.object({ type: z.literal("highlight"), attrs: z.object({ color: z.enum(richTextHighlights) }).strict() }).strict(),
  z.object({
    type: z.literal("textStyle"),
    attrs: z.object({ fontSize: z.enum(richTextFontSizes).optional(), color: z.enum(richTextColors).optional() }).strict()
      .refine((attrs) => attrs.fontSize !== undefined || attrs.color !== undefined, "Text style must contain an allowlisted value."),
  }).strict(),
]);

const richTextTextSchema = z.object({
  type: z.literal("text"),
  text: z.string().min(1).max(10_000),
  marks: z.array(richTextMarkSchema).max(6).optional().superRefine((marks, ctx) => {
    if (!marks) return;
    const names = marks.map((mark) => mark.type);
    if (new Set(names).size !== names.length) ctx.addIssue({ code: "custom", message: "Text marks must be unique." });
  }),
}).strict();

type RichTextText = z.infer<typeof richTextTextSchema>;
export type RichTextNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: RichTextNode[];
  text?: string;
  marks?: z.infer<typeof richTextMarkSchema>[];
};

const MAX_RICH_DEPTH = 8;
const MAX_RICH_NODES = 2000;
const MAX_RICH_TEXT = 100_000;

const richTextUnknownPreflight = z.unknown().superRefine((value, ctx) => {
  const stack: Array<{ value: unknown; depth: number }> = [{ value, depth: 0 }];
  let nodeCount = 0;
  let textLength = 0;
  while (stack.length) {
    const current = stack.pop()!;
    if (!current.value || typeof current.value !== "object" || Array.isArray(current.value)) continue;
    nodeCount += 1;
    if (nodeCount > MAX_RICH_NODES) {
      ctx.addIssue({ code: "custom", message: "Rich content has too many nodes." });
      return;
    }
    if (current.depth > MAX_RICH_DEPTH) {
      ctx.addIssue({ code: "custom", message: "Rich content nesting is too deep." });
      return;
    }
    const node = current.value as { text?: unknown; content?: unknown };
    if (typeof node.text === "string") {
      textLength += node.text.length;
      if (textLength > MAX_RICH_TEXT) {
        ctx.addIssue({ code: "custom", message: "Rich content contains too much text." });
        return;
      }
    }
    if (Array.isArray(node.content)) {
      for (let index = node.content.length - 1; index >= 0; index -= 1) {
        stack.push({ value: node.content[index], depth: current.depth + 1 });
      }
    }
  }
});

function inlineTextLength(content: RichTextText[] | undefined) {
  return content?.reduce((total, node) => total + node.text.length, 0) ?? 0;
}

function paragraphSequenceLength(paragraphs: Array<{ content?: RichTextText[] }>) {
  return paragraphs.reduce((total, paragraph) => total + inlineTextLength(paragraph.content), 0) + Math.max(0, paragraphs.length - 1);
}

function makeRichTextDocumentSchema(pendingImages: boolean) {
  const imageAttrs = pendingImages
    ? z.union([
        z.object({ mediaId: uuid, uploadId: uuid.optional(), alt: z.string().trim().max(300), caption: optionalText(500), ...legacyIdAttrs }).strict(),
        z.object({ uploadId: uuid, alt: z.string().trim().max(300), caption: optionalText(500), ...legacyIdAttrs }).strict(),
      ])
    : z.object({ mediaId: uuid, alt: z.string().trim().max(300), caption: optionalText(500), ...legacyIdAttrs }).strict();
  const image = z.object({ type: z.literal("image"), attrs: imageAttrs }).strict();
  const paragraph = z.object({
    type: z.literal("paragraph"), attrs: z.object(alignmentAttrs).strict().optional(),
    content: z.array(richTextTextSchema).max(500).optional(),
  }).strict().superRefine((node, ctx) => {
    if (inlineTextLength(node.content) > 5000) ctx.addIssue({ code: "custom", path: ["content"], message: "Paragraph text must be at most 5000 characters." });
  });
  const heading = z.object({
    type: z.literal("heading"),
    attrs: z.object({ level: z.union([z.literal(2), z.literal(3), z.literal(4)]), ...alignmentAttrs }).strict(),
    content: z.array(richTextTextSchema).max(200).optional(),
  }).strict().superRefine((node, ctx) => {
    if (inlineTextLength(node.content) > 200) ctx.addIssue({ code: "custom", path: ["content"], message: "Heading text must be at most 200 characters." });
  });
  const horizontalRule = z.object({ type: z.literal("horizontalRule"), attrs: z.object(legacyIdAttrs).strict().optional() }).strict();

  const listItem: z.ZodType<RichTextNode> = z.object({
    type: z.literal("listItem"),
    content: z.array(paragraph).min(1).max(50),
  }).strict().superRefine((node, ctx) => {
    const length = paragraphSequenceLength(node.content);
    if (length > 1000) ctx.addIssue({ code: "custom", path: ["content"], message: "List item text must be at most 1000 characters." });
  });
  const bulletList: z.ZodType<RichTextNode> = z.object({
    type: z.literal("bulletList"), attrs: z.object(legacyIdAttrs).strict().optional(),
    content: z.array(listItem).min(1).max(50),
  }).strict();
  const orderedList: z.ZodType<RichTextNode> = z.object({
    type: z.literal("orderedList"), attrs: z.object(legacyIdAttrs).strict().optional(),
    content: z.array(listItem).min(1).max(50),
  }).strict();
  const blockquote = z.object({
    type: z.literal("blockquote"),
    attrs: z.object({ ...legacyIdAttrs, tone: z.enum(["info", "warning", "success"]).optional(), title: optionalText(200) }).strict().optional(),
    content: z.array(paragraph).min(1).max(50),
  }).strict().superRefine((node, ctx) => {
    const length = paragraphSequenceLength(node.content);
    if (length > 2000) ctx.addIssue({ code: "custom", path: ["content"], message: "Block quote text must be at most 2000 characters." });
  });
  const block = z.union([paragraph, heading, image, horizontalRule, bulletList, orderedList, blockquote]);

  const recursiveSchema = z.object({ type: z.literal("doc"), content: z.array(block).max(200) }).strict().superRefine((document, ctx) => {
    const ids = new Set<string>();
    const stack: RichTextNode[] = [...document.content] as RichTextNode[];
    while (stack.length) {
      const node = stack.pop()!;
      const id = typeof node.attrs?.legacyId === "string" ? node.attrs.legacyId : null;
      if (id && ids.has(id)) ctx.addIssue({ code: "custom", message: "Rich content IDs must be unique." });
      if (id) ids.add(id);
      if (node.content) stack.push(...node.content);
    }
  });
  return richTextUnknownPreflight.pipe(recursiveSchema);
}

export const richTextDocumentSchema = makeRichTextDocumentSchema(false);
export const richTextDraftDocumentSchema = makeRichTextDocumentSchema(true);
export type RichTextDocument = z.infer<typeof richTextDocumentSchema>;

function textNode(value: string): RichTextText[] {
  return value ? [{ type: "text", text: value }] : [];
}

export function legacyBlocksToRichContent(blocks: ContentBlock[]): RichTextDocument {
  const content: RichTextNode[] = blocks.map((block) => {
    const legacyId = block.id ? { legacyId: block.id } : {};
    if (block.type === "heading") return { type: "heading", attrs: { level: block.level, ...legacyId }, content: textNode(block.text) };
    if (block.type === "paragraph") return { type: "paragraph", ...(block.id ? { attrs: legacyId } : {}), content: textNode(block.text) };
    if (block.type === "image") return { type: "image", attrs: { mediaId: block.mediaId, alt: block.altText, caption: block.caption ?? null, ...legacyId } };
    if (block.type === "callout") return { type: "blockquote", attrs: { tone: block.tone, title: block.title ?? null, ...legacyId }, content: [{ type: "paragraph", content: textNode(block.text) }] };
    if (block.type === "bulletList" || block.type === "numberedList") return {
      type: block.type === "bulletList" ? "bulletList" : "orderedList",
      ...(block.id ? { attrs: legacyId } : {}),
      content: block.items.map((item) => ({ type: "listItem", content: [{ type: "paragraph", content: textNode(item) }] })),
    };
    return { type: "horizontalRule", ...(block.id ? { attrs: legacyId } : {}) };
  });
  return richTextDocumentSchema.parse({ type: "doc", content });
}

function richNodeText(node: RichTextNode): string {
  if (typeof node.text === "string") return node.text;
  const separator = ["blockquote", "listItem", "bulletList", "orderedList", "doc"].includes(node.type) ? "\n" : "";
  return (node.content ?? []).map(richNodeText).join(separator);
}

export function richContentToLegacyBlocks(document: RichTextDocument): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  for (const parsedNode of document.content) {
    const node = parsedNode as RichTextNode;
    const id = typeof node.attrs?.legacyId === "string" ? { id: node.attrs.legacyId } : {};
    const nodeText = richNodeText(node).trim();
    if (node.type === "heading" && nodeText) blocks.push({ ...id, type: "heading", level: node.attrs?.level as 2 | 3 | 4, text: nodeText });
    else if (node.type === "paragraph" && nodeText) blocks.push({ ...id, type: "paragraph", text: nodeText });
    else if (node.type === "image") blocks.push({ ...id, type: "image", mediaId: String(node.attrs?.mediaId), altText: String(node.attrs?.alt ?? "").trim(), caption: typeof node.attrs?.caption === "string" ? node.attrs.caption.trim() || null : null });
    else if (node.type === "blockquote" && nodeText) blocks.push({
      ...id, type: "callout", tone: (node.attrs?.tone as "info" | "warning" | "success" | undefined) ?? "info",
      title: typeof node.attrs?.title === "string" ? node.attrs.title.trim() || null : null, text: nodeText,
    });
    else if (node.type === "bulletList" || node.type === "orderedList") {
      const items = (node.content ?? []).map(richNodeText).map((item) => item.trim()).filter(Boolean);
      if (items.length) blocks.push({ ...id, type: node.type === "bulletList" ? "bulletList" : "numberedList", items } as ContentBlock);
    } else if (node.type === "horizontalRule") blocks.push({ ...id, type: "divider" });
  }
  return blocks;
}

const pendingMediaPlaceholder = "00000000-0000-4000-8000-000000000001";

export function validateRichDraftFallback(document: unknown) {
  const draft = richTextDraftDocumentSchema.parse(document);
  const content = draft.content.map((parsedNode) => {
    const node = parsedNode as RichTextNode;
    if (node.type !== "image") return node;
    const attrs = node.attrs ?? {};
    return { ...node, attrs: { ...attrs, mediaId: typeof attrs.mediaId === "string" ? attrs.mediaId : pendingMediaPlaceholder, uploadId: undefined } };
  });
  const storedDocument = richTextDocumentSchema.parse({ type: "doc", content: content.map((node) => {
    if (node.type !== "image") return node;
    const attrsWithUpload = (node as RichTextNode).attrs ?? {};
    const { uploadId: _uploadId, ...attrs } = attrsWithUpload;
    void _uploadId;
    return { ...node, attrs };
  }) });
  return contentBlocksSchema.parse(richContentToLegacyBlocks(storedDocument));
}

export function lessonMediaIds(value: unknown) {
  const parsed = lessonContentSchema.parse(value);
  const ids = new Set<string>();
  const blocks = Array.isArray(parsed) ? parsed : parsed.fallbackBlocks;
  for (const block of blocks) if (block.type === "image") ids.add(block.mediaId);
  if (!Array.isArray(parsed)) {
    const stack: RichTextNode[] = [...parsed.richContent.content] as RichTextNode[];
    while (stack.length) {
      const node = stack.pop()!;
      if (node.type === "image" && typeof node.attrs?.mediaId === "string") ids.add(node.attrs.mediaId);
      if (node.content) stack.push(...node.content);
    }
  }
  return [...ids];
}

export const richLessonContentSchema = z.object({
  version: z.literal(2),
  richContent: richTextDocumentSchema,
  fallbackBlocks: contentBlocksSchema,
}).strict().superRefine((value, ctx) => {
  if (JSON.stringify(value.fallbackBlocks) !== JSON.stringify(richContentToLegacyBlocks(value.richContent))) {
    ctx.addIssue({ code: "custom", path: ["fallbackBlocks"], message: "Rich content fallback does not match the document." });
  }
});

export const lessonContentSchema = z.union([contentBlocksSchema, richLessonContentSchema]);

export function readLessonContent(value: unknown): { contentBlocks: ContentBlock[]; richContent: RichTextDocument | null } {
  const parsed = lessonContentSchema.parse(value);
  return Array.isArray(parsed)
    ? { contentBlocks: parsed, richContent: null }
    : { contentBlocks: parsed.fallbackBlocks, richContent: parsed.richContent };
}

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
  topicId: uuid, title: text(200), slug, summary: optionalText(1000), contentBlocks: lessonContentSchema,
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

export const studyCatalogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(200).optional(),
}).strict();

export type ContentBlock = z.infer<typeof contentBlockSchema>;

import { describe, expect, it } from "vitest";

import {
  contentBlocksSchema,
  contentLessonCreateSchema,
  legacyBlocksToRichContent,
  lessonMediaIds,
  listQuerySchema,
  organSystemCreateSchema,
  organSystemUpdateSchema,
  readLessonContent,
  reorderSchema,
  richContentToLegacyBlocks,
  richTextDraftDocumentSchema,
  richTextDocumentSchema,
} from "./schemas";

describe("content administration schemas", () => {
  it("rejects unknown mutation fields", () => {
    expect(organSystemCreateSchema.safeParse({
      name: "Nervous system",
      slug: "nervous-system",
      shortDescription: "Brain, spinal cord, and nerves.",
      displayOrder: 0,
      actorId: crypto.randomUUID(),
    }).success).toBe(false);
    expect(organSystemUpdateSchema.safeParse({}).success).toBe(false);
  });

  it("allows the server to generate an organ-system slug", () => {
    expect(organSystemCreateSchema.safeParse({
      name: "Heart & Vessels",
      shortDescription: "Circulation.",
      displayOrder: 0,
    }).success).toBe(true);
  });

  it("accepts every supported structured lesson block", () => {
    expect(contentLessonCreateSchema.safeParse({
      topicId: crypto.randomUUID(),
      title: "Overview",
      slug: "overview",
      estimatedReadingMinutes: 4,
      displayOrder: 0,
      contentBlocks: [
        { type: "heading", level: 2, text: "Overview" },
        { type: "paragraph", text: "Structured educational text." },
        { type: "image", mediaId: crypto.randomUUID(), altText: "An anatomical diagram" },
        { type: "callout", tone: "info", title: "Remember", text: "A useful detail." },
        { type: "bulletList", items: ["One", "Two"] },
        { type: "numberedList", items: ["First", "Second"] },
        { type: "divider" },
      ],
    }).success).toBe(true);
  });

  it("accepts optional image alt text but rejects raw HTML and malformed image IDs", () => {
    const base = {
      topicId: crypto.randomUUID(), title: "Overview", slug: "overview",
      estimatedReadingMinutes: 4, displayOrder: 0,
    };
    expect(contentLessonCreateSchema.safeParse({ ...base, contentBlocks: [{ type: "html", html: "<b>unsafe</b>" }] }).success).toBe(false);
    expect(contentLessonCreateSchema.safeParse({ ...base, contentBlocks: [{ type: "image", mediaId: crypto.randomUUID(), altText: "" }] }).success).toBe(true);
    expect(contentLessonCreateSchema.safeParse({ ...base, contentBlocks: [{ type: "image", mediaId: "invalid", altText: "" }] }).success).toBe(false);
  });

  it("accepts unique stable block IDs and rejects duplicates", () => {
    expect(contentBlocksSchema.safeParse([
      { id: "sample-heading", type: "heading", level: 2, text: "Overview" },
      { id: "sample-paragraph", type: "paragraph", text: "Structured educational text." },
    ]).success).toBe(true);

    expect(contentBlocksSchema.safeParse([
      { id: "duplicate", type: "heading", level: 2, text: "Overview" },
      { id: "duplicate", type: "paragraph", text: "Structured educational text." },
    ]).success).toBe(false);
  });

  it("imports every legacy block without changing its compatible fallback", () => {
    const blocks = contentBlocksSchema.parse([
      { id: "heading", type: "heading", level: 2, text: "Heart overview" },
      { id: "paragraph", type: "paragraph", text: "The heart pumps blood." },
      { id: "image", type: "image", mediaId: crypto.randomUUID(), altText: "Heart", caption: "Anterior view" },
      { id: "callout", type: "callout", tone: "warning", title: "Clinical note", text: "Inspect carefully." },
      { id: "bullets", type: "bulletList", items: ["Atrium", "Ventricle"] },
      { id: "numbers", type: "numberedList", items: ["Fill", "Pump"] },
      { id: "divider", type: "divider" },
    ]);

    const richContent = legacyBlocksToRichContent(blocks);

    expect(richContentToLegacyBlocks(richContent)).toEqual(blocks);
    expect(readLessonContent(blocks)).toEqual({ contentBlocks: blocks, richContent: null });
  });

  it("persists allowlisted rich formatting while retaining a learner-compatible fallback", () => {
    const mediaId = crypto.randomUUID();
    const richContent = richTextDocumentSchema.parse({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 3, textAlign: "center", legacyId: "intro" },
          content: [{ type: "text", text: "Cardiac anatomy", marks: [{ type: "bold" }, { type: "textStyle", attrs: { fontSize: "20px", color: "#2563EB" } }] }],
        },
        {
          type: "paragraph",
          attrs: { textAlign: "right" },
          content: [{ type: "text", text: "Read more", marks: [{ type: "underline" }, { type: "highlight", attrs: { color: "#FEF3C7" } }, { type: "link", attrs: { href: "https://example.test/anatomy" } }] }],
        },
        { type: "image", attrs: { mediaId, alt: "Managed heart", caption: "Private asset", legacyId: "heart-image" } },
      ],
    });
    const fallbackBlocks = richContentToLegacyBlocks(richContent);
    const stored = { version: 2 as const, richContent, fallbackBlocks };

    expect(contentLessonCreateSchema.safeParse({
      topicId: crypto.randomUUID(),
      title: "Rich lesson",
      slug: "rich-lesson",
      contentBlocks: stored,
      estimatedReadingMinutes: 4,
      displayOrder: 0,
    }).success).toBe(true);
    expect(readLessonContent(stored)).toEqual({ contentBlocks: fallbackBlocks, richContent });
    expect(fallbackBlocks).toEqual([
      { id: "intro", type: "heading", level: 3, text: "Cardiac anatomy" },
      { type: "paragraph", text: "Read more" },
      { id: "heart-image", type: "image", mediaId, altText: "Managed heart", caption: "Private asset" },
    ]);
  });

  it("collects and downconverts every managed media ID in a valid rich document", () => {
    const mediaIds = [crypto.randomUUID(), crypto.randomUUID()];
    const richContent = richTextDocumentSchema.parse({
      type: "doc",
      content: mediaIds.map((mediaId, index) => ({ type: "image", attrs: { mediaId, alt: `Image ${index + 1}`, caption: null } })),
    });
    const fallbackBlocks = richContentToLegacyBlocks(richContent);
    const stored = { version: 2 as const, richContent, fallbackBlocks };

    expect(lessonMediaIds(stored)).toEqual(mediaIds);
    expect(fallbackBlocks.map((block) => block.type === "image" ? block.mediaId : null)).toEqual(mediaIds);
  });

  it("rejects arbitrary rich AST nodes, attributes, marks, values, depth, and node counts", () => {
    const paragraph = { type: "paragraph", content: [{ type: "text", text: "Safe" }] };
    expect(richTextDocumentSchema.safeParse({ type: "doc", content: [{ type: "table", content: [] }] }).success).toBe(false);
    expect(richTextDocumentSchema.safeParse({ type: "doc", content: [{ ...paragraph, attrs: { style: "position:fixed" } }] }).success).toBe(false);
    expect(richTextDocumentSchema.safeParse({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Unsafe", marks: [{ type: "script", attrs: { src: "https://evil.test" } }] }] }] }).success).toBe(false);
    expect(richTextDocumentSchema.safeParse({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Huge", marks: [{ type: "textStyle", attrs: { fontSize: "99px", color: "red" } }] }] }] }).success).toBe(false);

    let nested: unknown = paragraph;
    for (let index = 0; index < 10; index += 1) nested = { type: "blockquote", content: [nested] };
    expect(richTextDocumentSchema.safeParse({ type: "doc", content: [nested] }).success).toBe(false);
    expect(richTextDocumentSchema.safeParse({ type: "doc", content: Array.from({ length: 2001 }, () => paragraph) }).success).toBe(false);
  });

  it("rejects nested images because managed images are top-level lesson blocks", () => {
    const mediaId = crypto.randomUUID();
    expect(richTextDocumentSchema.safeParse({
      type: "doc",
      content: [{
        type: "blockquote",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Quote" }] },
          { type: "image", attrs: { mediaId, alt: "Nested", caption: null } },
        ],
      }],
    }).success).toBe(false);
  });

  it("aligns rich node and generated fallback limits with the legacy block contract", () => {
    const paragraph = (length: number) => ({ type: "paragraph", content: [{ type: "text", text: "x".repeat(length) }] });
    const heading = (length: number) => ({ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "x".repeat(length) }] });
    const list = (count: number, itemLength = 1) => ({
      type: "bulletList",
      content: Array.from({ length: count }, () => ({ type: "listItem", content: [paragraph(itemLength)] })),
    });
    const quote = (length: number) => ({ type: "blockquote", content: [paragraph(length)] });

    expect(richTextDocumentSchema.safeParse({ type: "doc", content: [paragraph(5000), heading(200), list(50, 1000), quote(2000)] }).success).toBe(true);
    expect(richTextDocumentSchema.safeParse({ type: "doc", content: [paragraph(5001)] }).success).toBe(false);
    expect(richTextDocumentSchema.safeParse({ type: "doc", content: [heading(201)] }).success).toBe(false);
    expect(richTextDocumentSchema.safeParse({ type: "doc", content: [list(51)] }).success).toBe(false);
    expect(richTextDocumentSchema.safeParse({ type: "doc", content: [list(1, 1001)] }).success).toBe(false);
    expect(richTextDocumentSchema.safeParse({ type: "doc", content: [quote(2001)] }).success).toBe(false);
    expect(richTextDocumentSchema.safeParse({ type: "doc", content: Array.from({ length: 201 }, () => paragraph(1)) }).success).toBe(false);
  });

  it("preflights deeply hostile unknown input iteratively without overflowing the call stack", () => {
    let nested: unknown = { type: "paragraph", content: [{ type: "text", text: "Safe" }] };
    for (let index = 0; index < 20_000; index += 1) nested = { type: "blockquote", content: [nested] };

    expect(() => richTextDocumentSchema.safeParse({ type: "doc", content: [nested] })).not.toThrow();
    expect(richTextDocumentSchema.safeParse({ type: "doc", content: [nested] }).success).toBe(false);
    expect(() => richTextDraftDocumentSchema.safeParse({ type: "doc", content: [nested] })).not.toThrow();
  });

  it("caps pagination and requires unique reorder IDs", () => {
    expect(listQuerySchema.safeParse({ page: "1", pageSize: "101" }).success).toBe(false);
    const id = crypto.randomUUID();
    expect(reorderSchema.safeParse({ parentId: crypto.randomUUID(), ids: [id, id] }).success).toBe(false);
  });
});

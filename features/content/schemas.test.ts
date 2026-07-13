import { describe, expect, it } from "vitest";

import {
  contentBlocksSchema,
  contentLessonCreateSchema,
  listQuerySchema,
  organSystemCreateSchema,
  organSystemUpdateSchema,
  reorderSchema,
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

  it("rejects raw HTML and malformed image blocks", () => {
    const base = {
      topicId: crypto.randomUUID(), title: "Overview", slug: "overview",
      estimatedReadingMinutes: 4, displayOrder: 0,
    };
    expect(contentLessonCreateSchema.safeParse({ ...base, contentBlocks: [{ type: "html", html: "<b>unsafe</b>" }] }).success).toBe(false);
    expect(contentLessonCreateSchema.safeParse({ ...base, contentBlocks: [{ type: "image", mediaId: crypto.randomUUID(), altText: "" }] }).success).toBe(false);
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

  it("caps pagination and requires unique reorder IDs", () => {
    expect(listQuerySchema.safeParse({ page: "1", pageSize: "101" }).success).toBe(false);
    const id = crypto.randomUUID();
    expect(reorderSchema.safeParse({ parentId: crypto.randomUUID(), ids: [id, id] }).success).toBe(false);
  });
});

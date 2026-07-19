import type { ContentLesson, OrganSystem } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { lessonDto, organSystemDto } from "./dto";

describe("organSystemDto", () => {
  it("exposes managed cover and icon IDs to learners without editorial fields", () => {
    const system = {
      id: crypto.randomUUID(),
      name: "Circulatory",
      slug: "circulatory",
      shortDescription: "Blood circulation.",
      longDescription: null,
      coverImageUrl: null,
      iconImageUrl: null,
      coverMediaId: crypto.randomUUID(),
      iconMediaId: crypto.randomUUID(),
      displayOrder: 1,
      isActive: true,
      status: "PUBLISHED",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      trashedAt: null,
      purgeAfter: null,
      purgeAttemptCount: 0,
      nextPurgeAttemptAt: null,
    } as OrganSystem;

    expect(organSystemDto(system)).toMatchObject({
      coverMediaId: system.coverMediaId,
      iconMediaId: system.iconMediaId,
    });
    expect(organSystemDto(system)).not.toHaveProperty("status");
  });
});

describe("lessonDto", () => {
  it("projects stored lesson blocks with stable IDs", () => {
    const lesson = {
      id: crypto.randomUUID(),
      topicId: crypto.randomUUID(),
      title: "Sample heart overview",
      slug: "sample-heart-overview",
      summary: "Demonstration lesson.",
      contentBlocks: [
        { id: "sample-heading", type: "heading", level: 2, text: "Heart overview" },
        { id: "sample-paragraph", type: "paragraph", text: "Structured educational text." },
      ],
      estimatedReadingMinutes: 2,
      displayOrder: 1,
      status: "DRAFT",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      trashedAt: null,
      purgeAfter: null,
      nextPurgeAttemptAt: null,
    } as ContentLesson;

    expect(lessonDto(lesson).contentBlocks).toEqual(lesson.contentBlocks);
  });

  it("downconverts rich storage for learners and exposes the validated AST only to admins", () => {
    const mediaId = crypto.randomUUID();
    const richContent = {
      type: "doc",
      content: [
        { type: "paragraph", attrs: { textAlign: "center" }, content: [{ type: "text", text: "Formatted heart", marks: [{ type: "bold" }] }] },
        { type: "image", attrs: { mediaId, alt: "Heart", caption: null, legacyId: "heart-image" } },
      ],
    };
    const fallbackBlocks = [
      { type: "paragraph", text: "Formatted heart" },
      { id: "heart-image", type: "image", mediaId, altText: "Heart", caption: null },
    ];
    const lesson = {
      id: crypto.randomUUID(), topicId: crypto.randomUUID(), title: "Rich lesson", slug: "rich-lesson", summary: null,
      contentBlocks: { version: 2, richContent, fallbackBlocks }, estimatedReadingMinutes: 3, displayOrder: 0,
      status: "DRAFT", createdAt: new Date(), updatedAt: new Date(), trashedAt: null, purgeAfter: null, nextPurgeAttemptAt: null,
    } as unknown as ContentLesson;

    expect(lessonDto(lesson)).toMatchObject({ contentBlocks: fallbackBlocks });
    expect(lessonDto(lesson)).not.toHaveProperty("richContent");
    expect(lessonDto(lesson, true)).toMatchObject({ contentBlocks: fallbackBlocks, richContent });
  });
});

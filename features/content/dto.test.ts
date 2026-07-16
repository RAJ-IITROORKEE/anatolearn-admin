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
});

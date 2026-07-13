import type { ContentLesson } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { lessonDto } from "./dto";

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
    } as ContentLesson;

    expect(lessonDto(lesson).contentBlocks).toEqual(lesson.contentBlocks);
  });
});

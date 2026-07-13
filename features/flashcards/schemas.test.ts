import { describe, expect, it } from "vitest";

import {
  flashcardBulkStatusSchema,
  flashcardCreateSchema,
  flashcardListQuerySchema,
  flashcardProgressSchema,
  flashcardReorderSchema,
  flashcardUpdateSchema,
} from "./schemas";

const topicId = crypto.randomUUID();

describe("flashcard schemas", () => {
  it("accepts a complete create request and rejects server-controlled fields", () => {
    const input = {
      topicId,
      frontText: "Which chamber pumps blood to the body?",
      backText: "The left ventricle.",
      frontMediaId: crypto.randomUUID(),
      backMediaId: null,
      difficulty: "MEDIUM",
      notes: "Review ventricular anatomy.",
      displayOrder: 0,
    };
    expect(flashcardCreateSchema.safeParse(input).success).toBe(true);
    expect(flashcardCreateSchema.safeParse({ ...input, status: "PUBLISHED" }).success).toBe(false);
    expect(flashcardUpdateSchema.safeParse({}).success).toBe(false);
  });

  it("strictly validates pagination, filters, and sorting", () => {
    expect(flashcardListQuerySchema.parse({ topicId, page: "2", pageSize: "50", difficulty: "HARD", sortBy: "frontText", sortOrder: "desc" })).toMatchObject({ page: 2, pageSize: 50 });
    expect(flashcardListQuerySchema.safeParse({ pageSize: "101" }).success).toBe(false);
    expect(flashcardListQuerySchema.safeParse({ sortBy: "status" }).success).toBe(false);
    expect(flashcardListQuerySchema.safeParse({ unexpected: "value" }).success).toBe(false);
  });

  it("requires unique scoped reorder and bulk IDs", () => {
    const id = crypto.randomUUID();
    expect(flashcardReorderSchema.safeParse({ parentId: topicId, ids: [id, id] }).success).toBe(false);
    expect(flashcardBulkStatusSchema.safeParse({ ids: [id, id], status: "PUBLISHED" }).success).toBe(false);
    expect(flashcardBulkStatusSchema.safeParse({ ids: [id], status: "PUBLISHED" }).success).toBe(true);
  });

  it("requires an event ID and accepts only progress flags", () => {
    const eventId = crypto.randomUUID();
    expect(flashcardProgressSchema.safeParse({ eventId, isDifficult: true, isMastered: false }).success).toBe(true);
    expect(flashcardProgressSchema.safeParse({ isDifficult: true }).success).toBe(false);
    expect(flashcardProgressSchema.safeParse({ eventId, viewedCount: 20 }).success).toBe(false);
  });
});

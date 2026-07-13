import { describe, expect, it } from "vitest";

import {
  questionBulkStatusSchema,
  questionCreateSchema,
  questionListSchema,
  questionUpdateSchema,
} from "./schemas";

const option = (isCorrect = false) => ({ optionText: "An option", isCorrect });
const validQuestion = {
  topicId: crypto.randomUUID(),
  assessmentType: "QUIZ" as const,
  questionText: "Which structure is shown?",
  explanation: "The named structure has the illustrated relationship.",
  difficulty: "MEDIUM" as const,
  options: [option(true), option(false)],
};

describe("question schemas", () => {
  it("accepts only two through six options with exactly one correct", () => {
    expect(questionCreateSchema.safeParse(validQuestion).success).toBe(true);
    expect(questionCreateSchema.safeParse({ ...validQuestion, options: [option(true)] }).success).toBe(false);
    expect(questionCreateSchema.safeParse({ ...validQuestion, options: Array.from({ length: 7 }, (_, index) => option(index === 0)) }).success).toBe(false);
    expect(questionCreateSchema.safeParse({ ...validQuestion, options: [option(), option()] }).success).toBe(false);
    expect(questionCreateSchema.safeParse({ ...validQuestion, options: [option(true), option(true)] }).success).toBe(false);
  });

  it("keeps labels, order, keys, lifecycle, and activity server-owned", () => {
    for (const field of ["label", "displayOrder", "key"] as const) {
      expect(questionCreateSchema.safeParse({
        ...validQuestion,
        options: [{ ...option(true), [field]: field === "displayOrder" ? 0 : "A" }, option()],
      }).success).toBe(false);
    }
    expect(questionCreateSchema.safeParse({ ...validQuestion, status: "PUBLISHED" }).success).toBe(false);
    expect(questionUpdateSchema.safeParse({ isActive: false }).success).toBe(false);
  });

  it("permits existing option IDs only as replacement identity hints", () => {
    expect(questionUpdateSchema.safeParse({ options: [
      { id: crypto.randomUUID(), ...option(true) },
      { id: crypto.randomUUID(), ...option(false) },
    ] }).success).toBe(true);
  });

  it("validates filters and unique bulk IDs", () => {
    expect(questionListSchema.safeParse({ assessmentType: "QUIZ", isActive: "false", pageSize: "100" }).success).toBe(true);
    expect(questionListSchema.safeParse({ pageSize: "101" }).success).toBe(false);
    const id = crypto.randomUUID();
    expect(questionBulkStatusSchema.safeParse({ ids: [id, id], status: "PUBLISHED" }).success).toBe(false);
  });
});

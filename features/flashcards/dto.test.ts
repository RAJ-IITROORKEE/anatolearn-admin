import { describe, expect, it } from "vitest";

import { flashcardDto } from "./dto";

const now = new Date("2026-07-13T00:00:00.000Z");
const card = {
  id: "20000000-0000-4000-8000-000000000002",
  topicId: "10000000-0000-4000-8000-000000000001",
  frontText: "Front",
  backText: "Back",
  frontImageUrl: null,
  frontMediaId: null,
  backImageUrl: null,
  backMediaId: null,
  difficulty: "MEDIUM" as const,
  notes: "Editorial guidance for administrators only.",
  displayOrder: 0,
  status: "PUBLISHED" as const,
  createdAt: now,
  updatedAt: now,
};

describe("flashcard DTO", () => {
  it("retains notes for administrators", () => {
    expect(flashcardDto(card, true)).toMatchObject({ notes: card.notes, status: "PUBLISHED" });
  });

  it("does not expose editorial notes to learners", () => {
    expect(flashcardDto(card)).not.toHaveProperty("notes");
  });
});

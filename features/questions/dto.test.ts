import type { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { questionDto } from "./dto";

const question = {
  id: crypto.randomUUID(), topicId: crypto.randomUUID(), assessmentType: "TEST",
  questionText: "Question", imageUrl: null, mediaId: null, explanation: "Explanation",
  difficulty: "HARD", conceptTag: null, status: "DRAFT", isActive: true,
  createdAt: new Date(), updatedAt: new Date(),
  topic: { title: "Cardiac chambers" },
  options: [
    { id: crypto.randomUUID(), questionId: "question", key: crypto.randomUUID(), label: "A", displayOrder: 1, optionText: "One", imageUrl: null, mediaId: null, isCorrect: true, createdAt: new Date(), updatedAt: new Date() },
    { id: crypto.randomUUID(), questionId: "question", key: crypto.randomUUID(), label: "B", displayOrder: 2, optionText: "Two", imageUrl: null, mediaId: null, isCorrect: false, createdAt: new Date(), updatedAt: new Date() },
  ],
} as unknown as Prisma.QuestionGetPayload<{ include: { options: true } }> & { topic: { title: string } };

describe("question DTO", () => {
  it("returns ordered admin option metadata", () => {
    expect(questionDto(question).topicTitle).toBe("Cardiac chambers");
    expect(questionDto(question).options.map((option) => ({ label: option.label, key: option.key, isCorrect: option.isCorrect }))).toEqual([
      { label: "A", key: question.options[0].key, isCorrect: true },
      { label: "B", key: question.options[1].key, isCorrect: false },
    ]);
  });

  it("rejects malformed stored option sets", () => {
    expect(() => questionDto({ ...question, options: question.options.slice(0, 1) })).toThrow("invalid options");
  });
});

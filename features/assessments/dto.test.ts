import { describe, expect, it } from "vitest";

import { attemptDetailDto, attemptListItemDto, attemptResultDto } from "./dto";

const attempt = {
  id: "attempt", assessmentType: "TEST" as const, organSystemId: "system", requestedQuestionCount: 1,
  totalQuestionCount: 1, correctCount: 1, incorrectCount: 0, unansweredCount: 0, scorePercentage: { toString: () => "100" },
  durationSeconds: 10, timeLimitSeconds: 60, startedAt: new Date(), expiresAt: new Date(), completedAt: null,
  status: "IN_PROGRESS" as const, retakeSourceId: null,
  topics: [{ topicId: "topic" }],
  questions: [{
    id: "aq", displayOrder: 1, questionTextSnapshot: "Prompt", imageUrlSnapshot: null, mediaIdSnapshot: null,
    explanationSnapshot: "Secret explanation", optionsSnapshot: [
      { key: "key", label: "A", displayOrder: 1, optionText: "Answer", imageUrl: null, mediaId: null },
      { key: "other", label: "B", displayOrder: 2, optionText: "Other", imageUrl: null, mediaId: null },
    ],
    correctOptionKey: "key", answeredOptionKey: "key", isCorrect: true, answeredAt: new Date(), timeSpentSeconds: 2,
    topicIdSnapshot: "topic", topicTitleSnapshot: "Topic", difficultySnapshot: "EASY" as const,
    conceptTagSnapshot: null, organSystemIdSnapshot: "system", organSystemNameSnapshot: "System",
  }],
};

describe("attempt DTO privacy", () => {
  it("hides result secrets for active attempts", () => {
    const dto = attemptDetailDto(attempt);
    expect(dto).not.toHaveProperty("scorePercentage");
    expect(dto.questions[0]).not.toHaveProperty("correctOptionKey");
    expect(dto.questions[0]).not.toHaveProperty("isCorrect");
    expect(dto.questions[0]).not.toHaveProperty("explanation");
  });

  it("returns snapshot results only after terminal submission", () => {
    for (const status of ["COMPLETED", "AUTO_SUBMITTED"] as const) {
      const dto = attemptResultDto({ ...attempt, status, completedAt: new Date() });
      expect(dto.scorePercentage).toBe(100);
      expect(dto.questions[0]).toMatchObject({ correctOptionKey: "key", isCorrect: true, explanation: "Secret explanation" });
    }
  });

  it("rejects results for in-progress and abandoned attempts", () => {
    for (const status of ["IN_PROGRESS", "ABANDONED"] as const) {
      expect(() => attemptResultDto({ ...attempt, status })).toThrow(expect.objectContaining({ code: "RESULT_NOT_READY", status: 409 }));
    }
  });

  it("exposes list scores only for submitted statuses", () => {
    const listAttempt = { ...attempt };
    for (const status of ["IN_PROGRESS", "ABANDONED"] as const) {
      const dto = attemptListItemDto({ ...listAttempt, status });
      expect(dto).not.toHaveProperty("scorePercentage");
      expect(dto).not.toHaveProperty("correctCount");
    }
    for (const status of ["COMPLETED", "AUTO_SUBMITTED"] as const) {
      expect(attemptListItemDto({ ...listAttempt, status })).toMatchObject({ scorePercentage: 100, correctCount: 1 });
    }
  });

  it("keeps detail secret-safe for every status", () => {
    for (const status of ["IN_PROGRESS", "COMPLETED", "AUTO_SUBMITTED", "ABANDONED"] as const) {
      const dto = attemptDetailDto({ ...attempt, status });
      expect(dto).not.toHaveProperty("scorePercentage");
      expect(dto.questions[0]).not.toHaveProperty("correctOptionKey");
      expect(dto.questions[0]).not.toHaveProperty("explanation");
    }
  });
});

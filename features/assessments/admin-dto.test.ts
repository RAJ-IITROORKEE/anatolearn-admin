import { describe, expect, it } from "vitest";

import { adminAttemptDetailDto } from "./admin-dto";

const question = {
  id: "question", displayOrder: 1, questionTextSnapshot: "Snapshot prompt", imageUrlSnapshot: null, mediaIdSnapshot: null,
  explanationSnapshot: "Secret explanation", optionsSnapshot: [
    { key: "a", label: "A", displayOrder: 1, optionText: "One", imageUrl: null, mediaId: null },
    { key: "b", label: "B", displayOrder: 2, optionText: "Two", imageUrl: null, mediaId: null },
  ], correctOptionKey: "a", answeredOptionKey: "b", isCorrect: false, answeredAt: new Date(), timeSpentSeconds: 2,
  topicIdSnapshot: "topic", topicTitleSnapshot: "Historical topic", difficultySnapshot: "EASY" as const,
  conceptTagSnapshot: null, organSystemIdSnapshot: "system", organSystemNameSnapshot: "Historical system",
};
const attempt = {
  id: "attempt", assessmentType: "QUIZ" as const, organSystemId: "system", requestedQuestionCount: 1, totalQuestionCount: 1,
  correctCount: 0, incorrectCount: 1, unansweredCount: 0, scorePercentage: 0, durationSeconds: 5, timeLimitSeconds: null,
  startedAt: new Date(), expiresAt: null, completedAt: null, status: "IN_PROGRESS" as const, retakeSourceId: null,
  topics: [{ topicId: "current-topic" }], questions: [question], user: { id: "user", fullName: "Learner", email: "learner@example.com", isActive: true },
};

describe("admin attempt detail disclosure", () => {
  it("uses snapshots but hides answer keys, explanations, and scores before submission", () => {
    const dto = adminAttemptDetailDto(attempt);
    expect(dto.questions[0]).toMatchObject({ questionText: "Snapshot prompt", topicTitle: "Historical topic" });
    expect(dto.questions[0]).not.toHaveProperty("correctOptionKey");
    expect(dto.questions[0]).not.toHaveProperty("explanation");
    expect(dto).not.toHaveProperty("scorePercentage");
  });

  it("exposes immutable scoring fields for submitted attempts", () => {
    const dto = adminAttemptDetailDto({ ...attempt, status: "COMPLETED", completedAt: new Date() });
    expect(dto.questions[0]).toMatchObject({ correctOptionKey: "a", explanation: "Secret explanation", isCorrect: false });
    expect(dto).toMatchObject({ scorePercentage: 0, user: { email: "learner@example.com" } });
  });
});

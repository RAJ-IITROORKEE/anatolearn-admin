import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  getEligibleQuestions: vi.fn(),
  refreshTopicProgress: vi.fn(),
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("@/features/questions/selection-service", () => ({ getEligibleQuestions: mocks.getEligibleQuestions }));
vi.mock("@/features/progress/projection", () => ({ refreshTopicProgressPairs: mocks.refreshTopicProgress }));

import { getAttemptResult, retakeAttempt, submitAttempt, updateAttemptAnswer } from "./service";

const now = new Date("2026-01-01T00:01:00Z");
const active = {
  id: "10000000-0000-4000-8000-000000000001", userId: "20000000-0000-4000-8000-000000000001",
  assessmentType: "TEST" as const, organSystemId: "30000000-0000-4000-8000-000000000001",
  requestedQuestionCount: 1, totalQuestionCount: 1, correctCount: 0, incorrectCount: 0, unansweredCount: 1,
  scorePercentage: { toString: () => "0" }, durationSeconds: null, timeLimitSeconds: 60,
  startedAt: new Date("2026-01-01T00:00:00Z"), expiresAt: now, completedAt: null,
  status: "IN_PROGRESS" as const, retakeSourceId: null, createdAt: new Date(), updatedAt: new Date(),
  topics: [{ attemptId: "attempt", topicId: "topic" }],
  questions: [{
    id: "40000000-0000-4000-8000-000000000001", attemptId: "attempt", sourceQuestionId: null,
    sourceQuestionSnapshotId: "50000000-0000-4000-8000-000000000001", displayOrder: 1,
    questionTextSnapshot: "Historical prompt", imageUrlSnapshot: null, mediaIdSnapshot: null, explanationSnapshot: "Historical explanation",
    optionsSnapshot: [
      { key: "60000000-0000-4000-8000-000000000001", label: "A", displayOrder: 1, optionText: "Correct", imageUrl: null, mediaId: null },
      { key: "60000000-0000-4000-8000-000000000002", label: "B", displayOrder: 2, optionText: "Wrong", imageUrl: null, mediaId: null },
    ],
    correctOptionKey: "60000000-0000-4000-8000-000000000001", answeredOptionKey: "60000000-0000-4000-8000-000000000001",
    isCorrect: true, answeredAt: new Date(), timeSpentSeconds: 20, topicIdSnapshot: "70000000-0000-4000-8000-000000000001",
    topicTitleSnapshot: "Historical topic", difficultySnapshot: "EASY" as const, conceptTagSnapshot: null,
    organSystemIdSnapshot: "30000000-0000-4000-8000-000000000001", organSystemNameSnapshot: "Historical system",
    createdAt: new Date(), updatedAt: new Date(),
  }],
};
const terminal = { ...active, status: "AUTO_SUBMITTED" as const, correctCount: 1, unansweredCount: 0, scorePercentage: { toString: () => "100" }, durationSeconds: 60, completedAt: now };

function transactionClient() {
  return {
    $queryRaw: vi.fn(),
    assessmentAttempt: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    attemptQuestion: { update: vi.fn() },
    topic: { findMany: vi.fn() },
  };
}

function transactionError() {
  return new Prisma.PrismaClientKnownRequestError("transaction conflict", { code: "P2034", clientVersion: "test" });
}

describe("assessment service lifecycle", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns terminal submission replays unchanged without duplicate effects", async () => {
    for (const status of ["COMPLETED", "AUTO_SUBMITTED"] as const) {
      const tx = transactionClient();
      tx.$queryRaw.mockResolvedValue([{ id: active.id }]);
      tx.assessmentAttempt.findUnique.mockResolvedValue({ ...terminal, status });
      mocks.transaction.mockImplementationOnce((callback: (client: typeof tx) => unknown) => callback(tx));
      const result = await submitAttempt(active.id, active.userId);
      expect(result).toMatchObject({ status, scorePercentage: 100 });
      expect(tx.assessmentAttempt.update).not.toHaveBeenCalled();
      expect(tx.attemptQuestion.update).not.toHaveBeenCalled();
    }
    expect(mocks.refreshTopicProgress).not.toHaveBeenCalled();
  });

  it("makes absent and other-user attempts the same not-found outcome", async () => {
    const tx = transactionClient();
    tx.$queryRaw.mockResolvedValue([]);
    mocks.transaction.mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));
    await expect(submitAttempt(active.id, "another-user")).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
    expect(tx.assessmentAttempt.findUnique).not.toHaveBeenCalled();
  });

  it("commits auto-submission before reporting an expired answer outcome", async () => {
    const tx = transactionClient();
    tx.$queryRaw.mockResolvedValueOnce([{ id: active.id }]).mockResolvedValueOnce([{ now }]);
    tx.assessmentAttempt.findUnique.mockResolvedValueOnce(active).mockResolvedValueOnce(terminal);
    tx.assessmentAttempt.update.mockResolvedValue(terminal);
    tx.attemptQuestion.update.mockResolvedValue(active.questions[0]);
    mocks.transaction.mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));
    await expect(updateAttemptAnswer(active.id, active.questions[0].id, active.userId, { answeredOptionKey: null })).rejects.toMatchObject({ code: "ATTEMPT_EXPIRED" });
    expect(tx.assessmentAttempt.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "AUTO_SUBMITTED", durationSeconds: 60 }) }));
    const clockQuery = tx.$queryRaw.mock.calls[1][0] as { strings: string[] };
    expect(clockQuery.strings.join(" ")).toContain("clock_timestamp()");
  });

  it("builds results from immutable snapshots rather than current source content", async () => {
    const tx = transactionClient();
    tx.$queryRaw.mockResolvedValueOnce([{ id: active.id }]).mockResolvedValueOnce([{ now: new Date("2026-01-01T00:00:30Z") }]);
    tx.assessmentAttempt.findUnique.mockResolvedValueOnce({ ...active, assessmentType: "QUIZ", expiresAt: null, timeLimitSeconds: null })
      .mockResolvedValueOnce({ ...terminal, assessmentType: "QUIZ", status: "COMPLETED", expiresAt: null, timeLimitSeconds: null, durationSeconds: 30 });
    tx.assessmentAttempt.update.mockResolvedValue(terminal);
    tx.attemptQuestion.update.mockResolvedValue(active.questions[0]);
    mocks.transaction.mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));
    const result = await submitAttempt(active.id, active.userId);
    expect(result.questions[0]).toMatchObject({ questionText: "Historical prompt", explanation: "Historical explanation", correctOptionKey: active.questions[0].correctOptionKey });
    expect(mocks.getEligibleQuestions).not.toHaveBeenCalled();
    expect(mocks.refreshTopicProgress).toHaveBeenCalledWith(tx, [{ userId: active.userId, topicId: active.questions[0].topicIdSnapshot }]);
  });

  it("rejects abandoned submit, result, and retake operations", async () => {
    for (const operation of [submitAttempt, getAttemptResult, retakeAttempt]) {
      const tx = transactionClient();
      tx.$queryRaw.mockResolvedValue([{ id: active.id }]);
      tx.assessmentAttempt.findUnique.mockResolvedValue({ ...terminal, status: "ABANDONED" });
      mocks.transaction.mockImplementationOnce((callback: (client: typeof tx) => unknown) => callback(tx));
      await expect(operation(active.id, active.userId)).rejects.toMatchObject({ code: expect.stringMatching(/^(ATTEMPT_NOT_SUBMITTED|RESULT_NOT_READY|SOURCE_NOT_SUBMITTED)$/), status: 409 });
    }
  });

  it("rejects an unexpired in-progress retake", async () => {
    const tx = transactionClient();
    tx.$queryRaw.mockResolvedValueOnce([{ id: active.id }]).mockResolvedValueOnce([{ now: new Date("2025-12-31T23:59:59Z") }]);
    tx.assessmentAttempt.findUnique.mockResolvedValue(active);
    mocks.transaction.mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));
    await expect(retakeAttempt(active.id, active.userId)).rejects.toMatchObject({ code: "SOURCE_NOT_SUBMITTED", status: 409 });
    expect(tx.assessmentAttempt.create).not.toHaveBeenCalled();
  });

  it("lazily auto-submits an expired test and creates its retake", async () => {
    const tx = transactionClient();
    const retake = { ...active, id: "90000000-0000-4000-8000-000000000001", retakeSourceId: active.id };
    tx.$queryRaw
      .mockResolvedValueOnce([{ id: active.id }])
      .mockResolvedValueOnce([{ now }])
      .mockResolvedValueOnce([{ id: active.organSystemId }])
      .mockResolvedValueOnce([{ id: active.topics[0].topicId }])
      .mockResolvedValueOnce([{ id: active.questions[0].sourceQuestionSnapshotId }])
      .mockResolvedValueOnce([{ now }]);
    tx.assessmentAttempt.findUnique.mockResolvedValueOnce(active).mockResolvedValueOnce(terminal);
    tx.assessmentAttempt.update.mockResolvedValue(terminal);
    tx.attemptQuestion.update.mockResolvedValue(active.questions[0]);
    tx.topic.findMany.mockResolvedValue([{ id: active.topics[0].topicId }]);
    tx.assessmentAttempt.create.mockResolvedValue(retake);
    mocks.getEligibleQuestions.mockResolvedValue([{
      id: active.questions[0].sourceQuestionSnapshotId, questionText: "Fresh prompt", imageUrl: null, mediaId: null,
      explanation: "Fresh explanation", difficulty: "EASY", conceptTag: null, topicId: active.topics[0].topicId,
      topic: { title: "Topic", organSystem: { id: active.organSystemId, name: "System" } },
      options: [{ optionText: "Correct", imageUrl: null, mediaId: null, isCorrect: true }, { optionText: "Wrong", imageUrl: null, mediaId: null, isCorrect: false }],
    }]);
    mocks.transaction.mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));
    const result = await retakeAttempt(active.id, active.userId, () => 0);
    expect(result).toMatchObject({ id: retake.id, retakeSourceId: active.id, status: "IN_PROGRESS" });
    expect(tx.assessmentAttempt.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "AUTO_SUBMITTED" }) }));
    expect(tx.assessmentAttempt.create).toHaveBeenCalledOnce();
  });

  it("maps exhausted serialization retries to a safe conflict", async () => {
    mocks.transaction.mockRejectedValue(transactionError());
    await expect(submitAttempt(active.id, active.userId)).rejects.toMatchObject({ code: "TRANSACTION_FAILED", status: 409 });
    expect(mocks.transaction).toHaveBeenCalledTimes(3);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  queryRaw: vi.fn(),
  profileFindMany: vi.fn(),
  feedbackFindMany: vi.fn(),
  auditLogFindMany: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: { $transaction: mocks.transaction },
}));

import { getAdminDashboard } from "./service";

describe("admin dashboard service", () => {
  afterEach(() => vi.useRealTimers());

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation((callback: (tx: unknown) => unknown) => callback({
      $queryRaw: mocks.queryRaw,
      profile: { findMany: mocks.profileFindMany },
      feedback: { findMany: mocks.feedbackFindMany },
      auditLog: { findMany: mocks.auditLogFindMany },
    }));
    mocks.queryRaw
      .mockResolvedValueOnce([{
        totalUsers: 4, activeUsers: 3, organSystems: 2, topics: 6, flashcards: 8,
        questions: 10, publishedLessons: 5, quizQuestions: 4, testQuestions: 6,
        newFeedback: 2, completedQuizzes: 2, completedTests: 1,
        quizCorrect: 3, quizQuestionsAnswered: 5, testCorrect: 0, testQuestionsAnswered: 0,
      }])
      .mockResolvedValueOnce([{
        id: "system", name: "Cardiovascular", displayOrder: 1, topicCount: 2,
        readyTopicCount: 1, lessonTopicCount: 2, flashcardTopicCount: 1,
        quizTopicCount: 1, testTopicCount: 1,
      }])
      .mockResolvedValueOnce([
        { day: new Date("2026-07-14T00:00:00.000Z"), quizAttempts: 1, testAttempts: 1 },
      ]);
    mocks.profileFindMany.mockResolvedValue([]);
    mocks.feedbackFindMany.mockResolvedValue([]);
    mocks.auditLogFindMany.mockResolvedValue([]);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-14T15:30:00.000Z"));
  });

  it("returns weighted immutable-question accuracy, zero-filled trends, and readiness metrics", async () => {
    const result = await getAdminDashboard({ days: 7 });

    expect(result.generatedAt).toEqual(new Date("2026-07-14T15:30:00.000Z"));
    expect(result.range).toEqual({
      days: 7,
      start: new Date("2026-07-08T00:00:00.000Z"),
      endExclusive: new Date("2026-07-15T00:00:00.000Z"),
    });
    expect(result.accuracy.quiz).toEqual({ numerator: 3, denominator: 5, percentage: 60 });
    expect(result.accuracy.test).toEqual({ numerator: 0, denominator: 0, percentage: 0 });
    expect(result.attemptsTrend).toHaveLength(7);
    expect(result.attemptsTrend[0]).toEqual({ date: "2026-07-08", quizAttempts: 0, testAttempts: 0 });
    expect(result.attemptsTrend[6]).toEqual({ date: "2026-07-14", quizAttempts: 1, testAttempts: 1 });
    expect(result.contentReadinessCriteria.denominator).toBe("NON_ARCHIVED_TOPICS");
    expect(result.contentReadinessCriteria.completeTopicRequires).toHaveLength(5);
    expect(result.contentCompleteness[0]).toMatchObject({
      completeTopics: { numerator: 1, denominator: 2, percentage: 50 },
      lessons: { numerator: 2, denominator: 2, percentage: 100 },
    });
  });

  it("counts auto-submitted attempts and questions in the SQL aggregates", async () => {
    await getAdminDashboard({ days: 30 });
    const sql = mocks.queryRaw.mock.calls[0][0].strings.join(" ");
    const trendSql = mocks.queryRaw.mock.calls[2][0].strings.join(" ");
    expect(sql).toContain("AUTO_SUBMITTED");
    expect(sql).toContain("AttemptQuestion");
    expect(trendSql).toContain("AUTO_SUBMITTED");
    expect(trendSql).toContain("completedAt");
  });

  it("uses bounded explicit projections for recent activity", async () => {
    await getAdminDashboard({ days: 30 });
    expect(mocks.profileFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 5, select: expect.any(Object) }));
    expect(mocks.feedbackFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 5, select: expect.any(Object) }));
    expect(mocks.auditLogFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 10, select: expect.any(Object) }));
    expect(mocks.auditLogFindMany.mock.calls[0][0].select).not.toHaveProperty("beforeSnapshot");
    expect(mocks.auditLogFindMany.mock.calls[0][0].select).not.toHaveProperty("afterSnapshot");
  });

  it("excludes trashed feedback from the NEW aggregate and recent activity", async () => {
    await getAdminDashboard({ days: 30 });

    const summarySql = mocks.queryRaw.mock.calls[0][0].strings.join(" ");
    expect(summarySql).toMatch(/FROM "Feedback" WHERE "status" = 'NEW'::"FeedbackStatus" AND "trashedAt" IS NULL/);
    expect(mocks.feedbackFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { trashedAt: null },
      take: 5,
    }));
  });
});

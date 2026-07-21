import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  organSystemFindMany: vi.fn(),
  attemptFindMany: vi.fn(),
  profileFindUnique: vi.fn(),
  queryRaw: vi.fn(),
  expireDueAttempts: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    profile: { findUnique: mocks.profileFindUnique },
  },
}));
vi.mock("@/features/assessments/finalization-service", () => ({ expireDueAttempts: mocks.expireDueAttempts }));

import { getUserDashboard, getUserProgress } from "./service";

const systems = [{
  id: "system", name: "Current system", slug: "current-system", displayOrder: 1,
  topics: [{
    id: "topic", title: "Current title", slug: "current-topic", displayOrder: 1,
    lessons: [
      { id: "lesson-1", progress: [{ completedAt: new Date() }] },
      { id: "lesson-2", progress: [] },
    ],
    flashcards: [
      { id: "card-1", progress: [{ isMastered: true }] },
      { id: "card-2", progress: [{ isMastered: false }] },
    ],
    questions: [
      { assessmentType: "QUIZ", media: null, options: [{ isCorrect: true, media: null }, { isCorrect: false, media: null }] },
      { assessmentType: "TEST", media: null, options: [{ isCorrect: true, media: null }, { isCorrect: false, media: null }] },
    ],
  }],
}];

const aggregate = {
  totalAttempts: 1, quizAttempts: 1, testAttempts: 0, autoSubmittedAttempts: 0,
  correctCount: 1, sampleCount: 2,
  topicStats: [
    { topicId: "topic", topicTitle: "Historical title", organSystemId: "system", assessmentType: "QUIZ", correctCount: 1, sampleCount: 2 },
    { topicId: "topic", topicTitle: "Wrong system snapshot", organSystemId: "other-system", assessmentType: "QUIZ", correctCount: 1, sampleCount: 1 },
  ],
  activityStats: [
    { topicId: "topic", organSystemId: "system", assessmentType: "QUIZ", available: 1, seen: 1, correct: 1 },
  ],
  asOf: new Date("2026-07-13T00:02:00Z"),
};
const recent = [{
  id: "attempt", assessmentType: "QUIZ", status: "COMPLETED", startedAt: new Date("2026-07-13T00:00:00Z"),
  completedAt: new Date("2026-07-13T00:01:00Z"), durationSeconds: 60, scorePercentage: 50,
  correctCount: 1, incorrectCount: 0, unansweredCount: 1, totalQuestionCount: 2,
  questions: [{ organSystemIdSnapshot: "system", organSystemNameSnapshot: "Historical system" }],
}];

describe("authoritative progress service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.expireDueAttempts.mockResolvedValue({ claimed: 0, finalized: 0 });
    mocks.organSystemFindMany.mockResolvedValue(systems);
    mocks.queryRaw.mockResolvedValue([aggregate]);
    mocks.attemptFindMany.mockResolvedValue(recent);
    mocks.transaction.mockImplementation((callback: (client: unknown) => unknown) => callback({
      $queryRaw: mocks.queryRaw,
      organSystem: { findMany: mocks.organSystemFindMany },
      assessmentAttempt: { findMany: mocks.attemptFindMany },
    }));
  });

  it("weights eligible denominators and attributes snapshots by both topic and organ system", async () => {
    const result = await getUserProgress("user");
    expect(result[0].topics[0]).toMatchObject({
      content: { numerator: 1, denominator: 2, percentage: 50 },
      flashcards: { numerator: 1, denominator: 2, percentage: 50 },
      quiz: { numerator: 1, denominator: 2, percentage: 50 },
      test: { numerator: 0, denominator: 0, percentage: 0 },
      inventory: { lessons: 2, flashcards: 2, quizQuestions: 1, testQuestions: 1 },
      activity: { quiz: { distinctCurrentQuestionsSeen: 1, available: 1, latestAnswerCorrect: 1 } },
    });
    expect(mocks.expireDueAttempts).toHaveBeenCalledWith({ limit: 50, userId: "user" });
  });

  it("returns indistinguishable not found for an inaccessible system", async () => {
    mocks.organSystemFindMany.mockResolvedValue([]);
    await expect(getUserProgress("user", "missing")).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });

  it("loads history aggregates once and bounds recent attempts to ten", async () => {
    const dashboard = await getUserDashboard("user");
    expect(dashboard.attempts).toEqual({ total: 1, quiz: 1, test: 0, autoSubmitted: 0 });
    expect(dashboard.accuracy).toEqual({ numerator: 1, denominator: 2, percentage: 50 });
    expect(dashboard.recentAttempts[0]).toMatchObject({ id: "attempt", organSystemName: "Historical system" });
    expect(mocks.queryRaw).toHaveBeenCalledOnce();
    expect(mocks.attemptFindMany).toHaveBeenCalledOnce();
    expect(mocks.attemptFindMany.mock.calls[0][0]).toMatchObject({ take: 10 });
  });

  it("filters only server-ranked strengths and weaknesses while retaining global dashboard data", async () => {
    const filteredAggregate = {
      ...aggregate,
      topicStats: [
        { topicId: "topic", topicTitle: "Current system topic", organSystemId: "system", assessmentType: "QUIZ", correctCount: 5, sampleCount: 5 },
        { topicId: "other-topic", topicTitle: "Other system topic", organSystemId: "other-system", assessmentType: "QUIZ", correctCount: 0, sampleCount: 5 },
      ],
    };
    mocks.queryRaw.mockResolvedValue([filteredAggregate]);
    const dashboard = await getUserDashboard("user", "system");
    expect(dashboard.attempts.total).toBe(1);
    expect(dashboard.recentAttempts).toHaveLength(1);
    expect(dashboard.organSystems).toHaveLength(1);
    expect(dashboard.strengths).toEqual([expect.objectContaining({ topicTitle: "Current system topic" })]);
    expect(dashboard.weaknesses).toEqual([expect.objectContaining({ topicTitle: "Current system topic" })]);
  });

  it("hides an inaccessible dashboard ranking scope as not found", async () => {
    await expect(getUserDashboard("user", "missing-system")).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });

  it("queries latest terminal evidence once per current source question", async () => {
    await getUserProgress("user");
    const query = mocks.queryRaw.mock.calls[0][0].strings.join(" ");
    expect(query).toContain("current_eligible");
    expect(query).toContain("ROW_NUMBER() OVER (PARTITION BY eligible.\"id\"");
    expect(query).toContain("latest.rank = 1");
    expect(query).toContain("transaction_timestamp()");
  });

  it("reads inventory, activity, recent attempts, and asOf through one repeatable-read transaction client", async () => {
    await getUserDashboard("user");
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.transaction.mock.calls[0][1]).toEqual({ isolationLevel: "RepeatableRead" });
    expect(mocks.organSystemFindMany).toHaveBeenCalledOnce();
    expect(mocks.queryRaw).toHaveBeenCalledOnce();
    expect(mocks.attemptFindMany).toHaveBeenCalledOnce();
  });
});

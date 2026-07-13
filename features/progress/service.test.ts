import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  organSystemFindMany: vi.fn(),
  attemptFindMany: vi.fn(),
  profileFindUnique: vi.fn(),
  queryRaw: vi.fn(),
  expireDueAttempts: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $queryRaw: mocks.queryRaw,
    organSystem: { findMany: mocks.organSystemFindMany },
    assessmentAttempt: { findMany: mocks.attemptFindMany },
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
  }],
}];

const aggregate = {
  totalAttempts: 1, quizAttempts: 1, testAttempts: 0, autoSubmittedAttempts: 0,
  correctCount: 1, sampleCount: 2,
  topicStats: [
    { topicId: "topic", topicTitle: "Historical title", organSystemId: "system", assessmentType: "QUIZ", correctCount: 1, sampleCount: 2 },
    { topicId: "topic", topicTitle: "Wrong system snapshot", organSystemId: "other-system", assessmentType: "QUIZ", correctCount: 1, sampleCount: 1 },
  ],
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
  });

  it("weights eligible denominators and attributes snapshots by both topic and organ system", async () => {
    const result = await getUserProgress("user");
    expect(result[0].topics[0]).toMatchObject({
      content: { numerator: 1, denominator: 2, percentage: 50 },
      flashcards: { numerator: 1, denominator: 2, percentage: 50 },
      quiz: { numerator: 1, denominator: 2, percentage: 50 },
      test: { numerator: 0, denominator: 0, percentage: 0 },
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
});

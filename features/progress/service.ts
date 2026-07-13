import "server-only";

import { Prisma } from "@prisma/client";

import { expireDueAttempts } from "@/features/assessments/finalization-service";
import { prisma } from "@/lib/db/prisma";
import { metric, ProgressError, rankTopicPerformanceStats, type ProgressMetric } from "./domain";

type TopicStat = {
  topicId: string;
  topicTitle: string;
  organSystemId: string;
  assessmentType: "QUIZ" | "TEST";
  correctCount: number;
  sampleCount: number;
};
type AssessmentAggregate = {
  totalAttempts: number;
  quizAttempts: number;
  testAttempts: number;
  autoSubmittedAttempts: number;
  correctCount: number;
  sampleCount: number;
  topicStats: TopicStat[];
};

async function readAssessmentAggregate(userId: string): Promise<AssessmentAggregate> {
  const rows = await prisma.$queryRaw<Array<{
    totalAttempts: bigint | number;
    quizAttempts: bigint | number;
    testAttempts: bigint | number;
    autoSubmittedAttempts: bigint | number;
    correctCount: bigint | number;
    sampleCount: bigint | number;
    topicStats: Prisma.JsonValue;
  }>>(Prisma.sql`
    WITH submitted AS (
      SELECT * FROM "AssessmentAttempt"
      WHERE "userId" = ${userId}::uuid
        AND "status" IN ('COMPLETED'::"AttemptStatus", 'AUTO_SUBMITTED'::"AttemptStatus")
    ),
    topic_stats AS (
      SELECT question."topicIdSnapshot", question."topicTitleSnapshot",
        question."organSystemIdSnapshot", attempt."assessmentType",
        COUNT(question."id") FILTER (WHERE question."isCorrect" = true)::int AS "correctCount",
        COUNT(question."id")::int AS "sampleCount"
      FROM submitted attempt
      JOIN "AttemptQuestion" question ON question."attemptId" = attempt."id"
      GROUP BY question."topicIdSnapshot", question."topicTitleSnapshot",
        question."organSystemIdSnapshot", attempt."assessmentType"
    )
    SELECT
      COUNT(DISTINCT attempt."id")::int AS "totalAttempts",
      COUNT(DISTINCT attempt."id") FILTER (WHERE attempt."assessmentType" = 'QUIZ'::"AssessmentType")::int AS "quizAttempts",
      COUNT(DISTINCT attempt."id") FILTER (WHERE attempt."assessmentType" = 'TEST'::"AssessmentType")::int AS "testAttempts",
      COUNT(DISTINCT attempt."id") FILTER (WHERE attempt."status" = 'AUTO_SUBMITTED'::"AttemptStatus")::int AS "autoSubmittedAttempts",
      COUNT(question."id") FILTER (WHERE question."isCorrect" = true)::int AS "correctCount",
      COUNT(question."id")::int AS "sampleCount",
      COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'topicId', stats."topicIdSnapshot", 'topicTitle', stats."topicTitleSnapshot",
        'organSystemId', stats."organSystemIdSnapshot", 'assessmentType', stats."assessmentType",
        'correctCount', stats."correctCount", 'sampleCount', stats."sampleCount"
      )) FROM topic_stats stats), '[]'::jsonb) AS "topicStats"
    FROM submitted attempt
    LEFT JOIN "AttemptQuestion" question ON question."attemptId" = attempt."id"
  `);
  const row = rows[0];
  const topicStats = Array.isArray(row?.topicStats) ? row.topicStats as unknown as TopicStat[] : [];
  return {
    totalAttempts: Number(row?.totalAttempts ?? 0),
    quizAttempts: Number(row?.quizAttempts ?? 0),
    testAttempts: Number(row?.testAttempts ?? 0),
    autoSubmittedAttempts: Number(row?.autoSubmittedAttempts ?? 0),
    correctCount: Number(row?.correctCount ?? 0),
    sampleCount: Number(row?.sampleCount ?? 0),
    topicStats: topicStats.map((stat) => ({
      ...stat,
      correctCount: Number(stat.correctCount),
      sampleCount: Number(stat.sampleCount),
    })),
  };
}

function readSystems(userId: string, organSystemId?: string) {
  return prisma.organSystem.findMany({
    where: { id: organSystemId, status: "PUBLISHED", isActive: true },
    select: {
      id: true, name: true, slug: true, displayOrder: true,
      topics: {
        where: { status: "PUBLISHED" },
        select: {
          id: true, title: true, slug: true, displayOrder: true,
          lessons: {
            where: { status: "PUBLISHED" },
            select: { id: true, progress: { where: { userId, completedAt: { not: null } }, select: { completedAt: true }, take: 1 } },
            orderBy: [{ displayOrder: "asc" as const }, { id: "asc" as const }],
          },
          flashcards: {
            where: {
              status: "PUBLISHED",
              AND: [
                { OR: [{ frontMediaId: null }, { frontMedia: { archivedAt: null } }] },
                { OR: [{ backMediaId: null }, { backMedia: { archivedAt: null } }] },
              ],
            },
            select: { id: true, progress: { where: { userId }, select: { isMastered: true }, take: 1 } },
            orderBy: [{ displayOrder: "asc" as const }, { id: "asc" as const }],
          },
        },
        orderBy: [{ displayOrder: "asc" as const }, { id: "asc" as const }],
      },
    },
    orderBy: [{ displayOrder: "asc" as const }, { id: "asc" as const }],
  });
}

function combine(metrics: readonly ProgressMetric[]) {
  return metric(metrics.reduce((sum, item) => sum + item.numerator, 0), metrics.reduce((sum, item) => sum + item.denominator, 0));
}

function buildProgress(systems: Awaited<ReturnType<typeof readSystems>>, aggregate: AssessmentAggregate) {
  const byScope = new Map<string, TopicStat>();
  for (const stat of aggregate.topicStats) {
    const key = `${stat.organSystemId}:${stat.topicId}:${stat.assessmentType}`;
    const current = byScope.get(key);
    byScope.set(key, current ? {
      ...current,
      correctCount: current.correctCount + stat.correctCount,
      sampleCount: current.sampleCount + stat.sampleCount,
    } : stat);
  }
  return systems.map((system) => {
    const topics = system.topics.map((topic) => {
      const quiz = byScope.get(`${system.id}:${topic.id}:QUIZ`);
      const test = byScope.get(`${system.id}:${topic.id}:TEST`);
      return {
        id: topic.id, title: topic.title, slug: topic.slug, displayOrder: topic.displayOrder,
        content: metric(topic.lessons.filter((lesson) => lesson.progress.length > 0).length, topic.lessons.length),
        flashcards: metric(topic.flashcards.filter((card) => card.progress[0]?.isMastered === true).length, topic.flashcards.length),
        quiz: metric(quiz?.correctCount ?? 0, quiz?.sampleCount ?? 0),
        test: metric(test?.correctCount ?? 0, test?.sampleCount ?? 0),
      };
    });
    return {
      id: system.id, name: system.name, slug: system.slug, displayOrder: system.displayOrder,
      content: combine(topics.map((topic) => topic.content)),
      flashcards: combine(topics.map((topic) => topic.flashcards)),
      quiz: combine(topics.map((topic) => topic.quiz)),
      test: combine(topics.map((topic) => topic.test)),
      topics,
    };
  });
}

export async function getUserProgress(userId: string, organSystemId?: string) {
  await expireDueAttempts({ limit: 50, userId });
  const [systems, aggregate] = await Promise.all([readSystems(userId, organSystemId), readAssessmentAggregate(userId)]);
  if (organSystemId && systems.length === 0) throw new ProgressError("NOT_FOUND", "Organ system was not found.", 404);
  return buildProgress(systems, aggregate);
}

export async function getUserDashboard(userId: string) {
  await expireDueAttempts({ limit: 50, userId });
  const [systems, aggregate, recent] = await Promise.all([
    readSystems(userId),
    readAssessmentAggregate(userId),
    prisma.assessmentAttempt.findMany({
      where: { userId, status: { in: ["COMPLETED", "AUTO_SUBMITTED"] } },
      select: {
        id: true, assessmentType: true, status: true, startedAt: true, completedAt: true,
        durationSeconds: true, scorePercentage: true, correctCount: true, incorrectCount: true,
        unansweredCount: true, totalQuestionCount: true,
        questions: {
          select: { organSystemIdSnapshot: true, organSystemNameSnapshot: true },
          orderBy: { displayOrder: "asc" }, take: 1,
        },
      },
      orderBy: [{ completedAt: "desc" }, { id: "desc" }],
      take: 10,
    }),
  ]);
  return {
    attempts: {
      total: aggregate.totalAttempts, quiz: aggregate.quizAttempts, test: aggregate.testAttempts,
      autoSubmitted: aggregate.autoSubmittedAttempts,
    },
    accuracy: metric(aggregate.correctCount, aggregate.sampleCount),
    recentAttempts: recent.map((attempt) => ({
      id: attempt.id, assessmentType: attempt.assessmentType, status: attempt.status,
      startedAt: attempt.startedAt, completedAt: attempt.completedAt, durationSeconds: attempt.durationSeconds,
      correctCount: attempt.correctCount, incorrectCount: attempt.incorrectCount,
      unansweredCount: attempt.unansweredCount, totalQuestionCount: attempt.totalQuestionCount,
      scorePercentage: Number(attempt.scorePercentage.toString()),
      organSystemId: attempt.questions[0]?.organSystemIdSnapshot ?? null,
      organSystemName: attempt.questions[0]?.organSystemNameSnapshot ?? null,
    })),
    organSystems: buildProgress(systems, aggregate),
    ...rankTopicPerformanceStats(aggregate.topicStats),
  };
}

export async function getAdminUserProgress(userId: string) {
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { id: true, fullName: true, email: true, avatarUrl: true, isActive: true, createdAt: true, lastLoginAt: true },
  });
  if (!profile) throw new ProgressError("NOT_FOUND", "User was not found.", 404);
  return { profile, ...(await getUserDashboard(userId)) };
}

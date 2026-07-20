import "server-only";

import { Prisma } from "@prisma/client";

import { expireDueAttempts } from "@/features/assessments/finalization-service";
import { prisma } from "@/lib/db/prisma";
import { getProfileAvatarUrlMap } from "@/features/media/service";
import { buildProgressScore, metric, ProgressError, rankTopicPerformanceStats, type ProgressMetric } from "./domain";

export const PROGRESS_FORMULA_VERSION = "2026-07-current-inventory-v1";

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
  activityStats: Array<{ topicId: string; organSystemId: string; assessmentType: "QUIZ" | "TEST"; available: number; seen: number; correct: number }>;
  asOf: Date;
};

async function readAssessmentAggregate(client: Prisma.TransactionClient, userId: string): Promise<AssessmentAggregate> {
  const rows = await client.$queryRaw<Array<{
    totalAttempts: bigint | number;
    quizAttempts: bigint | number;
    testAttempts: bigint | number;
    autoSubmittedAttempts: bigint | number;
    correctCount: bigint | number;
    sampleCount: bigint | number;
    topicStats: Prisma.JsonValue;
    activityStats: Prisma.JsonValue;
    asOf: Date;
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
    ),
    current_eligible AS (
      SELECT question."id", question."topicId", topic."organSystemId", question."assessmentType"
      FROM "Question" question
      JOIN "Topic" topic ON topic."id" = question."topicId"
      JOIN "OrganSystem" system ON system."id" = topic."organSystemId"
      LEFT JOIN "MediaAsset" question_media ON question_media."id" = question."mediaId"
      WHERE question."trashedAt" IS NULL AND question."status" = 'PUBLISHED'::"PublishStatus" AND question."isActive" = true
        AND topic."trashedAt" IS NULL AND topic."status" = 'PUBLISHED'::"PublishStatus"
        AND system."trashedAt" IS NULL AND system."status" = 'PUBLISHED'::"PublishStatus" AND system."isActive" = true
        AND (question."mediaId" IS NULL OR (question_media."archivedAt" IS NULL AND question_media."trashedAt" IS NULL))
        AND (SELECT COUNT(*) FROM "QuestionOption" option WHERE option."questionId" = question."id") BETWEEN 2 AND 6
        AND (SELECT COUNT(*) FROM "QuestionOption" option WHERE option."questionId" = question."id" AND option."isCorrect" = true) = 1
        AND NOT EXISTS (
          SELECT 1 FROM "QuestionOption" option
          JOIN "MediaAsset" media ON media."id" = option."mediaId"
          WHERE option."questionId" = question."id" AND (media."archivedAt" IS NOT NULL OR media."trashedAt" IS NOT NULL)
        )
    ),
    ranked_latest AS (
      SELECT eligible."id" AS "questionId", eligible."topicId", eligible."organSystemId", eligible."assessmentType",
        snapshot."isCorrect",
        ROW_NUMBER() OVER (PARTITION BY eligible."id", eligible."assessmentType" ORDER BY attempt."completedAt" DESC, attempt."id" DESC, snapshot."id" DESC) AS rank
      FROM current_eligible eligible
      JOIN "AttemptQuestion" snapshot ON snapshot."sourceQuestionId" = eligible."id"
        AND snapshot."topicIdSnapshot" = eligible."topicId"
        AND snapshot."organSystemIdSnapshot" = eligible."organSystemId"
      JOIN submitted attempt ON attempt."id" = snapshot."attemptId" AND attempt."assessmentType" = eligible."assessmentType"
    ),
    activity_stats AS (
      SELECT eligible."topicId", eligible."organSystemId", eligible."assessmentType",
        COUNT(DISTINCT eligible."id")::int AS available,
        COUNT(latest."questionId")::int AS seen,
        COUNT(latest."questionId") FILTER (WHERE latest."isCorrect" = true)::int AS correct
      FROM current_eligible eligible
      LEFT JOIN ranked_latest latest ON latest."questionId" = eligible."id" AND latest.rank = 1
      GROUP BY eligible."topicId", eligible."organSystemId", eligible."assessmentType"
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
      )) FROM topic_stats stats), '[]'::jsonb) AS "topicStats",
      COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'topicId', stats."topicId", 'organSystemId', stats."organSystemId", 'assessmentType', stats."assessmentType",
        'available', stats.available, 'seen', stats.seen, 'correct', stats.correct
      )) FROM activity_stats stats), '[]'::jsonb) AS "activityStats",
      transaction_timestamp() AS "asOf"
    FROM submitted attempt
    LEFT JOIN "AttemptQuestion" question ON question."attemptId" = attempt."id"
  `);
  const row = rows[0];
  const topicStats = Array.isArray(row?.topicStats) ? row.topicStats as unknown as TopicStat[] : [];
  const activityStats = Array.isArray(row?.activityStats) ? row.activityStats as unknown as AssessmentAggregate["activityStats"] : [];
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
    activityStats: activityStats.map((stat) => ({ ...stat, available: Number(stat.available), seen: Number(stat.seen), correct: Number(stat.correct) })),
    asOf: row?.asOf ?? new Date(),
  };
}

function readSystems(client: Prisma.TransactionClient, userId: string, organSystemId?: string) {
  return client.organSystem.findMany({
    where: { id: organSystemId, trashedAt: null, status: "PUBLISHED", isActive: true },
    select: {
      id: true, name: true, slug: true, displayOrder: true,
      topics: {
        where: { trashedAt: null, status: "PUBLISHED" },
        select: {
          id: true, title: true, slug: true, displayOrder: true,
          lessons: {
            where: { trashedAt: null, status: "PUBLISHED" },
            select: { id: true, progress: { where: { userId, completedAt: { not: null } }, select: { completedAt: true }, take: 1 } },
            orderBy: [{ displayOrder: "asc" as const }, { id: "asc" as const }],
          },
          flashcards: {
            where: {
              status: "PUBLISHED",
              trashedAt: null,
              AND: [
                { OR: [{ frontMediaId: null }, { frontMedia: { archivedAt: null } }] },
                { OR: [{ backMediaId: null }, { backMedia: { archivedAt: null } }] },
              ],
            },
            select: { id: true, progress: { where: { userId }, select: { isMastered: true }, take: 1 } },
            orderBy: [{ displayOrder: "asc" as const }, { id: "asc" as const }],
          },
          questions: {
            where: { trashedAt: null, status: "PUBLISHED", isActive: true },
            select: {
              assessmentType: true,
              media: { select: { archivedAt: true } },
              options: { select: { isCorrect: true, media: { select: { archivedAt: true } } } },
            },
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
  const activityByScope = new Map(aggregate.activityStats.map((stat) => [`${stat.organSystemId}:${stat.topicId}:${stat.assessmentType}`, stat]));
  return systems.map((system) => {
    const topics = system.topics.map((topic) => {
      const quiz = byScope.get(`${system.id}:${topic.id}:QUIZ`);
      const test = byScope.get(`${system.id}:${topic.id}:TEST`);
      const eligibleQuestions = topic.questions.filter((question) => question.media?.archivedAt == null
        && question.options.length >= 2 && question.options.length <= 6
        && question.options.filter((option) => option.isCorrect).length === 1
        && question.options.every((option) => option.media?.archivedAt == null));
      const inventory = {
        lessons: topic.lessons.length,
        flashcards: topic.flashcards.length,
        quizQuestions: eligibleQuestions.filter((question) => question.assessmentType === "QUIZ").length,
        testQuestions: eligibleQuestions.filter((question) => question.assessmentType === "TEST").length,
      };
      const quizActivity = activityByScope.get(`${system.id}:${topic.id}:QUIZ`) ?? { available: inventory.quizQuestions, seen: 0, correct: 0 };
      const testActivity = activityByScope.get(`${system.id}:${topic.id}:TEST`) ?? { available: inventory.testQuestions, seen: 0, correct: 0 };
      const contentCompleted = topic.lessons.filter((lesson) => lesson.progress.length > 0).length;
      const score = buildProgressScore({
        content: { inventory: inventory.lessons, completed: contentCompleted },
        quiz: quizActivity,
        test: testActivity,
      });
      return {
        id: topic.id, title: topic.title, slug: topic.slug, displayOrder: topic.displayOrder,
        content: metric(contentCompleted, topic.lessons.length),
        flashcards: metric(topic.flashcards.filter((card) => card.progress[0]?.isMastered === true).length, topic.flashcards.length),
        quiz: metric(quiz?.correctCount ?? 0, quiz?.sampleCount ?? 0),
        test: metric(test?.correctCount ?? 0, test?.sampleCount ?? 0),
        inventory,
        activity: {
          quiz: { distinctCurrentQuestionsSeen: quizActivity.seen, available: quizActivity.available, latestAnswerCorrect: quizActivity.correct, coverage: metric(quizActivity.seen, quizActivity.available), accuracy: metric(quizActivity.correct, quizActivity.seen) },
          test: { distinctCurrentQuestionsSeen: testActivity.seen, available: testActivity.available, latestAnswerCorrect: testActivity.correct, coverage: metric(testActivity.seen, testActivity.available), accuracy: metric(testActivity.correct, testActivity.seen) },
        },
        score,
        formulaVersion: PROGRESS_FORMULA_VERSION,
        asOf: aggregate.asOf,
      };
    });
    const inventory = topics.reduce((total, topic) => ({
      lessons: total.lessons + topic.inventory.lessons,
      flashcards: total.flashcards + topic.inventory.flashcards,
      quizQuestions: total.quizQuestions + topic.inventory.quizQuestions,
      testQuestions: total.testQuestions + topic.inventory.testQuestions,
    }), { lessons: 0, flashcards: 0, quizQuestions: 0, testQuestions: 0 });
    const sumActivity = (type: "quiz" | "test") => topics.reduce((total, topic) => ({
      available: total.available + topic.activity[type].available,
      seen: total.seen + topic.activity[type].distinctCurrentQuestionsSeen,
      correct: total.correct + topic.activity[type].latestAnswerCorrect,
    }), { available: 0, seen: 0, correct: 0 });
    const quizActivity = sumActivity("quiz");
    const testActivity = sumActivity("test");
    const contentCompleted = topics.reduce((sum, topic) => sum + topic.content.numerator, 0);
    return {
      id: system.id, name: system.name, slug: system.slug, displayOrder: system.displayOrder,
      content: combine(topics.map((topic) => topic.content)),
      flashcards: combine(topics.map((topic) => topic.flashcards)),
      quiz: combine(topics.map((topic) => topic.quiz)),
      test: combine(topics.map((topic) => topic.test)),
      inventory,
      activity: {
        quiz: { distinctCurrentQuestionsSeen: quizActivity.seen, available: quizActivity.available, latestAnswerCorrect: quizActivity.correct, coverage: metric(quizActivity.seen, quizActivity.available), accuracy: metric(quizActivity.correct, quizActivity.seen) },
        test: { distinctCurrentQuestionsSeen: testActivity.seen, available: testActivity.available, latestAnswerCorrect: testActivity.correct, coverage: metric(testActivity.seen, testActivity.available), accuracy: metric(testActivity.correct, testActivity.seen) },
      },
      score: buildProgressScore({ content: { inventory: inventory.lessons, completed: contentCompleted }, quiz: quizActivity, test: testActivity }),
      formulaVersion: PROGRESS_FORMULA_VERSION,
      asOf: aggregate.asOf,
      topics,
    };
  });
}

export async function getUserProgress(userId: string, organSystemId?: string) {
  await expireDueAttempts({ limit: 50, userId });
  const [systems, aggregate] = await prisma.$transaction(async (tx) => Promise.all([
    readSystems(tx, userId, organSystemId),
    readAssessmentAggregate(tx, userId),
  ]), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  if (organSystemId && systems.length === 0) throw new ProgressError("NOT_FOUND", "Organ system was not found.", 404);
  return buildProgress(systems, aggregate);
}

export async function getUserDashboard(userId: string) {
  await expireDueAttempts({ limit: 50, userId });
  const [systems, aggregate, recent] = await prisma.$transaction(async (tx) => Promise.all([
    readSystems(tx, userId),
    readAssessmentAggregate(tx, userId),
    tx.assessmentAttempt.findMany({
      where: { userId, status: { in: ["COMPLETED", "AUTO_SUBMITTED"] } },
      select: {
        id: true, assessmentType: true, status: true, startedAt: true, completedAt: true,
        durationSeconds: true, scorePercentage: true, correctCount: true, incorrectCount: true,
        unansweredCount: true, totalQuestionCount: true,
        questions: {
          select: { organSystemIdSnapshot: true, organSystemNameSnapshot: true },
          orderBy: { displayOrder: "asc" },
        },
      },
      orderBy: [{ completedAt: "desc" }, { id: "desc" }],
      take: 10,
    }),
  ]), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  return {
    attempts: {
      total: aggregate.totalAttempts, quiz: aggregate.quizAttempts, test: aggregate.testAttempts,
      autoSubmitted: aggregate.autoSubmittedAttempts,
    },
    accuracy: metric(aggregate.correctCount, aggregate.sampleCount),
    recentAttempts: recent.map((attempt) => {
      const systems = [...new Map(attempt.questions.map((question) => [question.organSystemIdSnapshot, question.organSystemNameSnapshot])).entries()];
      return {
      id: attempt.id, assessmentType: attempt.assessmentType, status: attempt.status,
      startedAt: attempt.startedAt, completedAt: attempt.completedAt, durationSeconds: attempt.durationSeconds,
      correctCount: attempt.correctCount, incorrectCount: attempt.incorrectCount,
      unansweredCount: attempt.unansweredCount, totalQuestionCount: attempt.totalQuestionCount,
      scorePercentage: Number(attempt.scorePercentage.toString()),
      organSystemId: systems.length === 1 ? systems[0][0] : null,
      organSystemName: systems.length > 1 ? "Mixed systems" : systems[0]?.[1] ?? null,
    }; }),
    organSystems: buildProgress(systems, aggregate),
    formulaVersion: PROGRESS_FORMULA_VERSION,
    asOf: aggregate.asOf,
    ...rankTopicPerformanceStats(aggregate.topicStats),
  };
}

export async function getAdminUserProgress(userId: string) {
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { id: true, fullName: true, email: true, avatarUrl: true, avatarMediaId: true, isActive: true, createdAt: true, lastLoginAt: true },
  });
  if (!profile) throw new ProgressError("NOT_FOUND", "User was not found.", 404);
  const avatarUrls = await getProfileAvatarUrlMap([profile]);
  const { avatarMediaId: _avatarMediaId, ...safeProfile } = profile;
  void _avatarMediaId;
  return { profile: { ...safeProfile, avatarUrl: avatarUrls.get(profile.id) ?? null }, ...(await getUserDashboard(userId)) };
}

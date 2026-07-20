import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { buildDailyAttemptTrend, metric } from "./domain";
import type { AdminDashboardDto } from "./dto";
import type { AdminDashboardQuery } from "./schemas";

type SummaryRow = Record<
  | "totalUsers" | "activeUsers" | "organSystems" | "topics" | "flashcards" | "questions"
  | "publishedLessons" | "quizQuestions" | "testQuestions" | "newFeedback"
  | "completedQuizzes" | "completedTests" | "quizCorrect" | "quizQuestionsAnswered"
  | "testCorrect" | "testQuestionsAnswered",
  bigint | number
>;

type CompletenessRow = {
  id: string;
  name: string;
  displayOrder: number;
  topicCount: bigint | number;
  readyTopicCount: bigint | number;
  lessonTopicCount: bigint | number;
  flashcardTopicCount: bigint | number;
  quizTopicCount: bigint | number;
  testTopicCount: bigint | number;
};

type TrendRow = {
  day: Date;
  quizAttempts: bigint | number;
  testAttempts: bigint | number;
};

function utcRange(generatedAt: Date, days: 7 | 30 | 90) {
  const endExclusive = new Date(Date.UTC(
    generatedAt.getUTCFullYear(),
    generatedAt.getUTCMonth(),
    generatedAt.getUTCDate() + 1,
  ));
  const start = new Date(endExclusive);
  start.setUTCDate(start.getUTCDate() - days);
  return { days, start, endExclusive };
}

export async function getAdminDashboard(input: AdminDashboardQuery): Promise<AdminDashboardDto> {
  const generatedAt = new Date();
  const range = utcRange(generatedAt, input.days);

  const result = await prisma.$transaction(async (tx) => {
    const [summaryRows, completenessRows, trendRows, recentRegistrations, recentFeedback, recentAudit] = await Promise.all([
      tx.$queryRaw<SummaryRow[]>(Prisma.sql`
        WITH submitted_questions AS (
          SELECT attempt."assessmentType", question."isCorrect"
          FROM "AssessmentAttempt" attempt
          JOIN "AttemptQuestion" question ON question."attemptId" = attempt."id"
          WHERE attempt."status" IN ('COMPLETED'::"AttemptStatus", 'AUTO_SUBMITTED'::"AttemptStatus")
        )
        SELECT
          (SELECT COUNT(*) FROM "Profile" WHERE "role" = 'USER'::"UserRole")::int AS "totalUsers",
          (SELECT COUNT(*) FROM "Profile" WHERE "role" = 'USER'::"UserRole" AND "isActive")::int AS "activeUsers",
          (SELECT COUNT(*) FROM "OrganSystem" WHERE "status" <> 'ARCHIVED'::"PublishStatus")::int AS "organSystems",
          (SELECT COUNT(*) FROM "Topic" WHERE "status" <> 'ARCHIVED'::"PublishStatus")::int AS "topics",
          (SELECT COUNT(*) FROM "Flashcard" WHERE "status" <> 'ARCHIVED'::"PublishStatus")::int AS "flashcards",
          (SELECT COUNT(*) FROM "Question" WHERE "status" <> 'ARCHIVED'::"PublishStatus")::int AS "questions",
          (SELECT COUNT(*) FROM "ContentLesson" lesson
            JOIN "Topic" topic ON topic."id" = lesson."topicId"
            JOIN "OrganSystem" system ON system."id" = topic."organSystemId"
            WHERE lesson."status" = 'PUBLISHED'::"PublishStatus"
              AND topic."status" = 'PUBLISHED'::"PublishStatus"
              AND system."status" = 'PUBLISHED'::"PublishStatus" AND system."isActive")::int AS "publishedLessons",
          (SELECT COUNT(*) FROM "Question" WHERE "status" <> 'ARCHIVED'::"PublishStatus"
            AND "assessmentType" = 'QUIZ'::"AssessmentType")::int AS "quizQuestions",
          (SELECT COUNT(*) FROM "Question" WHERE "status" <> 'ARCHIVED'::"PublishStatus"
            AND "assessmentType" = 'TEST'::"AssessmentType")::int AS "testQuestions",
          (SELECT COUNT(*) FROM "Feedback" WHERE "status" = 'NEW'::"FeedbackStatus" AND "trashedAt" IS NULL)::int AS "newFeedback",
          (SELECT COUNT(*) FROM "AssessmentAttempt" WHERE "assessmentType" = 'QUIZ'::"AssessmentType"
            AND "status" IN ('COMPLETED'::"AttemptStatus", 'AUTO_SUBMITTED'::"AttemptStatus"))::int AS "completedQuizzes",
          (SELECT COUNT(*) FROM "AssessmentAttempt" WHERE "assessmentType" = 'TEST'::"AssessmentType"
            AND "status" IN ('COMPLETED'::"AttemptStatus", 'AUTO_SUBMITTED'::"AttemptStatus"))::int AS "completedTests",
          COUNT(*) FILTER (WHERE "assessmentType" = 'QUIZ'::"AssessmentType" AND "isCorrect" = true)::int AS "quizCorrect",
          COUNT(*) FILTER (WHERE "assessmentType" = 'QUIZ'::"AssessmentType")::int AS "quizQuestionsAnswered",
          COUNT(*) FILTER (WHERE "assessmentType" = 'TEST'::"AssessmentType" AND "isCorrect" = true)::int AS "testCorrect",
          COUNT(*) FILTER (WHERE "assessmentType" = 'TEST'::"AssessmentType")::int AS "testQuestionsAnswered"
        FROM submitted_questions
      `),
      tx.$queryRaw<CompletenessRow[]>(Prisma.sql`
        WITH topic_readiness AS (
          SELECT topic."id", topic."organSystemId",
            (system."status" = 'PUBLISHED'::"PublishStatus" AND system."isActive"
              AND topic."status" = 'PUBLISHED'::"PublishStatus") AS eligible,
            EXISTS (SELECT 1 FROM "ContentLesson" lesson WHERE lesson."topicId" = topic."id"
              AND lesson."status" = 'PUBLISHED'::"PublishStatus") AS "hasLesson",
            EXISTS (SELECT 1 FROM "Flashcard" card WHERE card."topicId" = topic."id"
              AND card."status" = 'PUBLISHED'::"PublishStatus"
              AND NOT EXISTS (SELECT 1 FROM "MediaAsset" media
                WHERE media."id" IN (card."frontMediaId", card."backMediaId") AND media."archivedAt" IS NOT NULL)) AS "hasFlashcard",
            EXISTS (SELECT 1 FROM "Question" question WHERE question."topicId" = topic."id"
              AND question."assessmentType" = 'QUIZ'::"AssessmentType"
              AND question."status" = 'PUBLISHED'::"PublishStatus" AND question."isActive"
              AND NOT EXISTS (SELECT 1 FROM "MediaAsset" media WHERE media."id" = question."mediaId" AND media."archivedAt" IS NOT NULL)
              AND (SELECT COUNT(*) FROM "QuestionOption" option WHERE option."questionId" = question."id") BETWEEN 2 AND 6
              AND (SELECT COUNT(*) FROM "QuestionOption" option WHERE option."questionId" = question."id" AND option."isCorrect") = 1
              AND NOT EXISTS (SELECT 1 FROM "QuestionOption" option JOIN "MediaAsset" media ON media."id" = option."mediaId"
                WHERE option."questionId" = question."id" AND media."archivedAt" IS NOT NULL)) AS "hasQuiz",
            EXISTS (SELECT 1 FROM "Question" question WHERE question."topicId" = topic."id"
              AND question."assessmentType" = 'TEST'::"AssessmentType"
              AND question."status" = 'PUBLISHED'::"PublishStatus" AND question."isActive"
              AND NOT EXISTS (SELECT 1 FROM "MediaAsset" media WHERE media."id" = question."mediaId" AND media."archivedAt" IS NOT NULL)
              AND (SELECT COUNT(*) FROM "QuestionOption" option WHERE option."questionId" = question."id") BETWEEN 2 AND 6
              AND (SELECT COUNT(*) FROM "QuestionOption" option WHERE option."questionId" = question."id" AND option."isCorrect") = 1
              AND NOT EXISTS (SELECT 1 FROM "QuestionOption" option JOIN "MediaAsset" media ON media."id" = option."mediaId"
                WHERE option."questionId" = question."id" AND media."archivedAt" IS NOT NULL)) AS "hasTest"
          FROM "Topic" topic
          JOIN "OrganSystem" system ON system."id" = topic."organSystemId"
          WHERE topic."status" <> 'ARCHIVED'::"PublishStatus"
            AND system."status" <> 'ARCHIVED'::"PublishStatus"
        )
        SELECT system."id", system."name", system."displayOrder",
          COUNT(topic."id")::int AS "topicCount",
          COUNT(topic."id") FILTER (WHERE topic.eligible AND topic."hasLesson" AND topic."hasFlashcard" AND topic."hasQuiz" AND topic."hasTest")::int AS "readyTopicCount",
          COUNT(topic."id") FILTER (WHERE topic.eligible AND topic."hasLesson")::int AS "lessonTopicCount",
          COUNT(topic."id") FILTER (WHERE topic.eligible AND topic."hasFlashcard")::int AS "flashcardTopicCount",
          COUNT(topic."id") FILTER (WHERE topic.eligible AND topic."hasQuiz")::int AS "quizTopicCount",
          COUNT(topic."id") FILTER (WHERE topic.eligible AND topic."hasTest")::int AS "testTopicCount"
        FROM "OrganSystem" system
        LEFT JOIN topic_readiness topic ON topic."organSystemId" = system."id"
        WHERE system."status" <> 'ARCHIVED'::"PublishStatus"
        GROUP BY system."id", system."name", system."displayOrder"
        ORDER BY system."displayOrder" ASC, system."id" ASC
      `),
      tx.$queryRaw<TrendRow[]>(Prisma.sql`
        SELECT date_trunc('day', "completedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AS day,
          COUNT(*) FILTER (WHERE "assessmentType" = 'QUIZ'::"AssessmentType")::int AS "quizAttempts",
          COUNT(*) FILTER (WHERE "assessmentType" = 'TEST'::"AssessmentType")::int AS "testAttempts"
        FROM "AssessmentAttempt"
        WHERE "status" IN ('COMPLETED'::"AttemptStatus", 'AUTO_SUBMITTED'::"AttemptStatus")
          AND "completedAt" >= ${range.start} AND "completedAt" < ${range.endExclusive}
        GROUP BY day
        ORDER BY day ASC
      `),
      tx.profile.findMany({
        where: { role: "USER" },
        select: { id: true, fullName: true, email: true, isActive: true, createdAt: true },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 5,
      }),
      tx.feedback.findMany({
        where: { trashedAt: null },
        select: {
          id: true, type: true, subject: true, status: true, createdAt: true,
          user: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 5,
      }),
      tx.auditLog.findMany({
        select: {
          id: true, action: true, entityType: true, entityId: true, createdAt: true,
          actor: { select: { id: true, fullName: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 5,
      }),
    ]);
    return { summary: summaryRows[0], completenessRows, trendRows, recentRegistrations, recentFeedback, recentAudit };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });

  const summary = result.summary;
  const count = (key: keyof SummaryRow) => Number(summary?.[key] ?? 0);
  return {
    generatedAt,
    range,
    counts: {
      totalUsers: count("totalUsers"), activeUsers: count("activeUsers"),
      organSystems: count("organSystems"), topics: count("topics"),
      flashcards: count("flashcards"), questions: count("questions"),
      publishedLessons: count("publishedLessons"), quizQuestions: count("quizQuestions"),
      testQuestions: count("testQuestions"), newFeedback: count("newFeedback"),
      completedQuizzes: count("completedQuizzes"), completedTests: count("completedTests"),
    },
    accuracy: {
      quiz: metric(count("quizCorrect"), count("quizQuestionsAnswered")),
      test: metric(count("testCorrect"), count("testQuestionsAnswered")),
    },
    attemptsTrend: buildDailyAttemptTrend(range.start, range.days, result.trendRows),
    contentReadinessCriteria: {
      denominator: "NON_ARCHIVED_TOPICS",
      completeTopicRequires: [
        "PUBLISHED_ACTIVE_SYSTEM_AND_PUBLISHED_TOPIC",
        "ELIGIBLE_PUBLISHED_LESSON",
        "ELIGIBLE_PUBLISHED_FLASHCARD",
        "ELIGIBLE_ACTIVE_PUBLISHED_QUIZ_QUESTION",
        "ELIGIBLE_ACTIVE_PUBLISHED_TEST_QUESTION",
      ],
    },
    contentCompleteness: result.completenessRows.map((row) => {
      const denominator = Number(row.topicCount);
      return {
        id: row.id, name: row.name, displayOrder: row.displayOrder,
        completeTopics: metric(Number(row.readyTopicCount), denominator),
        lessons: metric(Number(row.lessonTopicCount), denominator),
        flashcards: metric(Number(row.flashcardTopicCount), denominator),
        quizQuestions: metric(Number(row.quizTopicCount), denominator),
        testQuestions: metric(Number(row.testTopicCount), denominator),
      };
    }),
    recentRegistrations: result.recentRegistrations,
    recentFeedback: result.recentFeedback,
    recentAudit: result.recentAudit,
  };
}

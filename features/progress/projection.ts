import { Prisma } from "@prisma/client";

type ProgressPair = { userId: string; topicId: string };

export async function refreshTopicProgressPairs(tx: Prisma.TransactionClient, pairs: readonly ProgressPair[]) {
  const unique = [...new Map(pairs.map((pair) => [`${pair.userId}:${pair.topicId}`, pair])).values()];
  if (unique.length === 0) return 0;
  const targets = Prisma.join(unique.map((pair) => Prisma.sql`(${pair.userId}::uuid, ${pair.topicId}::uuid)`));
  return tx.$executeRaw(Prisma.sql`
    WITH targets("userId", "topicId") AS (VALUES ${targets}),
    content_stats AS (
      SELECT target."userId", target."topicId",
        COUNT(lesson."id")::int AS denominator,
        COUNT(progress."id") FILTER (WHERE progress."completedAt" IS NOT NULL)::int AS numerator
      FROM targets target
      JOIN "Topic" topic ON topic."id" = target."topicId"
        AND topic."status" = 'PUBLISHED'::"PublishStatus"
      JOIN "OrganSystem" system ON system."id" = topic."organSystemId"
        AND system."status" = 'PUBLISHED'::"PublishStatus" AND system."isActive" = true
      LEFT JOIN "ContentLesson" lesson ON lesson."topicId" = target."topicId"
        AND lesson."status" = 'PUBLISHED'::"PublishStatus"
      LEFT JOIN "ContentLessonProgress" progress ON progress."contentLessonId" = lesson."id"
        AND progress."userId" = target."userId"
      GROUP BY target."userId", target."topicId"
    ),
    flashcard_stats AS (
      SELECT target."userId", target."topicId",
        COUNT(card."id")::int AS denominator,
        COUNT(progress."id") FILTER (WHERE progress."isMastered" = true)::int AS numerator
      FROM targets target
      JOIN "Topic" topic ON topic."id" = target."topicId"
        AND topic."status" = 'PUBLISHED'::"PublishStatus"
      JOIN "OrganSystem" system ON system."id" = topic."organSystemId"
        AND system."status" = 'PUBLISHED'::"PublishStatus" AND system."isActive" = true
      LEFT JOIN "Flashcard" card ON card."topicId" = target."topicId"
        AND card."status" = 'PUBLISHED'::"PublishStatus"
        AND (card."frontMediaId" IS NULL OR EXISTS (SELECT 1 FROM "MediaAsset" media WHERE media."id" = card."frontMediaId" AND media."archivedAt" IS NULL))
        AND (card."backMediaId" IS NULL OR EXISTS (SELECT 1 FROM "MediaAsset" media WHERE media."id" = card."backMediaId" AND media."archivedAt" IS NULL))
      LEFT JOIN "FlashcardProgress" progress ON progress."flashcardId" = card."id"
        AND progress."userId" = target."userId"
      GROUP BY target."userId", target."topicId"
    ),
    assessment_stats AS (
      SELECT target."userId", target."topicId",
        COUNT(question."id") FILTER (WHERE attempt."assessmentType" = 'QUIZ'::"AssessmentType")::int AS quiz_denominator,
        COUNT(question."id") FILTER (WHERE attempt."assessmentType" = 'QUIZ'::"AssessmentType" AND question."isCorrect" = true)::int AS quiz_numerator,
        COUNT(question."id") FILTER (WHERE attempt."assessmentType" = 'TEST'::"AssessmentType")::int AS test_denominator,
        COUNT(question."id") FILTER (WHERE attempt."assessmentType" = 'TEST'::"AssessmentType" AND question."isCorrect" = true)::int AS test_numerator
      FROM targets target
      LEFT JOIN "AssessmentAttempt" attempt ON attempt."userId" = target."userId"
        AND attempt."status" IN ('COMPLETED'::"AttemptStatus", 'AUTO_SUBMITTED'::"AttemptStatus")
      LEFT JOIN "AttemptQuestion" question ON question."attemptId" = attempt."id"
        AND question."topicIdSnapshot" = target."topicId"
      GROUP BY target."userId", target."topicId"
    )
    INSERT INTO "TopicProgress" (
      "id", "userId", "topicId", "contentCompletionPercent", "flashcardCompletionPercent",
      "quizAccuracyPercent", "testAccuracyPercent", "updatedAt"
    )
    SELECT gen_random_uuid(), target."userId", target."topicId",
      ROUND(COALESCE(content.numerator * 100.0 / NULLIF(content.denominator, 0), 0), 2),
      ROUND(COALESCE(cards.numerator * 100.0 / NULLIF(cards.denominator, 0), 0), 2),
      ROUND(COALESCE(assessment.quiz_numerator * 100.0 / NULLIF(assessment.quiz_denominator, 0), 0), 2),
      ROUND(COALESCE(assessment.test_numerator * 100.0 / NULLIF(assessment.test_denominator, 0), 0), 2),
      clock_timestamp()
    FROM targets target
    LEFT JOIN content_stats content USING ("userId", "topicId")
    LEFT JOIN flashcard_stats cards USING ("userId", "topicId")
    LEFT JOIN assessment_stats assessment USING ("userId", "topicId")
    ON CONFLICT ("userId", "topicId") DO UPDATE SET
      "contentCompletionPercent" = EXCLUDED."contentCompletionPercent",
      "flashcardCompletionPercent" = EXCLUDED."flashcardCompletionPercent",
      "quizAccuracyPercent" = EXCLUDED."quizAccuracyPercent",
      "testAccuracyPercent" = EXCLUDED."testAccuracyPercent",
      "updatedAt" = EXCLUDED."updatedAt"
  `);
}

export function refreshTopicProgress(tx: Prisma.TransactionClient, userId: string, topicId: string) {
  return refreshTopicProgressPairs(tx, [{ userId, topicId }]);
}

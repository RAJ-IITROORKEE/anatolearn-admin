import { Prisma } from "@prisma/client";

import { getEligibleQuestions } from "@/features/questions/selection-service";
import { prisma } from "@/lib/db/prisma";
import { AssessmentError, buildAttemptSnapshots, fisherYates, hasTestExpired, isSubmittedAttemptStatus, type SnapshotOption } from "./domain";
import { attemptDetailDto, attemptListItemDto, attemptResultDto } from "./dto";
import { attemptInclude, databaseNow, expireDueAttempts, finalizeLockedAttempt, lockOwnedAttempt, readOwnedAttemptWithLazyExpiry, retryAssessmentTransaction } from "./finalization-service";
import type { AnswerInput, AttemptListInput, StartAssessmentInput } from "./schemas";

function parsedOptions(value: Prisma.JsonValue): SnapshotOption[] {
  if (!Array.isArray(value)) throw new AssessmentError("INVALID_SNAPSHOT", "Attempt snapshot is invalid.", 500);
  return value as SnapshotOption[];
}

async function validateScope(tx: Prisma.TransactionClient, input: StartAssessmentInput) {
  const systems = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id" FROM "OrganSystem"
    WHERE "id" = ${input.organSystemId}::uuid AND "trashedAt" IS NULL AND "status" = 'PUBLISHED' AND "isActive" = true
    ORDER BY "id"
    FOR SHARE
  `);
  if (!systems.length) throw new AssessmentError("SYSTEM_NOT_FOUND", "Published organ system was not found.", 404);
  const topics = await tx.topic.findMany({
    where: {
      organSystemId: input.organSystemId,
      trashedAt: null,
      status: "PUBLISHED",
      ...(input.topicIds ? { id: { in: input.topicIds } } : {}),
    },
    select: { id: true }, orderBy: { id: "asc" },
  });
  if (input.topicIds && topics.length !== input.topicIds.length) {
    throw new AssessmentError("INVALID_TOPIC_SCOPE", "One or more published topics are unavailable for this organ system.", 422);
  }
  if (!topics.length) throw new AssessmentError("NO_TOPICS", "No published topics are available for this organ system.", 422);
  const topicIds = topics.map((topic) => topic.id).sort();
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Topic" WHERE "id" = ANY(ARRAY[${Prisma.join(topicIds)}]::uuid[]) AND "trashedAt" IS NULL ORDER BY "id" FOR SHARE`);
  return topicIds;
}

async function createAttemptInTransaction(
  tx: Prisma.TransactionClient,
  userId: string,
  input: StartAssessmentInput,
  retakeSourceId: string | null,
  random: () => number,
) {
  const topicIds = await validateScope(tx, input);
  const eligible = await getEligibleQuestions({ ...input, topicIds }, tx);
  if (eligible.length < input.questionCount) {
    throw new AssessmentError("INSUFFICIENT_QUESTIONS", `Only ${eligible.length} eligible questions are available.`, 422);
  }
  const selected = fisherYates(eligible, random).slice(0, input.questionCount);
  const selectedIds = selected.map((question) => question.id).sort();
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Question" WHERE "id" = ANY(ARRAY[${Prisma.join(selectedIds)}]::uuid[]) AND "trashedAt" IS NULL ORDER BY "id" FOR SHARE`);
  const eligibleAfterLock = await getEligibleQuestions({ ...input, topicIds }, tx);
  const eligibleById = new Map(eligibleAfterLock.map((question) => [question.id, question]));
  const revalidated = selected.flatMap((question) => {
    const current = eligibleById.get(question.id);
    return current ? [current] : [];
  });
  if (revalidated.length !== selected.length) {
    throw new AssessmentError("QUESTION_UNAVAILABLE", "Question availability changed while starting the assessment.", 409);
  }
  const now = await databaseNow(tx);
  const snapshots = buildAttemptSnapshots(revalidated, random);
  const timeLimitSeconds = input.assessmentType === "TEST" ? input.questionCount * 60 : null;
  const expiresAt = timeLimitSeconds === null ? null : new Date(now.getTime() + timeLimitSeconds * 1000);
  return tx.assessmentAttempt.create({
    data: {
      userId, assessmentType: input.assessmentType, organSystemId: input.organSystemId,
      requestedQuestionCount: input.questionCount, totalQuestionCount: input.questionCount,
      unansweredCount: input.questionCount, startedAt: now, expiresAt, timeLimitSeconds, retakeSourceId,
      topics: { create: topicIds.map((topicId) => ({ topicId })) },
      questions: { create: snapshots.map((snapshot) => ({ ...snapshot, optionsSnapshot: snapshot.optionsSnapshot as unknown as Prisma.InputJsonValue })) },
    },
    include: attemptInclude,
  });
}

export async function startAssessment(userId: string, input: StartAssessmentInput, random: () => number = Math.random) {
  const attempt = await retryAssessmentTransaction((tx) => createAttemptInTransaction(tx, userId, input, null, random));
  return attemptDetailDto(attempt);
}

export async function updateAttemptAnswer(attemptId: string, attemptQuestionId: string, userId: string, input: AnswerInput) {
  const outcome = await retryAssessmentTransaction(async (tx) => {
    const attempt = await lockOwnedAttempt(tx, attemptId, userId);
    const now = await databaseNow(tx);
    if (attempt.status !== "IN_PROGRESS") throw new AssessmentError("ATTEMPT_TERMINAL", "Answers cannot be changed after submission.", 409);
    if (hasTestExpired(attempt.assessmentType, attempt.expiresAt, now)) {
      await finalizeLockedAttempt(tx, attempt, now, true);
      return { expired: true as const };
    }
    const question = attempt.questions.find((item) => item.id === attemptQuestionId);
    if (!question) throw new AssessmentError("NOT_FOUND", "Attempt question was not found.", 404);
    const validKeys = new Set(parsedOptions(question.optionsSnapshot).map((option) => option.key));
    if (input.answeredOptionKey !== null && !validKeys.has(input.answeredOptionKey)) {
      throw new AssessmentError("INVALID_OPTION", "The selected option does not belong to this attempt question.", 422);
    }
    const sameAnswer = question.answeredOptionKey === input.answeredOptionKey;
    const nextTime = input.timeSpentSeconds === undefined
      ? question.timeSpentSeconds
      : Math.max(question.timeSpentSeconds ?? 0, input.timeSpentSeconds);
    if (sameAnswer && nextTime === question.timeSpentSeconds) return { expired: false as const, question };
    const updated = await tx.attemptQuestion.update({
      where: { id: question.id },
      data: {
        answeredOptionKey: input.answeredOptionKey,
        answeredAt: input.answeredOptionKey === null ? null : sameAnswer ? question.answeredAt : now,
        isCorrect: input.answeredOptionKey === null ? null : input.answeredOptionKey === question.correctOptionKey,
        timeSpentSeconds: nextTime,
      },
    });
    return { expired: false as const, question: updated };
  });
  if (outcome.expired) throw new AssessmentError("ATTEMPT_EXPIRED", "The test expired and was automatically submitted.", 409);
  return { id: outcome.question.id, answeredOptionKey: outcome.question.answeredOptionKey, answeredAt: outcome.question.answeredAt, timeSpentSeconds: outcome.question.timeSpentSeconds };
}

export async function submitAttempt(attemptId: string, userId: string) {
  const attempt = await retryAssessmentTransaction(async (tx) => {
    const locked = await lockOwnedAttempt(tx, attemptId, userId);
    if (isSubmittedAttemptStatus(locked.status)) return locked;
    if (locked.status === "ABANDONED") throw new AssessmentError("ATTEMPT_NOT_SUBMITTED", "Abandoned attempts cannot be submitted.", 409);
    const now = await databaseNow(tx);
    return finalizeLockedAttempt(tx, locked, now);
  });
  return attemptResultDto(attempt);
}

export async function getAttempt(attemptId: string, userId: string) {
  return attemptDetailDto(await readOwnedAttemptWithLazyExpiry(attemptId, userId));
}

export async function getAttemptResult(attemptId: string, userId: string) {
  return attemptResultDto(await readOwnedAttemptWithLazyExpiry(attemptId, userId));
}

export async function retakeAttempt(attemptId: string, userId: string, random: () => number = Math.random) {
  const attempt = await retryAssessmentTransaction(async (tx) => {
    let source = await lockOwnedAttempt(tx, attemptId, userId);
    if (source.status === "ABANDONED") throw new AssessmentError("SOURCE_NOT_SUBMITTED", "Abandoned attempts cannot be retaken.", 409);
    if (source.status === "IN_PROGRESS") {
      const now = await databaseNow(tx);
      if (!hasTestExpired(source.assessmentType, source.expiresAt, now)) {
        throw new AssessmentError("SOURCE_NOT_SUBMITTED", "Only a submitted attempt can be retaken.", 409);
      }
      source = await finalizeLockedAttempt(tx, source, now, true);
    }
    if (!isSubmittedAttemptStatus(source.status)) throw new AssessmentError("SOURCE_NOT_SUBMITTED", "Only a submitted attempt can be retaken.", 409);
    return createAttemptInTransaction(tx, userId, {
      assessmentType: source.assessmentType,
      organSystemId: source.organSystemId,
      topicIds: source.topics.map((topic) => topic.topicId).sort(),
      questionCount: source.requestedQuestionCount,
    }, source.id, random);
  });
  return attemptDetailDto(attempt);
}

export async function listAttempts(userId: string, input: AttemptListInput) {
  await expireDueAttempts({ limit: 50, userId });
  const where: Prisma.AssessmentAttemptWhereInput = {
    userId, assessmentType: input.assessmentType, status: input.status, organSystemId: input.organSystemId,
  };
  const [total, items] = await prisma.$transaction([
    prisma.assessmentAttempt.count({ where }),
    prisma.assessmentAttempt.findMany({
      where, include: { topics: { orderBy: { topicId: "asc" } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (input.page - 1) * input.pageSize, take: input.pageSize,
    }),
  ]);
  return {
    items: items.map(attemptListItemDto),
    pagination: { page: input.page, pageSize: input.pageSize, total, totalPages: Math.ceil(total / input.pageSize) },
  };
}

import "server-only";

import { Prisma } from "@prisma/client";

import { refreshTopicProgressPairs } from "@/features/progress/projection";
import { prisma } from "@/lib/db/prisma";
import { AssessmentError, calculateAttemptResult, durationSeconds, hasTestExpired } from "./domain";

const TRANSACTION_ATTEMPTS = 3;
const RETRYABLE_POSTGRES_CODES = new Set(["40001", "40P01"]);
export const attemptInclude = {
  topics: { orderBy: { topicId: "asc" as const } },
  questions: { orderBy: { displayOrder: "asc" as const } },
};
type LockedAttempt = Prisma.AssessmentAttemptGetPayload<{ include: typeof attemptInclude }>;

export async function databaseNow(tx: Prisma.TransactionClient) {
  const rows = await tx.$queryRaw<Array<{ now: Date }>>(Prisma.sql`SELECT clock_timestamp() AS now`);
  return rows[0].now;
}

export async function retryAssessmentTransaction<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>) {
  for (let number = 1; number <= TRANSACTION_ATTEMPTS; number += 1) {
    try {
      return await prisma.$transaction(callback, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      const retryable = error instanceof Prisma.PrismaClientKnownRequestError && (
        error.code === "P2034"
        || (error.code === "P2010" && RETRYABLE_POSTGRES_CODES.has(String(error.meta?.code)))
      );
      if (retryable) {
        if (number < TRANSACTION_ATTEMPTS) continue;
        throw new AssessmentError("TRANSACTION_FAILED", "Assessment transaction could not be completed.", 409);
      }
      throw error;
    }
  }
  throw new AssessmentError("TRANSACTION_FAILED", "Assessment transaction could not be completed.", 409);
}

export async function lockOwnedAttempt(tx: Prisma.TransactionClient, attemptId: string, userId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id" FROM "AssessmentAttempt"
    WHERE "id" = ${attemptId}::uuid AND "userId" = ${userId}::uuid
    FOR UPDATE
  `);
  if (!rows.length) throw new AssessmentError("NOT_FOUND", "Attempt was not found.", 404);
  const attempt = await tx.assessmentAttempt.findUnique({ where: { id: attemptId }, include: attemptInclude });
  if (!attempt) throw new AssessmentError("NOT_FOUND", "Attempt was not found.", 404);
  return attempt;
}

async function finalizeLockedAttempts(tx: Prisma.TransactionClient, attempts: readonly LockedAttempt[], now: Date, forceAuto: boolean) {
  const active = attempts.filter((attempt) => attempt.status === "IN_PROGRESS");
  for (const attempt of active) {
    const autoSubmitted = forceAuto || hasTestExpired(attempt.assessmentType, attempt.expiresAt, now);
    const result = calculateAttemptResult(attempt.questions.map((question) => ({
      correctOptionKey: question.correctOptionKey,
      answeredOptionKey: question.answeredOptionKey,
    })));
    await tx.assessmentAttempt.update({
      where: { id: attempt.id },
      data: {
        ...result,
        status: autoSubmitted ? "AUTO_SUBMITTED" : "COMPLETED",
        completedAt: now,
        durationSeconds: durationSeconds(attempt.startedAt, now, attempt.timeLimitSeconds, autoSubmitted),
      },
    });
  }
  await refreshTopicProgressPairs(tx, active.flatMap((attempt) =>
    [...new Set(attempt.questions.map((question) => question.topicIdSnapshot))]
      .map((topicId) => ({ userId: attempt.userId, topicId }))));
  return active.length;
}

export async function finalizeLockedAttempt(tx: Prisma.TransactionClient, attempt: LockedAttempt, now: Date, forceAuto = false) {
  if (attempt.status !== "IN_PROGRESS") return attempt;
  await finalizeLockedAttempts(tx, [attempt], now, forceAuto);
  const finalized = await tx.assessmentAttempt.findUnique({ where: { id: attempt.id }, include: attemptInclude });
  if (!finalized) throw new AssessmentError("INTERNAL_ERROR", "Attempt result is unavailable.", 500);
  return finalized;
}

export async function readOwnedAttemptWithLazyExpiry(attemptId: string, userId: string) {
  return retryAssessmentTransaction(async (tx) => {
    const attempt = await lockOwnedAttempt(tx, attemptId, userId);
    if (attempt.status !== "IN_PROGRESS") return attempt;
    const now = await databaseNow(tx);
    return hasTestExpired(attempt.assessmentType, attempt.expiresAt, now)
      ? finalizeLockedAttempt(tx, attempt, now, true)
      : attempt;
  });
}

export async function expireDueAttempts({ limit, userId }: { limit: number; userId?: string }) {
  const boundedLimit = Math.max(1, Math.min(100, limit));
  return retryAssessmentTransaction(async (tx) => {
    const now = await databaseNow(tx);
    const userFilter = userId ? Prisma.sql`AND "userId" = ${userId}::uuid` : Prisma.empty;
    const claimed = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "AssessmentAttempt"
      WHERE "status" = 'IN_PROGRESS'::"AttemptStatus"
        AND "assessmentType" = 'TEST'::"AssessmentType"
        AND "expiresAt" <= ${now}
        ${userFilter}
      ORDER BY "expiresAt" ASC, "id" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${boundedLimit}
    `);
    if (!claimed.length) return { claimed: 0, finalized: 0 };
    const attempts = await tx.assessmentAttempt.findMany({
      where: { id: { in: claimed.map((row) => row.id) } },
      include: attemptInclude,
      orderBy: [{ expiresAt: "asc" }, { id: "asc" }],
    });
    const finalized = await finalizeLockedAttempts(tx, attempts, now, true);
    return { claimed: claimed.length, finalized };
  });
}

export async function finalizeDueAttemptById(attemptId: string) {
  return retryAssessmentTransaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "AssessmentAttempt" WHERE "id" = ${attemptId}::uuid FOR UPDATE
    `);
    if (!locked.length) return false;
    const attempt = await tx.assessmentAttempt.findUnique({ where: { id: attemptId }, include: attemptInclude });
    if (!attempt || attempt.status !== "IN_PROGRESS") return false;
    const now = await databaseNow(tx);
    if (!hasTestExpired(attempt.assessmentType, attempt.expiresAt, now)) return false;
    await finalizeLockedAttempt(tx, attempt, now, true);
    return true;
  });
}

import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ProgressError } from "./domain";
import { refreshTopicProgress } from "./projection";
import type { LessonProgressInput } from "./schemas";

export async function updateLessonProgress(
  contentLessonId: string,
  userId: string,
  input: LessonProgressInput,
  now = new Date(),
) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
    const lesson = await tx.contentLesson.findFirst({
      where: {
        id: contentLessonId,
        status: "PUBLISHED",
        topic: { status: "PUBLISHED", organSystem: { status: "PUBLISHED", isActive: true } },
      },
      select: { id: true, topicId: true },
    });
    if (!lesson) throw new ProgressError("NOT_FOUND", "Content lesson was not found.", 404);
    const existing = await tx.contentLessonProgress.findUnique({
      where: { userId_contentLessonId: { userId, contentLessonId } },
      select: { completedAt: true },
    });
    const completedAt = input.completed ? existing?.completedAt ?? now : null;
    const progress = await tx.contentLessonProgress.upsert({
      where: { userId_contentLessonId: { userId, contentLessonId } },
      create: { userId, contentLessonId, completedAt, lastViewedAt: now },
      update: { completedAt, lastViewedAt: now },
    });
    await refreshTopicProgress(tx, userId, lesson.topicId);
    return {
      contentLessonId: progress.contentLessonId,
      completed: progress.completedAt !== null,
      completedAt: progress.completedAt,
      lastViewedAt: progress.lastViewedAt,
    };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2034" || error.code === "P2002")) {
        if (attempt < 3) continue;
        throw new ProgressError("TRANSACTION_FAILED", "Lesson progress could not be updated.", 409);
      }
      throw error;
    }
  }
  throw new ProgressError("TRANSACTION_FAILED", "Lesson progress could not be updated.", 409);
}

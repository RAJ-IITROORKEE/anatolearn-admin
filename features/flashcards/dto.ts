import type { Flashcard, FlashcardProgress } from "@prisma/client";

type FlashcardDtoSource = Omit<Flashcard, "trashedAt" | "purgeAfter" | "nextPurgeAttemptAt"> & { topic?: { title: string } };

export function flashcardProgressDto(value: FlashcardProgress) {
  return {
    flashcardId: value.flashcardId,
    viewedCount: value.viewedCount,
    isDifficult: value.isDifficult,
    isMastered: value.isMastered,
    lastViewedAt: value.lastViewedAt,
  };
}

export function flashcardDto(value: FlashcardDtoSource, admin = false, progress?: FlashcardProgress | null) {
  return {
    id: value.id,
    topicId: value.topicId,
    frontText: value.frontText,
    backText: value.backText,
    frontImageUrl: value.frontImageUrl,
    frontMediaId: value.frontMediaId,
    backImageUrl: value.backImageUrl,
    backMediaId: value.backMediaId,
    difficulty: value.difficulty,
    displayOrder: value.displayOrder,
    ...(admin
      ? { notes: value.notes, status: value.status, topicTitle: value.topic?.title ?? null, createdAt: value.createdAt, updatedAt: value.updatedAt }
      : { progress: progress ? flashcardProgressDto(progress) : null }),
  };
}

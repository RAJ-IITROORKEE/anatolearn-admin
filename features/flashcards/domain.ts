import type { PublishStatus } from "@prisma/client";
import { ContentError } from "@/features/content/domain";

export class FlashcardError extends ContentError {}

export function assertFlashcardMutable(status: PublishStatus) {
  if (status === "ARCHIVED") {
    throw new FlashcardError("INVALID_STATUS_TRANSITION", "Archived flashcards cannot be changed.", 409);
  }
}

export function assertFlashcardStatusTransition(current: PublishStatus, next: PublishStatus) {
  if (current === "ARCHIVED" && next !== "ARCHIVED") {
    throw new FlashcardError("INVALID_STATUS_TRANSITION", "Archived flashcards cannot be restored.", 409);
  }
}

export function assertFlashcardPublishable(candidate: {
  topicStatus: PublishStatus;
  organSystemStatus: PublishStatus;
  organSystemIsActive: boolean;
  mediaEligible: boolean;
}) {
  if (candidate.topicStatus !== "PUBLISHED" || candidate.organSystemStatus !== "PUBLISHED" || !candidate.organSystemIsActive) {
    throw new FlashcardError("PARENT_NOT_PUBLISHED", "A published flashcard requires a published topic and active published organ system.", 409);
  }
  if (!candidate.mediaEligible) {
    throw new FlashcardError("INVALID_MEDIA_REFERENCE", "A published flashcard requires unarchived media.", 422);
  }
}

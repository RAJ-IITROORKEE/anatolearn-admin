import type { PublishStatus } from "@prisma/client";

export class ContentError extends Error {
  constructor(public code: string, message: string, public status: number, public details?: Record<string, string[]>) {
    super(message);
  }
}

export function assertStatusTransition(current: PublishStatus, next: PublishStatus) {
  if (current === "ARCHIVED" && next !== "ARCHIVED") {
    throw new ContentError("INVALID_STATUS_TRANSITION", "Archived content cannot be restored.", 409);
  }
}

type PublishedContentCandidate =
  | { resource: "organSystem"; status: PublishStatus; isActive: boolean }
  | { resource: "topic"; status: PublishStatus; parentStatus: PublishStatus; parentIsActive: boolean }
  | { resource: "contentLesson"; status: PublishStatus; contentBlocks: unknown; topicStatus: PublishStatus; organSystemStatus: PublishStatus; organSystemIsActive: boolean };

export function assertPublishedContentValid(candidate: PublishedContentCandidate) {
  if (candidate.status !== "PUBLISHED") return;
  if (candidate.resource === "organSystem" && !candidate.isActive) {
    throw new ContentError("INVALID_PUBLISHED_CONTENT", "A published organ system must remain active.", 409);
  }
  if (candidate.resource === "topic" && (candidate.parentStatus !== "PUBLISHED" || !candidate.parentIsActive)) {
    throw new ContentError("PARENT_NOT_PUBLISHED", "A published topic requires a published, active organ system.", 409);
  }
  if (candidate.resource === "contentLesson") {
    if (candidate.topicStatus !== "PUBLISHED" || candidate.organSystemStatus !== "PUBLISHED" || !candidate.organSystemIsActive) {
      throw new ContentError("PARENT_NOT_PUBLISHED", "A published lesson requires a published topic and active published organ system.", 409);
    }
    if (!Array.isArray(candidate.contentBlocks) || candidate.contentBlocks.length === 0) {
      throw new ContentError("EMPTY_LESSON", "A published lesson must contain at least one block.", 409);
    }
  }
}

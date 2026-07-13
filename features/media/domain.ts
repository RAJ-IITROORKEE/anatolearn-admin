export class MediaServiceError extends Error {
  constructor(
    public code: "NOT_FOUND" | "INVALID_FILE" | "STORAGE_ERROR" | "REFERENCED" | "HARD_DELETE_DISABLED",
    message: string,
  ) {
    super(message);
  }
}

export function containsMediaId(value: unknown, id: string): boolean {
  if (value === id) return true;
  if (Array.isArray(value)) return value.some((item) => containsMediaId(item, id));
  return value !== null && typeof value === "object" && Object.values(value).some((item) => containsMediaId(item, id));
}

export function hasPublishedMediaReference(
  references: {
    organSystemCovers: unknown[];
    organSystemIcons: unknown[];
    topicCovers: unknown[];
    flashcardFronts: unknown[];
    flashcardBacks: unknown[];
    questionMedia: unknown[];
    questionOptionMedia: unknown[];
  },
  lessons: Array<{ contentBlocks: unknown }>,
  mediaId: string,
) {
  return references.organSystemCovers.length > 0
    || references.organSystemIcons.length > 0
    || references.topicCovers.length > 0
    || references.flashcardFronts.length > 0
    || references.flashcardBacks.length > 0
    || references.questionMedia.length > 0
    || references.questionOptionMedia.length > 0
    || lessons.some((lesson) => containsMediaId(lesson.contentBlocks, mediaId));
}

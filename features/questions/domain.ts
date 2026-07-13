import type { PublishStatus } from "@prisma/client";

import type { QuestionOptionInput } from "./schemas";

export class QuestionError extends Error {
  constructor(public code: string, message: string, public status: number, public details?: Record<string, string[]>) {
    super(message);
  }
}

export function assertQuestionStatusTransition(current: PublishStatus, next: PublishStatus) {
  if (current === "ARCHIVED" && next !== "ARCHIVED") {
    throw new QuestionError("INVALID_STATUS_TRANSITION", "Archived questions cannot be restored.", 409);
  }
}

export function assertOptionSet(options: Array<{ isCorrect: boolean }>) {
  if (options.length < 2 || options.length > 6 || options.filter((option) => option.isCorrect).length !== 1) {
    throw new QuestionError("INVALID_OPTIONS", "A question must have 2-6 options and exactly one correct option.", 422);
  }
}

export function assertQuestionPublishable(candidate: {
  topicStatus: PublishStatus;
  organSystemStatus: PublishStatus;
  organSystemIsActive: boolean;
  mediaEligible: boolean;
  options: Array<{ isCorrect: boolean }>;
}) {
  if (candidate.topicStatus !== "PUBLISHED" || candidate.organSystemStatus !== "PUBLISHED" || !candidate.organSystemIsActive) {
    throw new QuestionError("PARENT_NOT_PUBLISHED", "A published question requires a published topic and active published organ system.", 409);
  }
  if (!candidate.mediaEligible) {
    throw new QuestionError("INVALID_MEDIA_REFERENCE", "Published questions require eligible, unarchived media.", 422);
  }
  assertOptionSet(candidate.options);
}

export function buildReplacementOptions(
  inputs: QuestionOptionInput[],
  existing: Array<{ id: string; key: string }> = [],
) {
  assertOptionSet(inputs);
  const existingById = new Map(existing.map((option) => [option.id, option]));
  return inputs.map((input, index) => {
    const preserved = input.id ? existingById.get(input.id) : undefined;
    if (input.id && !preserved) {
      throw new QuestionError("INVALID_OPTION_REFERENCE", "An option ID does not belong to this question.", 422);
    }
    return {
      id: preserved?.id ?? crypto.randomUUID(),
      key: preserved?.key ?? crypto.randomUUID(),
      label: String.fromCharCode(65 + index),
      displayOrder: index + 1,
      optionText: input.optionText,
      mediaId: input.mediaId ?? null,
      isCorrect: input.isCorrect,
    };
  });
}

import { AssessmentError, isSubmittedAttemptStatus, type SnapshotOption } from "./domain";

type DecimalLike = number | string | { toString(): string };
type DtoAttempt = {
  id: string; assessmentType: "QUIZ" | "TEST"; organSystemId: string; requestedQuestionCount: number; totalQuestionCount: number;
  correctCount: number; incorrectCount: number; unansweredCount: number; scorePercentage: DecimalLike; durationSeconds: number | null;
  timeLimitSeconds: number | null; startedAt: Date; expiresAt: Date | null; completedAt: Date | null;
  status: "IN_PROGRESS" | "COMPLETED" | "AUTO_SUBMITTED" | "ABANDONED"; retakeSourceId: string | null;
  topics: Array<{ topicId: string }>;
  questions: Array<{
    id: string; displayOrder: number; questionTextSnapshot: string; imageUrlSnapshot: string | null; mediaIdSnapshot: string | null; explanationSnapshot: string;
    optionsSnapshot: unknown; correctOptionKey: string; answeredOptionKey: string | null; isCorrect: boolean | null;
    answeredAt: Date | null; timeSpentSeconds: number | null; topicIdSnapshot: string; topicTitleSnapshot: string;
    difficultySnapshot: "EASY" | "MEDIUM" | "HARD"; conceptTagSnapshot: string | null;
    organSystemIdSnapshot: string; organSystemNameSnapshot: string;
  }>;
};

function options(value: unknown): SnapshotOption[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > 6) throw new AssessmentError("INVALID_SNAPSHOT", "Attempt snapshot is invalid.", 500);
  const parsed = value as SnapshotOption[];
  if (parsed.some((option, index) => typeof option?.key !== "string" || option.label !== String.fromCharCode(65 + index) || option.displayOrder !== index + 1 || typeof option.optionText !== "string")) {
    throw new AssessmentError("INVALID_SNAPSHOT", "Attempt snapshot is invalid.", 500);
  }
  return parsed;
}

function base(value: DtoAttempt) {
  return {
    id: value.id, assessmentType: value.assessmentType, organSystemId: value.organSystemId,
    topicIds: value.topics.map((topic) => topic.topicId), requestedQuestionCount: value.requestedQuestionCount,
    totalQuestionCount: value.totalQuestionCount, timeLimitSeconds: value.timeLimitSeconds,
    startedAt: value.startedAt, expiresAt: value.expiresAt, completedAt: value.completedAt,
    status: value.status, retakeSourceId: value.retakeSourceId,
  };
}

export function attemptDetailDto(value: DtoAttempt) {
  return {
    ...base(value),
    questions: value.questions.map((question) => ({
      id: question.id, displayOrder: question.displayOrder, questionText: question.questionTextSnapshot,
      imageUrl: question.imageUrlSnapshot, mediaId: question.mediaIdSnapshot, options: options(question.optionsSnapshot), answeredOptionKey: question.answeredOptionKey,
      answeredAt: question.answeredAt, timeSpentSeconds: question.timeSpentSeconds,
      topicId: question.topicIdSnapshot, topicTitle: question.topicTitleSnapshot, difficulty: question.difficultySnapshot,
      conceptTag: question.conceptTagSnapshot, organSystemId: question.organSystemIdSnapshot,
      organSystemName: question.organSystemNameSnapshot,
    })),
  };
}

export function attemptResultDto(value: DtoAttempt) {
  if (!isSubmittedAttemptStatus(value.status)) throw new AssessmentError("RESULT_NOT_READY", "Attempt result is not available unless it was submitted.", 409);
  return {
    ...base(value), correctCount: value.correctCount, incorrectCount: value.incorrectCount,
    unansweredCount: value.unansweredCount, scorePercentage: Number(value.scorePercentage.toString()), durationSeconds: value.durationSeconds,
    questions: value.questions.map((question) => ({
      id: question.id, displayOrder: question.displayOrder, questionText: question.questionTextSnapshot,
      imageUrl: question.imageUrlSnapshot, mediaId: question.mediaIdSnapshot, options: options(question.optionsSnapshot), answeredOptionKey: question.answeredOptionKey,
      correctOptionKey: question.correctOptionKey, isCorrect: question.isCorrect, explanation: question.explanationSnapshot,
      answeredAt: question.answeredAt, timeSpentSeconds: question.timeSpentSeconds,
      topicId: question.topicIdSnapshot, topicTitle: question.topicTitleSnapshot, difficulty: question.difficultySnapshot,
      conceptTag: question.conceptTagSnapshot, organSystemId: question.organSystemIdSnapshot,
      organSystemName: question.organSystemNameSnapshot,
    })),
  };
}

export function attemptListItemDto(value: Omit<DtoAttempt, "questions">) {
  const dto = base({ ...value, questions: [] });
  return !isSubmittedAttemptStatus(value.status) ? dto : {
    ...dto, correctCount: value.correctCount, incorrectCount: value.incorrectCount, unansweredCount: value.unansweredCount,
    scorePercentage: Number(value.scorePercentage.toString()), durationSeconds: value.durationSeconds,
  };
}

import type { Difficulty } from "@prisma/client";

export type SnapshotOption = {
  key: string;
  label: string;
  displayOrder: number;
  optionText: string;
  imageUrl: string | null;
  mediaId: string | null;
};

export type SnapshotCandidate = {
  id: string;
  questionText: string;
  imageUrl: string | null;
  mediaId?: string | null;
  explanation: string;
  difficulty: Difficulty;
  conceptTag: string | null;
  topicId: string;
  topic: { title: string; organSystem: { id: string; name: string } };
  options: Array<{ optionText: string; imageUrl: string | null; mediaId?: string | null; isCorrect: boolean }>;
};

export class AssessmentError extends Error {
  constructor(public code: string, message: string, public status: number, public details?: Record<string, string[]>) {
    super(message);
  }
}

export function isSubmittedAttemptStatus(status: "IN_PROGRESS" | "COMPLETED" | "AUTO_SUBMITTED" | "ABANDONED"): status is "COMPLETED" | "AUTO_SUBMITTED" {
  return status === "COMPLETED" || status === "AUTO_SUBMITTED";
}

export function fisherYates<T>(values: readonly T[], random: () => number = Math.random): T[] {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const sample = random();
    if (!Number.isFinite(sample) || sample < 0 || sample >= 1) throw new Error("Random source must return a value in [0, 1).");
    const target = Math.floor(sample * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

export function selectQuestionsByTopic<T extends { id: string; topicId: string }>(
  candidates: readonly T[],
  topicIds: readonly string[],
  count: number,
  random: () => number = Math.random,
) {
  const selected: T[] = [];
  for (const topicId of topicIds) {
    const topicCandidates = candidates.filter((candidate) => candidate.topicId === topicId);
    if (!topicCandidates.length) throw new AssessmentError("TOPIC_HAS_NO_QUESTIONS", "Every selected topic must have an eligible question.", 422, { topicIds: [topicId] });
    selected.push(fisherYates(topicCandidates, random)[0]);
  }
  const selectedIds = new Set(selected.map((question) => question.id));
  const remainder = fisherYates(candidates.filter((question) => !selectedIds.has(question.id)), random).slice(0, count - selected.length);
  return fisherYates([...selected, ...remainder], random);
}

export function buildAttemptSnapshots(
  candidates: readonly SnapshotCandidate[],
  random: () => number = Math.random,
  makeUuid: () => string = () => crypto.randomUUID(),
) {
  return candidates.map((question, questionIndex) => {
    const options = fisherYates(question.options, random).map((option, optionIndex) => ({
      key: makeUuid(),
      label: String.fromCharCode(65 + optionIndex),
      displayOrder: optionIndex + 1,
      optionText: option.optionText,
      imageUrl: option.imageUrl,
      mediaId: option.mediaId ?? null,
      isCorrect: option.isCorrect,
    }));
    const correct = options.find((option) => option.isCorrect);
    if (!correct) throw new AssessmentError("INVALID_QUESTION", "An eligible question has no correct option.", 500);
    return {
      sourceQuestionId: question.id,
      sourceQuestionSnapshotId: question.id,
      displayOrder: questionIndex + 1,
      questionTextSnapshot: question.questionText,
      imageUrlSnapshot: question.imageUrl,
      mediaIdSnapshot: question.mediaId ?? null,
      explanationSnapshot: question.explanation,
      optionsSnapshot: options.map((option) => ({
        key: option.key,
        label: option.label,
        displayOrder: option.displayOrder,
        optionText: option.optionText,
        imageUrl: option.imageUrl,
        mediaId: option.mediaId,
      })),
      correctOptionKey: correct.key,
      topicIdSnapshot: question.topicId,
      topicTitleSnapshot: question.topic.title,
      difficultySnapshot: question.difficulty,
      conceptTagSnapshot: question.conceptTag,
      organSystemIdSnapshot: question.topic.organSystem.id,
      organSystemNameSnapshot: question.topic.organSystem.name,
    };
  });
}

export function calculateAttemptResult(questions: ReadonlyArray<{ correctOptionKey: string; answeredOptionKey: string | null }>) {
  const correctCount = questions.filter((question) => question.answeredOptionKey === question.correctOptionKey).length;
  const unansweredCount = questions.filter((question) => question.answeredOptionKey === null).length;
  const incorrectCount = questions.length - correctCount - unansweredCount;
  const scorePercentage = Math.floor((correctCount * 20_000 + questions.length) / (2 * questions.length)) / 100;
  return { correctCount, incorrectCount, unansweredCount, scorePercentage };
}

export function hasTestExpired(type: "QUIZ" | "TEST", expiresAt: Date | null, now: Date) {
  return type === "TEST" && expiresAt !== null && now.getTime() >= expiresAt.getTime();
}

export function durationSeconds(startedAt: Date, completedAt: Date, timeLimitSeconds: number | null, autoSubmitted: boolean) {
  const elapsed = Math.max(0, Math.floor((completedAt.getTime() - startedAt.getTime()) / 1000));
  return autoSubmitted && timeLimitSeconds !== null ? Math.min(elapsed, timeLimitSeconds) : elapsed;
}

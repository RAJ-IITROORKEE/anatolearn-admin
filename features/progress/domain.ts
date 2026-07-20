export class ProgressError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}

export type ProgressMetric = {
  numerator: number;
  denominator: number;
  percentage: number;
};

export function percentage(numerator: number, denominator: number) {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 10_000) / 100;
}

export function metric(numerator: number, denominator: number): ProgressMetric {
  return { numerator, denominator, percentage: percentage(numerator, denominator) };
}

type ScoreInput = {
  content: { inventory: number; completed: number };
  quiz: { available: number; seen: number; correct: number };
  test: { available: number; seen: number; correct: number };
};

export function buildProgressScore(input: ScoreInput) {
  const contentValue = percentage(input.content.completed, input.content.inventory);
  const assessment = (value: ScoreInput["quiz"]) => {
    const coverage = metric(value.seen, value.available);
    const accuracy = metric(value.correct, value.seen);
    return { value: Math.round(((coverage.percentage + accuracy.percentage) / 2) * 100) / 100, coverage, accuracy };
  };
  const quiz = assessment(input.quiz);
  const test = assessment(input.test);
  const available = [
    { key: "content" as const, inventory: input.content.inventory, weight: 20, value: contentValue },
    { key: "quiz" as const, inventory: input.quiz.available, weight: 40, value: quiz.value },
    { key: "test" as const, inventory: input.test.available, weight: 40, value: test.value },
  ].filter((component) => component.inventory > 0);
  const weightTotal = available.reduce((sum, component) => sum + component.weight, 0);
  const normalizedWeight = (key: "content" | "quiz" | "test") => {
    const component = available.find((item) => item.key === key);
    return component ? Math.round((component.weight / weightTotal) * 10_000) / 100 : 0;
  };
  const value = available.length
    ? Math.round(available.reduce((sum, component) => sum + component.value * component.weight / weightTotal, 0) * 100) / 100
    : null;
  const hasActivity = input.content.completed > 0 || input.quiz.seen > 0 || input.test.seen > 0;
  const established = available.every((component) => component.value === 100);
  return {
    value,
    status: !hasActivity ? "NO_ACTIVITY" as const : established ? "ESTABLISHED" as const : "IN_PROGRESS" as const,
    components: {
      content: { value: contentValue, inventory: input.content.inventory, completed: input.content.completed, baseWeight: 20, normalizedWeight: normalizedWeight("content") },
      quiz: { ...quiz, available: input.quiz.available, seen: input.quiz.seen, latestAnswerCorrect: input.quiz.correct, baseWeight: 40, normalizedWeight: normalizedWeight("quiz") },
      test: { ...test, available: input.test.available, seen: input.test.seen, latestAnswerCorrect: input.test.correct, baseWeight: 40, normalizedWeight: normalizedWeight("test") },
    },
  };
}

type TopicQuestion = { topicId: string; topicTitle: string; isCorrect: boolean | null };

export function rankTopicPerformanceStats(stats: readonly { topicId: string; topicTitle: string; correctCount: number; sampleCount: number }[]) {
  const grouped = new Map<string, { topicId: string; topicTitle: string; correctCount: number; sampleCount: number }>();
  for (const stat of stats) {
    const current = grouped.get(stat.topicId) ?? {
      topicId: stat.topicId,
      topicTitle: stat.topicTitle,
      correctCount: 0,
      sampleCount: 0,
    };
    current.sampleCount += stat.sampleCount;
    current.correctCount += stat.correctCount;
    grouped.set(stat.topicId, current);
  }
  const eligible = [...grouped.values()]
    .filter((topic) => topic.sampleCount >= 5)
    .map((topic) => ({ ...topic, accuracyPercentage: percentage(topic.correctCount, topic.sampleCount) }));
  const tieBreak = (left: typeof eligible[number], right: typeof eligible[number]) =>
    right.sampleCount - left.sampleCount || left.topicId.localeCompare(right.topicId);
  return {
    strengths: [...eligible].sort((left, right) => right.accuracyPercentage - left.accuracyPercentage || tieBreak(left, right)).slice(0, 5),
    weaknesses: [...eligible].sort((left, right) => left.accuracyPercentage - right.accuracyPercentage || tieBreak(left, right)).slice(0, 5),
  };
}

export function rankTopicPerformance(questions: readonly TopicQuestion[]) {
  return rankTopicPerformanceStats(questions.map((question) => ({
    topicId: question.topicId,
    topicTitle: question.topicTitle,
    correctCount: question.isCorrect === true ? 1 : 0,
    sampleCount: 1,
  })));
}

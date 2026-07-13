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

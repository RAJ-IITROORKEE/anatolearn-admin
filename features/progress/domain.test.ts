import { describe, expect, it } from "vitest";

import { buildProgressScore, metric, rankTopicPerformance } from "./domain";

describe("progress calculations", () => {
  it("rounds weighted percentages to two decimals and keeps zero denominators neutral", () => {
    expect(metric(1, 3)).toEqual({ numerator: 1, denominator: 3, percentage: 33.33 });
    expect(metric(0, 0)).toEqual({ numerator: 0, denominator: 0, percentage: 0 });
  });

  it("counts every presented snapshot question, including unanswered questions", () => {
    const ranked = rankTopicPerformance([
      { topicId: "topic-a", topicTitle: "Historical title", isCorrect: true },
      { topicId: "topic-a", topicTitle: "Historical title", isCorrect: false },
      { topicId: "topic-a", topicTitle: "Historical title", isCorrect: null },
      { topicId: "topic-a", topicTitle: "Historical title", isCorrect: true },
      { topicId: "topic-a", topicTitle: "Historical title", isCorrect: null },
    ]);

    expect(ranked.strengths[0]).toEqual({ topicId: "topic-a", topicTitle: "Historical title", correctCount: 2, sampleCount: 5, accuracyPercentage: 40 });
  });

  it("requires five samples and applies deterministic ranking ties", () => {
    const rows = [
      ...Array.from({ length: 5 }, (_, index) => ({ topicId: "topic-b", topicTitle: "B", isCorrect: index < 4 })),
      ...Array.from({ length: 6 }, (_, index) => ({ topicId: "topic-a", topicTitle: "A", isCorrect: index < 4 })),
      ...Array.from({ length: 4 }, () => ({ topicId: "excluded", topicTitle: "Excluded", isCorrect: true })),
    ];

    const ranked = rankTopicPerformance(rows);
    expect(ranked.strengths.map((item) => item.topicId)).toEqual(["topic-b", "topic-a"]);
    expect(ranked.weaknesses.map((item) => item.topicId)).toEqual(["topic-a", "topic-b"]);
    expect(ranked.strengths).toHaveLength(2);
  });

  it("scores coverage plus latest-answer accuracy and renormalizes available components", () => {
    expect(buildProgressScore({
      content: { inventory: 0, completed: 0 },
      quiz: { available: 10, seen: 5, correct: 4 },
      test: { available: 0, seen: 0, correct: 0 },
    })).toMatchObject({
      value: 65,
      status: "IN_PROGRESS",
      components: { quiz: { value: 65, coverage: { percentage: 50 }, accuracy: { percentage: 80 }, normalizedWeight: 100 } },
    });
    expect(buildProgressScore({ content: { inventory: 0, completed: 0 }, quiz: { available: 0, seen: 0, correct: 0 }, test: { available: 0, seen: 0, correct: 0 } }).value).toBeNull();
  });
});

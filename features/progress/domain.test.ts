import { describe, expect, it } from "vitest";

import { metric, rankTopicPerformance } from "./domain";

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
});

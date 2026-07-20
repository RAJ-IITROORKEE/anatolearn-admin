import { describe, expect, it } from "vitest";

import { buildAttemptSnapshots, calculateAttemptResult, fisherYates, hasTestExpired, isSubmittedAttemptStatus, selectQuestionsByTopic } from "./domain";

const candidate = {
  id: "10000000-0000-4000-8000-000000000001",
  questionText: "Original prompt",
  imageUrl: null,
  explanation: "Original explanation",
  difficulty: "HARD" as const,
  conceptTag: "valves",
  topicId: "20000000-0000-4000-8000-000000000001",
  topic: { title: "Heart", organSystem: { id: "30000000-0000-4000-8000-000000000001", name: "Circulatory" } },
  options: [
    { optionText: "Correct", imageUrl: null, isCorrect: true },
    { optionText: "Wrong", imageUrl: "image", isCorrect: false },
  ],
};

describe("assessment domain", () => {
  it("performs injectable Fisher-Yates without mutating input", () => {
    const input = [1, 2, 3, 4];
    expect(fisherYates(input, () => 0)).toEqual([2, 3, 4, 1]);
    expect(input).toEqual([1, 2, 3, 4]);
    expect(() => fisherYates(input, () => 1)).toThrow();
  });

  it("creates attempt-local option keys and preserves randomized correctness mapping", () => {
    let uuid = 0;
    const snapshots = buildAttemptSnapshots([candidate], () => 0, () => `00000000-0000-4000-8000-${String(++uuid).padStart(12, "0")}`);
    expect(snapshots[0].optionsSnapshot.map((option) => option.label)).toEqual(["A", "B"]);
    expect(snapshots[0].optionsSnapshot.map((option) => option.displayOrder)).toEqual([1, 2]);
    expect(snapshots[0].correctOptionKey).toBe(snapshots[0].optionsSnapshot[1].key);
    expect(snapshots[0]).toMatchObject({ topicTitleSnapshot: "Heart", difficultySnapshot: "HARD", organSystemNameSnapshot: "Circulatory" });
  });

  it("scores only snapshot keys with positive half-up rounding", () => {
    const result = calculateAttemptResult([
      { correctOptionKey: "a", answeredOptionKey: "a" },
      ...Array.from({ length: 31 }, () => ({ correctOptionKey: "a", answeredOptionKey: "b" })),
    ]);
    expect(result).toEqual({ correctCount: 1, incorrectCount: 31, unansweredCount: 0, scorePercentage: 3.13 });
  });

  it("treats the exact deadline as expired", () => {
    const expiry = new Date("2026-01-01T00:05:00Z");
    expect(hasTestExpired("TEST", expiry, new Date(expiry))).toBe(true);
    expect(hasTestExpired("QUIZ", null, new Date(expiry))).toBe(false);
  });

  it("defines only completed and auto-submitted attempts as submitted", () => {
    expect(isSubmittedAttemptStatus("COMPLETED")).toBe(true);
    expect(isSubmittedAttemptStatus("AUTO_SUBMITTED")).toBe(true);
    expect(isSubmittedAttemptStatus("IN_PROGRESS")).toBe(false);
    expect(isSubmittedAttemptStatus("ABANDONED")).toBe(false);
  });

  it("selects at least one random question from every selected topic", () => {
    const candidates = [
      { ...candidate, id: "a1", topicId: "a" },
      { ...candidate, id: "a2", topicId: "a" },
      { ...candidate, id: "b1", topicId: "b" },
      { ...candidate, id: "b2", topicId: "b" },
    ];
    const selected = selectQuestionsByTopic(candidates, ["a", "b"], 3, () => 0);
    expect(selected).toHaveLength(3);
    expect(new Set(selected.map((question) => question.topicId))).toEqual(new Set(["a", "b"]));
    expect(new Set(selected.map((question) => question.id)).size).toBe(3);
  });

  it("reports the selected topic that has no eligible questions", () => {
    expect(() => selectQuestionsByTopic([{ ...candidate, id: "a1", topicId: "a" }], ["a", "b"], 2, () => 0))
      .toThrowError(expect.objectContaining({ code: "TOPIC_HAS_NO_QUESTIONS", details: { topicIds: ["b"] } }));
  });
});

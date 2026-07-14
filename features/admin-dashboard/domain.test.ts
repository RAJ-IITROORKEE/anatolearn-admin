import { describe, expect, it } from "vitest";

import { buildDailyAttemptTrend, metric } from "./domain";

describe("admin dashboard metrics", () => {
  it("calculates weighted accuracy and preserves an unanswered denominator", () => {
    expect(metric(3, 5)).toEqual({ numerator: 3, denominator: 5, percentage: 60 });
  });

  it("returns zero for an empty denominator", () => {
    expect(metric(0, 0)).toEqual({ numerator: 0, denominator: 0, percentage: 0 });
  });

  it("zero-fills every UTC day and keeps quiz and test series separate", () => {
    const result = buildDailyAttemptTrend(
      new Date("2026-07-12T00:00:00.000Z"),
      3,
      [
        { day: new Date("2026-07-12T00:00:00.000Z"), quizAttempts: 1, testAttempts: 0 },
        { day: new Date("2026-07-14T00:00:00.000Z"), quizAttempts: 2, testAttempts: 3 },
      ],
    );

    expect(result).toEqual([
      { date: "2026-07-12", quizAttempts: 1, testAttempts: 0 },
      { date: "2026-07-13", quizAttempts: 0, testAttempts: 0 },
      { date: "2026-07-14", quizAttempts: 2, testAttempts: 3 },
    ]);
  });
});

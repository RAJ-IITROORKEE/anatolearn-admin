export type DashboardMetric = {
  numerator: number;
  denominator: number;
  percentage: number;
};

export function metric(numerator: number, denominator: number): DashboardMetric {
  return {
    numerator,
    denominator,
    percentage: denominator === 0 ? 0 : Math.round((numerator / denominator) * 10_000) / 100,
  };
}

type AttemptTrendRow = {
  day: Date | string;
  quizAttempts: bigint | number;
  testAttempts: bigint | number;
};

export function buildDailyAttemptTrend(start: Date, days: number, rows: readonly AttemptTrendRow[]) {
  const byDay = new Map(rows.map((row) => [
    new Date(row.day).toISOString().slice(0, 10),
    { quizAttempts: Number(row.quizAttempts), testAttempts: Number(row.testAttempts) },
  ]));

  return Array.from({ length: days }, (_, index) => {
    const day = new Date(start);
    day.setUTCDate(day.getUTCDate() + index);
    const date = day.toISOString().slice(0, 10);
    return { date, ...(byDay.get(date) ?? { quizAttempts: 0, testAttempts: 0 }) };
  });
}

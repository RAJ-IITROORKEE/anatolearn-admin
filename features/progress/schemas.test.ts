import { describe, expect, it } from "vitest";

import { adminAttemptListSchema, lessonProgressSchema } from "./schemas";

describe("progress and reporting schemas", () => {
  it("accepts only an absolute lesson completion state", () => {
    expect(lessonProgressSchema.parse({ completed: true })).toEqual({ completed: true });
    expect(() => lessonProgressSchema.parse({ completed: true, userId: crypto.randomUUID() })).toThrow();
  });

  it("parses the complete admin attempt query and rejects unknown filters", () => {
    const parsed = adminAttemptListSchema.parse({
      page: "2", pageSize: "25", q: "learner", assessmentType: "TEST", status: "AUTO_SUBMITTED",
      from: "2026-07-01T00:00:00.000Z", to: "2026-07-13T23:59:59.000Z", sortBy: "scorePercentage", sortOrder: "asc",
    });
    expect(parsed).toMatchObject({ page: 2, pageSize: 25, assessmentType: "TEST", sortBy: "scorePercentage" });
    expect(parsed.from).toBeInstanceOf(Date);
    expect(() => adminAttemptListSchema.parse({ unexpected: "value" })).toThrow();
  });
});

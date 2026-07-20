import { describe, expect, it } from "vitest";

import { answerInputSchema, assessmentAvailabilitySchema, attemptListSchema, startAssessmentSchema } from "./schemas";

const systemId = "10000000-0000-4000-8000-000000000001";
const topicId = "20000000-0000-4000-8000-000000000001";

describe("assessment schemas", () => {
  it("accepts the strict start contract and omitted topic scope", () => {
    expect(startAssessmentSchema.parse({ assessmentType: "QUIZ", organSystemId: systemId, questionCount: 5 })).toEqual({
      assessmentType: "QUIZ", organSystemId: systemId, questionCount: 5,
    });
    expect(() => startAssessmentSchema.parse({ assessmentType: "QUIZ", organSystemId: systemId, topicIds: [topicId], questionCount: 5, extra: true })).toThrow();
  });

  it("rejects empty, duplicate, and out-of-range start values", () => {
    expect(() => startAssessmentSchema.parse({ assessmentType: "QUIZ", organSystemId: systemId, topicIds: [], questionCount: 5 })).toThrow();
    expect(() => startAssessmentSchema.parse({ assessmentType: "QUIZ", organSystemId: systemId, topicIds: [topicId, topicId], questionCount: 5 })).toThrow();
    expect(() => startAssessmentSchema.parse({ assessmentType: "TEST", organSystemId: systemId, questionCount: 51 })).toThrow();
  });

  it("accepts cross-system topic scope while preserving legacy system scope", () => {
    const otherTopicId = "20000000-0000-4000-8000-000000000002";
    expect(startAssessmentSchema.parse({ assessmentType: "QUIZ", topicIds: [topicId, otherTopicId], questionCount: 5 })).toEqual({
      assessmentType: "QUIZ", topicIds: [topicId, otherTopicId], questionCount: 5,
    });
    expect(() => startAssessmentSchema.parse({ assessmentType: "QUIZ", questionCount: 5 })).toThrow();
    expect(() => startAssessmentSchema.parse({ assessmentType: "QUIZ", topicIds: [topicId, otherTopicId], questionCount: 1 })).toThrow();
    expect(assessmentAvailabilitySchema.parse({ assessmentType: "TEST", topicIds: [topicId] })).toEqual({ assessmentType: "TEST", topicIds: [topicId] });
  });

  it("accepts answer clearing and bounds telemetry", () => {
    expect(answerInputSchema.parse({ answeredOptionKey: null })).toEqual({ answeredOptionKey: null });
    expect(answerInputSchema.parse({ answeredOptionKey: topicId, timeSpentSeconds: 0 }).timeSpentSeconds).toBe(0);
    expect(() => answerInputSchema.parse({ answeredOptionKey: null, timeSpentSeconds: 86_401 })).toThrow();
    expect(() => answerInputSchema.parse({ answeredOptionKey: null, unknown: 1 })).toThrow();
  });

  it("uses bounded learner pagination and filters", () => {
    expect(attemptListSchema.parse({})).toMatchObject({ page: 1, pageSize: 20 });
    expect(() => attemptListSchema.parse({ pageSize: 101 })).toThrow();
  });
});

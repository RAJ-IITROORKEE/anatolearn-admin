import { describe, expect, it } from "vitest";

import { isEligibleSelectionQuestion } from "./selection-service";

const candidate = {
  status: "PUBLISHED" as const,
  isActive: true,
  media: null,
  topic: { status: "PUBLISHED" as const, organSystem: { status: "PUBLISHED" as const, isActive: true } },
  options: [{ isCorrect: true, media: null }, { isCorrect: false, media: null }],
};

describe("internal question selection eligibility", () => {
  it("accepts only fully eligible published questions", () => {
    expect(isEligibleSelectionQuestion(candidate)).toBe(true);
    expect(isEligibleSelectionQuestion({ ...candidate, isActive: false })).toBe(false);
    expect(isEligibleSelectionQuestion({ ...candidate, topic: { ...candidate.topic, status: "DRAFT" } })).toBe(false);
    expect(isEligibleSelectionQuestion({ ...candidate, media: { archivedAt: new Date() } })).toBe(false);
    expect(isEligibleSelectionQuestion({ ...candidate, options: [{ isCorrect: true, media: null }] })).toBe(false);
  });
});

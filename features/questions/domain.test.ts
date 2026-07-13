import { describe, expect, it } from "vitest";

import {
  QuestionError,
  assertQuestionPublishable,
  assertQuestionStatusTransition,
  buildReplacementOptions,
} from "./domain";

const existing = [
  { id: crypto.randomUUID(), key: crypto.randomUUID() },
  { id: crypto.randomUUID(), key: crypto.randomUUID() },
];

describe("question option replacement", () => {
  it("generates labels/order/IDs/keys while preserving owned existing IDs and keys", () => {
    const replacement = buildReplacementOptions([
      { id: existing[1].id, optionText: "First", isCorrect: true },
      { optionText: "Second", isCorrect: false },
    ], existing);

    expect(replacement.map(({ label, displayOrder }) => ({ label, displayOrder }))).toEqual([
      { label: "A", displayOrder: 1 },
      { label: "B", displayOrder: 2 },
    ]);
    expect(replacement[0]).toMatchObject(existing[1]);
    expect(replacement[1].id).not.toBe(existing[0].id);
    expect(replacement[1].key).not.toBe(existing[0].key);
  });

  it("rejects option IDs not owned by the question", () => {
    expect(() => buildReplacementOptions([
      { id: crypto.randomUUID(), optionText: "First", isCorrect: true },
      { optionText: "Second", isCorrect: false },
    ], existing)).toThrow(QuestionError);
  });
});

describe("question lifecycle", () => {
  it("keeps archive terminal", () => {
    expect(() => assertQuestionStatusTransition("ARCHIVED", "DRAFT")).toThrow(QuestionError);
  });

  it("requires eligible parents, media, and valid options before publication", () => {
    expect(() => assertQuestionPublishable({
      topicStatus: "DRAFT", organSystemStatus: "PUBLISHED", organSystemIsActive: true,
      mediaEligible: true, options: [{ isCorrect: true }, { isCorrect: false }],
    })).toThrow("published topic");
    expect(() => assertQuestionPublishable({
      topicStatus: "PUBLISHED", organSystemStatus: "PUBLISHED", organSystemIsActive: true,
      mediaEligible: false, options: [{ isCorrect: true }, { isCorrect: false }],
    })).toThrow("media");
    expect(() => assertQuestionPublishable({
      topicStatus: "PUBLISHED", organSystemStatus: "PUBLISHED", organSystemIsActive: true,
      mediaEligible: true, options: [{ isCorrect: true }, { isCorrect: true }],
    })).toThrow("exactly one");
  });
});

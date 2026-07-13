import { describe, expect, it } from "vitest";

import { assertFlashcardMutable, assertFlashcardPublishable, assertFlashcardStatusTransition, FlashcardError } from "./domain";

describe("flashcard lifecycle", () => {
  it("keeps archive terminal", () => {
    expect(() => assertFlashcardStatusTransition("ARCHIVED", "DRAFT")).toThrow(FlashcardError);
    expect(() => assertFlashcardMutable("ARCHIVED")).toThrow(FlashcardError);
  });

  it("requires an eligible parent and media to publish", () => {
    expect(() => assertFlashcardPublishable({ topicStatus: "DRAFT", organSystemStatus: "PUBLISHED", organSystemIsActive: true, mediaEligible: true })).toThrow("published topic");
    expect(() => assertFlashcardPublishable({ topicStatus: "PUBLISHED", organSystemStatus: "PUBLISHED", organSystemIsActive: true, mediaEligible: false })).toThrow("unarchived media");
    expect(() => assertFlashcardPublishable({ topicStatus: "PUBLISHED", organSystemStatus: "PUBLISHED", organSystemIsActive: true, mediaEligible: true })).not.toThrow();
  });
});

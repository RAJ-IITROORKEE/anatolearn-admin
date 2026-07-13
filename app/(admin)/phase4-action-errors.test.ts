import { describe, expect, it } from "vitest";

import { FlashcardError } from "@/features/flashcards/domain";
import { QuestionError } from "@/features/questions/domain";
import { phase4ActionError } from "./phase4-action-errors";

describe("phase4ActionError", () => {
  it("returns safe domain messages", () => {
    expect(phase4ActionError(new FlashcardError("PARENT_NOT_PUBLISHED", "Publish the topic first.", 409))).toEqual({ error: "Publish the topic first." });
    expect(phase4ActionError(new QuestionError("INVALID_OPTIONS", "Choose one correct answer.", 422))).toEqual({ error: "Choose one correct answer." });
  });

  it("hides unexpected exception details", () => {
    expect(phase4ActionError(new Error("database password leaked"))).toEqual({ error: "The operation could not be completed." });
  });
});

import { describe, expect, it } from "vitest";

import { ContentError } from "@/features/content/domain";
import { MediaServiceError } from "@/features/media/domain";
import { phase3ActionError } from "./phase3-action-errors";

describe("phase3ActionError", () => {
  it("returns safe messages for known content and media errors", () => {
    expect(phase3ActionError(new ContentError("EMPTY_LESSON", "Add a lesson block.", 409))).toEqual({ error: "Add a lesson block." });
    expect(phase3ActionError(new MediaServiceError("INVALID_FILE", "Use a valid image."))).toEqual({ error: "Use a valid image." });
  });

  it("does not expose unexpected exception messages", () => {
    expect(phase3ActionError(new Error("database password was rejected"))).toEqual({ error: "The operation could not be completed." });
  });
});

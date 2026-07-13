import { describe, expect, it } from "vitest";

import { hasPublishedMediaReference } from "./domain";

const emptyReferences = {
  organSystemCovers: [],
  organSystemIcons: [],
  topicCovers: [],
  flashcardFronts: [],
  flashcardBacks: [],
  questionMedia: [],
  questionOptionMedia: [],
};

describe("published media eligibility", () => {
  it.each([
    "organSystemCovers",
    "organSystemIcons",
    "topicCovers",
    "flashcardFronts",
    "flashcardBacks",
    "questionMedia",
    "questionOptionMedia",
  ] as const)(
    "accepts an eligible %s reference",
    (relation) => {
      expect(hasPublishedMediaReference({ ...emptyReferences, [relation]: [{ id: "published" }] }, [], "media-id")).toBe(true);
    },
  );

  it("accepts an image block in an eligible published lesson", () => {
    expect(hasPublishedMediaReference(emptyReferences, [
      { contentBlocks: [{ type: "paragraph", text: "Other" }, { type: "image", mediaId: "media-id", altText: "Anatomy" }] },
    ], "media-id")).toBe(true);
  });

  it("rejects assets without an eligible published reference", () => {
    expect(hasPublishedMediaReference(emptyReferences, [
      { contentBlocks: [{ type: "image", mediaId: "different-id", altText: "Other" }] },
    ], "media-id")).toBe(false);
  });
});

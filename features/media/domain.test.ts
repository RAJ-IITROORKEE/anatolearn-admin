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

  it.each([
    ["legacy blocks", [{ type: "paragraph", text: "Other" }, { type: "image", mediaId: "media-id", altText: "Anatomy" }]],
    ["v2 fallback blocks", { version: 2, richContent: { type: "doc", content: [] }, fallbackBlocks: [{ type: "image", mediaId: "media-id", altText: "Anatomy" }] }],
  ])("accepts an image in eligible published lesson %s", (_label, contentBlocks) => {
    expect(hasPublishedMediaReference(emptyReferences, [{ contentBlocks }], "media-id")).toBe(true);
  });

  it("rejects assets without an eligible published reference", () => {
    expect(hasPublishedMediaReference(emptyReferences, [
      { contentBlocks: [{ type: "image", mediaId: "different-id", altText: "Other" }] },
    ], "media-id")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import { assertPublishedContentValid, assertStatusTransition, ContentError } from "./domain";

describe("content lifecycle", () => {
  it("allows draft publication and publication rollback", () => {
    expect(() => assertStatusTransition("DRAFT", "PUBLISHED")).not.toThrow();
    expect(() => assertStatusTransition("PUBLISHED", "DRAFT")).not.toThrow();
  });

  it("keeps archived content terminal", () => {
    expect(() => assertStatusTransition("ARCHIVED", "PUBLISHED")).toThrow(ContentError);
  });
});

describe("published content updates", () => {
  it("rejects empty blocks on an already-published lesson", () => {
    expect(() => assertPublishedContentValid({ resource: "contentLesson", status: "PUBLISHED", contentBlocks: [], topicStatus: "PUBLISHED", organSystemStatus: "PUBLISHED", organSystemIsActive: true })).toThrow("at least one block");
  });

  it("rejects moving published topics or lessons beneath ineligible parents", () => {
    expect(() => assertPublishedContentValid({ resource: "topic", status: "PUBLISHED", parentStatus: "DRAFT", parentIsActive: true })).toThrow(ContentError);
    expect(() => assertPublishedContentValid({ resource: "contentLesson", status: "PUBLISHED", contentBlocks: [{ type: "divider" }], topicStatus: "DRAFT", organSystemStatus: "PUBLISHED", organSystemIsActive: true })).toThrow(ContentError);
  });

  it("rejects deactivating a published organ system", () => {
    expect(() => assertPublishedContentValid({ resource: "organSystem", status: "PUBLISHED", isActive: false })).toThrow(ContentError);
  });

  it("allows valid published records and unrestricted draft edits", () => {
    expect(() => assertPublishedContentValid({ resource: "contentLesson", status: "PUBLISHED", contentBlocks: [{ type: "divider" }], topicStatus: "PUBLISHED", organSystemStatus: "PUBLISHED", organSystemIsActive: true })).not.toThrow();
    expect(() => assertPublishedContentValid({ resource: "contentLesson", status: "DRAFT", contentBlocks: [], topicStatus: "DRAFT", organSystemStatus: "DRAFT", organSystemIsActive: false })).not.toThrow();
  });
});

import { describe, expect, it } from "vitest";

import { adminFeedbackUpdateSchema, createFeedbackSchema, feedbackBulkTrashSchema, mineFeedbackListSchema } from "./schemas";

describe("feedback schemas", () => {
  it("accepts bounded strict submission input without attachment IDs", () => {
    expect(createFeedbackSchema.parse({ type: "BUG_REPORT", subject: "Broken quiz", message: "Details" })).toBeTruthy();
    expect(() => createFeedbackSchema.parse({ type: "GENERAL", subject: "x", message: "y", attachmentMediaId: crypto.randomUUID() })).toThrow();
    expect(() => createFeedbackSchema.parse({ type: "GENERAL", subject: "x".repeat(161), message: "y" })).toThrow();
  });

  it("requires at least one admin update and rejects unknown list keys", () => {
    expect(() => adminFeedbackUpdateSchema.parse({})).toThrow();
    expect(adminFeedbackUpdateSchema.parse({ adminNotes: null })).toEqual({ adminNotes: null });
    expect(() => mineFeedbackListSchema.parse({ userId: crypto.randomUUID() })).toThrow();
  });

  it("requires a bounded unique UUID set for bulk Trash", () => {
    const id = crypto.randomUUID();
    expect(feedbackBulkTrashSchema.parse({ ids: [id] })).toEqual({ ids: [id] });
    expect(() => feedbackBulkTrashSchema.parse({ ids: [] })).toThrow();
    expect(() => feedbackBulkTrashSchema.parse({ ids: [id, id] })).toThrow();
    expect(() => feedbackBulkTrashSchema.parse({ ids: ["not-a-uuid"] })).toThrow();
  });
});

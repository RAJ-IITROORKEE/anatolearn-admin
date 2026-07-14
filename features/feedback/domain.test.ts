import { describe, expect, it } from "vitest";

import { FeedbackError, planFeedbackUpdate } from "./domain";

const actorId = crypto.randomUUID();
const now = new Date("2026-07-14T12:00:00Z");

describe("feedback transitions", () => {
  it("implicitly reviews NEW feedback when notes change and preserves first reviewer", () => {
    expect(planFeedbackUpdate({ status: "NEW", adminNotes: null, reviewedById: null }, { adminNotes: "Investigating" }, actorId, now)).toMatchObject({
      changed: true, action: "REVIEW", data: { status: "REVIEWED", reviewedById: actorId, reviewedAt: now },
    });
    expect(planFeedbackUpdate({ status: "REVIEWED", adminNotes: null, reviewedById: "first" }, { adminNotes: "Updated" }, actorId, now).data.reviewedById).toBeUndefined();
  });

  it("requires REVIEWED before RESOLVED and keeps RESOLVED terminal", () => {
    expect(() => planFeedbackUpdate({ status: "NEW", adminNotes: null, reviewedById: null }, { status: "RESOLVED" }, actorId, now)).toThrow(FeedbackError);
    expect(planFeedbackUpdate({ status: "REVIEWED", adminNotes: null, reviewedById: "first" }, { status: "RESOLVED" }, actorId, now)).toMatchObject({
      action: "RESOLVE", data: { resolvedById: actorId, resolvedAt: now },
    });
    expect(() => planFeedbackUpdate({ status: "RESOLVED", adminNotes: null, reviewedById: "first" }, { status: "REVIEWED" }, actorId, now)).toThrow(FeedbackError);
  });

  it("detects no-ops while allowing notes edits on resolved feedback", () => {
    expect(planFeedbackUpdate({ status: "REVIEWED", adminNotes: "same", reviewedById: "first" }, { status: "REVIEWED", adminNotes: "same" }, actorId, now).changed).toBe(false);
    expect(planFeedbackUpdate({ status: "RESOLVED", adminNotes: "old", reviewedById: "first" }, { adminNotes: "new" }, actorId, now)).toMatchObject({ changed: true, action: "UPDATE" });
  });
});

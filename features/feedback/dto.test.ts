import { describe, expect, it } from "vitest";

import { adminFeedbackDto, learnerFeedbackDto } from "./dto";

const person = { id: crypto.randomUUID(), fullName: "Person", email: "person@example.com", isActive: true, emailNormalized: "secret" };
const feedback = {
  id: crypto.randomUUID(), userId: person.id, type: "GENERAL" as const, subject: "Subject", message: "Message",
  attachmentMediaId: null, rating: { toString: () => "4.5" }, status: "REVIEWED" as const, reviewedById: person.id, reviewedAt: new Date(),
  resolvedById: null, resolvedAt: null, adminNotes: "private", createdAt: new Date(), updatedAt: new Date(),
  user: person, reviewedBy: person, resolvedBy: null,
};

describe("feedback DTO privacy", () => {
  it("never exposes internal review fields to learners", () => {
    const dto = learnerFeedbackDto(feedback);
    expect(dto).not.toHaveProperty("adminNotes");
    expect(dto).not.toHaveProperty("reviewedBy");
    expect(dto).not.toHaveProperty("reviewedAt");
    expect(dto).not.toHaveProperty("userId");
    expect(dto).not.toHaveProperty("rating");
  });

  it("returns safe admin person summaries", () => {
    const dto = adminFeedbackDto(feedback);
    expect(dto.adminNotes).toBe("private");
    expect(dto.rating).toBe(4.5);
    expect(dto.submitter).toEqual({ id: person.id, fullName: "Person", email: "person@example.com", isActive: true, avatarUrl: null });
    expect(dto.reviewer).not.toHaveProperty("emailNormalized");
  });

  it("represents historical unrated feedback as unknown to admins", () => {
    expect(adminFeedbackDto({ ...feedback, rating: null }).rating).toBeNull();
  });

  it("does not expose a stale legacy avatar when managed signing fails", () => {
    const value = { ...feedback, user: { ...person, avatarUrl: "https://legacy.example/avatar.png" } };
    expect(adminFeedbackDto(value, new Map([[person.id, null]])).submitter?.avatarUrl).toBeNull();
  });
});

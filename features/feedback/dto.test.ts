import { describe, expect, it } from "vitest";

import { adminFeedbackDto, learnerFeedbackDto } from "./dto";

const person = { id: crypto.randomUUID(), fullName: "Person", email: "person@example.com", isActive: true, emailNormalized: "secret" };
const feedback = {
  id: crypto.randomUUID(), userId: person.id, type: "GENERAL" as const, subject: "Subject", message: "Message",
  attachmentMediaId: null, status: "REVIEWED" as const, reviewedById: person.id, reviewedAt: new Date(),
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
  });

  it("returns safe admin person summaries", () => {
    const dto = adminFeedbackDto(feedback);
    expect(dto.adminNotes).toBe("private");
    expect(dto.submitter).toEqual({ id: person.id, fullName: "Person", email: "person@example.com", isActive: true });
    expect(dto.reviewer).not.toHaveProperty("emailNormalized");
  });
});

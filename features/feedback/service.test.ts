import { beforeEach, describe, expect, it, vi } from "vitest";

const { tx, prisma } = vi.hoisted(() => {
  const tx = { $queryRaw: vi.fn(), feedback: { findUnique: vi.fn(), update: vi.fn() }, auditLog: { create: vi.fn() } };
  return { tx, prisma: {
    $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    feedback: { create: vi.fn(), findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn() },
  } };
});
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/prisma", () => ({ prisma }));

import { createFeedback, updateFeedback } from "./service";

const user = { id: crypto.randomUUID(), fullName: "Learner", email: "u@example.com", isActive: true };
const reviewer = { id: crypto.randomUUID(), fullName: "Admin", email: "a@example.com", isActive: true };
const stored = { id: crypto.randomUUID(), userId: user.id, type: "GENERAL", subject: "Subject", message: "Message", attachmentMediaId: null, status: "NEW", reviewedById: null, reviewedAt: null, resolvedById: null, resolvedAt: null, adminNotes: null, createdAt: new Date(), updatedAt: new Date(), user, reviewedBy: null, resolvedBy: null };

describe("feedback service", () => {
  beforeEach(() => { vi.clearAllMocks(); prisma.feedback.create.mockResolvedValue(stored); tx.feedback.findUnique.mockResolvedValue(stored); tx.feedback.update.mockResolvedValue({ ...stored, status: "REVIEWED", reviewedById: reviewer.id, reviewedBy: reviewer }); });

  it("derives the submitter and cannot persist arbitrary attachments", async () => {
    await createFeedback(user.id, { type: "GENERAL", subject: "Subject", message: "Message" });
    expect(prisma.feedback.create).toHaveBeenCalledWith(expect.objectContaining({ data: { userId: user.id, type: "GENERAL", subject: "Subject", message: "Message" } }));
  });

  it("locks and audits redacted transition metadata in the same transaction", async () => {
    await updateFeedback(stored.id, { adminNotes: "Sensitive details" }, { actorId: reviewer.id, requestId: "request" });
    expect(tx.$queryRaw.mock.calls[0][0].strings.join(" ")).toContain("FOR UPDATE");
    const audit = tx.auditLog.create.mock.calls[0][0].data;
    expect(audit.afterSnapshot).toMatchObject({ status: "REVIEWED", adminNotesChanged: true });
    expect(JSON.stringify(audit)).not.toContain("Sensitive details");
  });

  it("does not update or audit a no-op", async () => {
    tx.feedback.findUnique.mockResolvedValue({ ...stored, status: "REVIEWED", reviewedById: reviewer.id, reviewedBy: reviewer, adminNotes: "same" });
    await updateFeedback(stored.id, { status: "REVIEWED", adminNotes: "same" }, { actorId: reviewer.id, requestId: "request" });
    expect(tx.feedback.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});

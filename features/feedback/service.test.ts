import { beforeEach, describe, expect, it, vi } from "vitest";

const { tx, prisma } = vi.hoisted(() => {
  const tx = { $queryRaw: vi.fn(), feedback: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() }, auditLog: { create: vi.fn() } };
  return { tx, prisma: {
    $transaction: vi.fn((value: ((client: typeof tx) => unknown) | unknown[]) => typeof value === "function" ? value(tx) : Promise.all(value)),
    feedback: { create: vi.fn(), findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() },
  } };
});
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/prisma", () => ({ prisma }));

import { createFeedback, getAdminFeedback, listAdminFeedback, listMyFeedback, updateFeedback } from "./service";

const user = { id: crypto.randomUUID(), fullName: "Learner", email: "u@example.com", isActive: true };
const reviewer = { id: crypto.randomUUID(), fullName: "Admin", email: "a@example.com", isActive: true };
const stored = { id: crypto.randomUUID(), userId: user.id, type: "GENERAL", subject: "Subject", message: "Message", attachmentMediaId: null, rating: { toString: () => "4.5" }, status: "NEW", reviewedById: null, reviewedAt: null, resolvedById: null, resolvedAt: null, adminNotes: null, createdAt: new Date(), updatedAt: new Date(), user, reviewedBy: null, resolvedBy: null };

describe("feedback service", () => {
  beforeEach(() => { vi.clearAllMocks(); prisma.feedback.create.mockResolvedValue(stored); prisma.feedback.findMany.mockResolvedValue([]); prisma.feedback.count.mockResolvedValue(0); prisma.feedback.findFirst.mockResolvedValue(stored); tx.feedback.findFirst.mockResolvedValue(stored); tx.feedback.findUnique.mockResolvedValue(stored); tx.feedback.update.mockResolvedValue({ ...stored, status: "REVIEWED", reviewedById: reviewer.id, reviewedBy: reviewer }); });

  it("derives the submitter and cannot persist arbitrary attachments", async () => {
    await createFeedback(user.id, { type: "GENERAL", subject: "Subject", message: "Message", rating: 4.5 });
    expect(prisma.feedback.create).toHaveBeenCalledWith(expect.objectContaining({ data: { userId: user.id, type: "GENERAL", subject: "Subject", message: "Message", rating: 4.5 } }));
  });

  it("locks and audits redacted transition metadata in the same transaction", async () => {
    await updateFeedback(stored.id, { adminNotes: "Sensitive details" }, { actorId: reviewer.id, requestId: "request" });
    expect(tx.$queryRaw.mock.calls[0][0].strings.join(" ")).toContain("FOR UPDATE");
    const audit = tx.auditLog.create.mock.calls[0][0].data;
    expect(audit.afterSnapshot).toMatchObject({ status: "REVIEWED", adminNotesChanged: true });
    expect(JSON.stringify(audit)).not.toContain("Sensitive details");
  });

  it("does not update or audit a no-op", async () => {
    tx.feedback.findFirst.mockResolvedValue({ ...stored, status: "REVIEWED", reviewedById: reviewer.id, reviewedBy: reviewer, adminNotes: "same" });
    await updateFeedback(stored.id, { status: "REVIEWED", adminNotes: "same" }, { actorId: reviewer.id, requestId: "request" });
    expect(tx.feedback.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("excludes trashed feedback from learner and admin lists", async () => {
    await listMyFeedback(user.id, { page: 1, pageSize: 20 });
    expect(prisma.feedback.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { userId: user.id, type: undefined, status: undefined, trashedAt: null } }));
    expect(prisma.feedback.count).toHaveBeenLastCalledWith({ where: { userId: user.id, type: undefined, status: undefined, trashedAt: null } });

    await listAdminFeedback({ page: 1, pageSize: 20, sortBy: "createdAt", sortOrder: "desc" });
    expect(prisma.feedback.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: expect.objectContaining({ trashedAt: null }) }));
    expect(prisma.feedback.count).toHaveBeenLastCalledWith({ where: expect.objectContaining({ trashedAt: null }) });
  });

  it("hides trashed feedback from detail and update paths", async () => {
    await getAdminFeedback(stored.id);
    expect(prisma.feedback.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: stored.id, trashedAt: null } }));

    await updateFeedback(stored.id, { adminNotes: "Sensitive details" }, { actorId: reviewer.id, requestId: "request" });
    expect(tx.$queryRaw.mock.calls[0][0].strings.join(" ")).toContain('"trashedAt" IS NULL');
    expect(tx.feedback.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: stored.id, trashedAt: null } }));
  });
});

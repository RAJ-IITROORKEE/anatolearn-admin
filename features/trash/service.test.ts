import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  queryRaw: vi.fn(),
  tx: { $queryRaw: vi.fn(), $executeRaw: vi.fn(), auditLog: { create: vi.fn() } },
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: mocks.transaction, $queryRaw: mocks.queryRaw } }));

import { bulkMoveToTrash, listTrash, moveToTrash, restoreFromTrash } from "./service";

const context = { actorId: crypto.randomUUID(), requestId: crypto.randomUUID() };
const id = crypto.randomUUID();
const trashedAt = new Date("2026-07-14T12:00:00.000Z");
const purgeAfter = new Date("2026-08-13T12:00:00.000Z");

describe("trash service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation((callback: (tx: typeof mocks.tx) => unknown) => callback(mocks.tx));
  });

  it("is idempotent and never extends an existing deadline", async () => {
    mocks.tx.$queryRaw
      .mockResolvedValueOnce([{ id, label: "Heart", trashedAt, purgeAfter, nextPurgeAttemptAt: purgeAfter }])
      .mockResolvedValueOnce([{ now: new Date("2026-07-20T00:00:00.000Z") }]);

    const result = await moveToTrash("organ-system", id, context);

    expect(result.purgeAfter).toBe(purgeAfter.toISOString());
    expect(mocks.tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(mocks.tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("sets one exact 30-day retention window and audits the transition", async () => {
    mocks.tx.$queryRaw
      .mockResolvedValueOnce([{ id, label: "Heart", trashedAt: null, purgeAfter: null, nextPurgeAttemptAt: null }])
      .mockResolvedValueOnce([{ now: trashedAt }])
      .mockResolvedValueOnce([{ id, label: "Heart", trashedAt, purgeAfter, nextPurgeAttemptAt: purgeAfter }]);

    const result = await moveToTrash("organ-system", id, context);

    expect(new Date(result.purgeAfter).getTime() - new Date(result.trashedAt).getTime()).toBe(30 * 24 * 60 * 60 * 1000);
    expect(mocks.tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "TRASH" }) }));
  });

  it("does not archive media while any authoritative reference remains", async () => {
    mocks.tx.$queryRaw
      .mockResolvedValueOnce([{ id, label: "shared.png", trashedAt: null, purgeAfter: null, nextPurgeAttemptAt: null }])
      .mockResolvedValueOnce([{ now: trashedAt }])
      .mockResolvedValueOnce([{ id, uploadedById: context.actorId, trashedAt: null }])
      .mockResolvedValueOnce([{ referenced: true }]);

    await expect(moveToTrash("media-asset", id, context)).rejects.toMatchObject({ code: "PURGE_BLOCKED", status: 409 });

    expect(mocks.tx.$queryRaw).toHaveBeenCalledTimes(4);
    expect(mocks.tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("moves one feedback item without changing workflow status or auditing private fields", async () => {
    mocks.tx.$queryRaw
      .mockResolvedValueOnce([{ id, label: "Patient Jane Doe", trashedAt: null, purgeAfter: null, nextPurgeAttemptAt: null }])
      .mockResolvedValueOnce([{ now: trashedAt }])
      .mockResolvedValueOnce([{ id, label: "Patient Jane Doe", trashedAt, purgeAfter, nextPurgeAttemptAt: purgeAfter }]);

    await moveToTrash("feedback", id, context);

    expect(mocks.tx.$queryRaw.mock.calls[2][0].strings.join(" ")).not.toContain('"status"');
    const audit = mocks.tx.auditLog.create.mock.calls[0][0].data;
    expect(audit.beforeSnapshot).toEqual({ trashedAt: null });
    expect(audit.afterSnapshot).toEqual({ trashedAt: trashedAt.toISOString(), purgeAfter: purgeAfter.toISOString() });
    expect(JSON.stringify(audit)).not.toContain("Patient Jane Doe");
  });

  it("locks bulk Trash IDs deterministically, validates the full set, and audits each item", async () => {
    const secondId = "10000000-0000-4000-8000-000000000001";
    mocks.tx.$queryRaw
      .mockResolvedValueOnce([
        { id: secondId, label: "Second", trashedAt: null, purgeAfter: null, nextPurgeAttemptAt: null },
        { id, label: "First", trashedAt: null, purgeAfter: null, nextPurgeAttemptAt: null },
      ])
      .mockResolvedValueOnce([
        { id: secondId, label: "Second", trashedAt, purgeAfter, nextPurgeAttemptAt: purgeAfter },
        { id, label: "First", trashedAt, purgeAfter, nextPurgeAttemptAt: purgeAfter },
      ]);

    const result = await bulkMoveToTrash("question", [id, secondId], context);

    expect(result).toEqual({ count: 2, ids: [id, secondId] });
    const lock = mocks.tx.$queryRaw.mock.calls[0][0];
    expect(lock.strings.join(" ")).toContain("ORDER BY \"id\" FOR UPDATE");
    expect(lock.values).toEqual([secondId, id].sort());
    expect(mocks.tx.auditLog.create).toHaveBeenCalledTimes(2);
    expect(mocks.tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "TRASH" }) }));
  });

  it("does not write or audit when any selected bulk Trash row is unavailable", async () => {
    mocks.tx.$queryRaw.mockResolvedValueOnce([]);

    await expect(bulkMoveToTrash("flashcard", [id], context)).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });

    expect(mocks.tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(mocks.tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("moves feedback in bulk without changing workflow status or leaking its subject", async () => {
    const sensitiveSubject = "Patient Jane Doe at jane@example.com";
    mocks.tx.$queryRaw
      .mockResolvedValueOnce([{ id, label: sensitiveSubject, trashedAt: null, purgeAfter: null, nextPurgeAttemptAt: null }])
      .mockResolvedValueOnce([{ id, label: sensitiveSubject, trashedAt, purgeAfter, nextPurgeAttemptAt: purgeAfter }]);

    await expect(bulkMoveToTrash("feedback", [id], context)).resolves.toEqual({ count: 1, ids: [id] });

    const update = mocks.tx.$queryRaw.mock.calls[1][0];
    expect(update.strings.join(" ")).not.toContain('"status"');
    const audit = mocks.tx.auditLog.create.mock.calls[0][0].data;
    expect(audit.beforeSnapshot).toEqual({ trashedAt: null });
    expect(Object.keys(audit.afterSnapshot)).toEqual(["trashedAt", "purgeAfter"]);
    expect(JSON.stringify(audit)).not.toContain(sensitiveSubject);
    expect(audit).toMatchObject({ action: "TRASH", entityType: "Feedback" });
  });

  it("maps a heterogeneous filtered query with stable pagination", async () => {
    mocks.queryRaw.mockResolvedValue([{
      id,
      type: "question",
      label: "Which chamber?",
      trashedAt,
      purgeAfter,
      nextPurgeAttemptAt: purgeAfter,
      blockerReason: "Referenced by assessment attempts",
      blockerCount: 2,
      total: BigInt(1),
      now: purgeAfter,
    }]);
    const result = await listTrash({ page: 1, pageSize: 20, q: "chamber", type: "question", expiry: "expired", eligibility: "blocked", sort: "purgeAfter-asc" });
    expect(result).toEqual({
      items: [expect.objectContaining({ id, type: "question", eligibility: "BLOCKED", blocker: { reason: "Referenced by assessment attempts", count: 2 } })],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });
    expect(mocks.queryRaw).toHaveBeenCalledTimes(1);
    expect(mocks.queryRaw.mock.calls[0][0].strings.join(" ")).toContain("FROM \"Feedback\"");
  });

  it("counts legacy and v2 lesson media references as Trash purge blockers", async () => {
    mocks.queryRaw.mockResolvedValue([]);

    await listTrash({ page: 1, pageSize: 20, expiry: "all", eligibility: "all", sort: "purgeAfter-asc" });

    const query = mocks.queryRaw.mock.calls[0][0].strings.join(" ");
    expect(query).toContain("jsonb_typeof(x.\"contentBlocks\") = 'array'");
    expect(query).toContain("x.\"contentBlocks\"->'fallbackBlocks'");
  });

  it("locks both topic and organ-system ancestors before restoring a child", async () => {
    mocks.tx.$queryRaw
      .mockResolvedValueOnce([{ id, label: "Lesson", trashedAt, purgeAfter, nextPurgeAttemptAt: purgeAfter }])
      .mockResolvedValueOnce([{ topicTrashedAt: null, systemTrashedAt: null }])
      .mockResolvedValueOnce([{ now: trashedAt }]);

    await restoreFromTrash("content-lesson", id, context);

    const parentQuery = mocks.tx.$queryRaw.mock.calls[1][0];
    expect(parentQuery.strings.join(" ")).toContain('JOIN "OrganSystem"');
    expect(parentQuery.strings.join(" ")).toContain("FOR SHARE OF topic, system");
  });

  it("rejects child restore when the organ-system ancestor is trashed", async () => {
    mocks.tx.$queryRaw
      .mockResolvedValueOnce([{ id, label: "Question", trashedAt, purgeAfter, nextPurgeAttemptAt: purgeAfter }])
      .mockResolvedValueOnce([{ topicTrashedAt: null, systemTrashedAt: trashedAt }]);

    await expect(restoreFromTrash("question", id, context)).rejects.toMatchObject({ code: "PARENT_UNAVAILABLE", status: 409 });
    expect(mocks.tx.$executeRaw).not.toHaveBeenCalled();
  });

  it("restores feedback without changing its workflow status", async () => {
    mocks.tx.$queryRaw
      .mockResolvedValueOnce([{ id, label: "Private subject", trashedAt, purgeAfter, nextPurgeAttemptAt: purgeAfter }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ now: trashedAt }]);

    await expect(restoreFromTrash("feedback", id, context)).resolves.toEqual({ id, type: "feedback", restored: true });

    expect(mocks.tx.$executeRaw.mock.calls[0][0].strings.join(" ")).not.toContain('"status"');
    expect(JSON.stringify(mocks.tx.auditLog.create.mock.calls[0][0].data)).not.toContain("Private subject");
  });

  it("share-locks an available feedback attachment using only Trash state", async () => {
    mocks.tx.$queryRaw
      .mockResolvedValueOnce([{ id, label: "Private subject", trashedAt, purgeAfter, nextPurgeAttemptAt: purgeAfter }])
      .mockResolvedValueOnce([{ trashedAt: null }])
      .mockResolvedValueOnce([{ now: trashedAt }]);

    await restoreFromTrash("feedback", id, context);

    const attachmentQuery = mocks.tx.$queryRaw.mock.calls[1][0];
    const sql = attachmentQuery.strings.join(" ");
    expect(sql).toContain('JOIN "MediaAsset" media');
    expect(sql).toContain('FOR SHARE OF media');
    expect(sql).not.toMatch(/"subject"|"message"|"adminNotes"|"originalFilename"|"path"|"bucket"/);
  });

  it("rejects feedback restore when its attachment remains trashed without auditing metadata", async () => {
    mocks.tx.$queryRaw
      .mockResolvedValueOnce([{ id, label: "Private subject", trashedAt, purgeAfter, nextPurgeAttemptAt: purgeAfter }])
      .mockResolvedValueOnce([{ trashedAt }]);

    await expect(restoreFromTrash("feedback", id, context)).rejects.toMatchObject({ code: "PARENT_UNAVAILABLE", status: 409 });

    expect(mocks.tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(mocks.tx.$executeRaw).not.toHaveBeenCalled();
    expect(mocks.tx.auditLog.create).not.toHaveBeenCalled();
  });
});

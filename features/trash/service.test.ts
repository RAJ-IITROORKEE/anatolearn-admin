import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  queryRaw: vi.fn(),
  tx: { $queryRaw: vi.fn(), $executeRaw: vi.fn(), auditLog: { create: vi.fn() } },
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: mocks.transaction, $queryRaw: mocks.queryRaw } }));

import { listTrash, moveToTrash, restoreFromTrash } from "./service";

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
});

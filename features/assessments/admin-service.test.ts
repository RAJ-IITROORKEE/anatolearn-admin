import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  count: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
  expireDueAttempts: vi.fn(),
  finalizeDueAttemptById: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    assessmentAttempt: { count: mocks.count, findMany: mocks.findMany, findUnique: mocks.findUnique },
  },
}));
vi.mock("./finalization-service", () => ({
  expireDueAttempts: mocks.expireDueAttempts,
  finalizeDueAttemptById: mocks.finalizeDueAttemptById,
}));

import { getAdminAttempt, listAdminAttempts } from "./admin-service";

describe("admin attempt reporting service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockResolvedValue([[], 0]);
    mocks.expireDueAttempts.mockResolvedValue({ claimed: 0, finalized: 0 });
    mocks.finalizeDueAttemptById.mockResolvedValue(false);
  });

  it("applies identity, snapshot-topic, date, status, and stable sort filters", async () => {
    const from = new Date("2026-07-01T00:00:00Z");
    const to = new Date("2026-07-13T00:00:00Z");
    await listAdminAttempts({
      page: 1, pageSize: 20, q: "learner", userId: "user", assessmentType: "TEST", organSystemId: "system",
      topicId: "topic", status: "COMPLETED", from, to, sortBy: "scorePercentage", sortOrder: "asc",
    });
    const query = mocks.findMany.mock.calls[0][0];
    expect(query.where).toMatchObject({
      userId: "user", assessmentType: "TEST", organSystemId: "system", status: "COMPLETED",
      startedAt: { gte: from, lte: to }, questions: { some: { topicIdSnapshot: "topic" } },
    });
    expect(query.where.user.OR).toHaveLength(2);
    expect(query.orderBy).toEqual([{ scorePercentage: "asc" }, { id: "asc" }]);
    expect(mocks.expireDueAttempts).toHaveBeenCalledWith({ limit: 50 });
  });

  it("returns absent attempt details as 404", async () => {
    mocks.findUnique.mockResolvedValue(null);
    await expect(getAdminAttempt("missing")).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
    expect(mocks.finalizeDueAttemptById).toHaveBeenCalledWith("missing");
  });
});

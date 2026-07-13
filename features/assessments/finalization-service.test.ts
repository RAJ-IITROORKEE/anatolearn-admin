import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  refreshPairs: vi.fn(),
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("@/features/progress/projection", () => ({ refreshTopicProgressPairs: mocks.refreshPairs }));

import { expireDueAttempts, finalizeDueAttemptById } from "./finalization-service";

const now = new Date("2026-07-13T12:00:00Z");
const question = {
  id: "question", correctOptionKey: "correct", answeredOptionKey: "correct", isCorrect: true,
  topicIdSnapshot: "20000000-0000-4000-8000-000000000001",
};
const attempt = {
  id: "10000000-0000-4000-8000-000000000001", userId: "30000000-0000-4000-8000-000000000001",
  status: "IN_PROGRESS", assessmentType: "TEST", startedAt: new Date("2026-07-13T11:59:00Z"), expiresAt: now,
  timeLimitSeconds: 60, questions: [question], topics: [],
};

function tx() {
  return {
    $queryRaw: vi.fn().mockResolvedValueOnce([{ now }]).mockResolvedValueOnce([{ id: attempt.id }]),
    assessmentAttempt: {
      findMany: vi.fn().mockResolvedValue([attempt]),
      update: vi.fn().mockResolvedValue({ ...attempt, status: "AUTO_SUBMITTED" }),
      findUnique: vi.fn().mockResolvedValue({ ...attempt, status: "AUTO_SUBMITTED" }),
    },
  };
}

describe("bounded due-attempt finalization", () => {
  beforeEach(() => vi.clearAllMocks());

  it("claims due tests with SKIP LOCKED and finalizes without per-question writes", async () => {
    const client = tx();
    mocks.transaction.mockImplementation((callback: (value: typeof client) => unknown) => callback(client));
    await expect(expireDueAttempts({ limit: 25 })).resolves.toEqual({ claimed: 1, finalized: 1 });
    const lock = client.$queryRaw.mock.calls[1][0];
    expect(lock.strings.join(" ")).toContain("FOR UPDATE SKIP LOCKED");
    expect(lock.values).toContain(25);
    expect(client.assessmentAttempt.update).toHaveBeenCalledOnce();
    expect(mocks.refreshPairs).toHaveBeenCalledOnce();
    expect(mocks.refreshPairs).toHaveBeenCalledWith(client, [{ userId: attempt.userId, topicId: question.topicIdSnapshot }]);
    expect(client).not.toHaveProperty("attemptQuestion");
  });

  it("is idempotent when another worker already claimed all due attempts", async () => {
    const client = tx();
    client.$queryRaw.mockReset().mockResolvedValueOnce([{ now }]).mockResolvedValueOnce([]);
    mocks.transaction.mockImplementation((callback: (value: typeof client) => unknown) => callback(client));
    await expect(expireDueAttempts({ limit: 10 })).resolves.toEqual({ claimed: 0, finalized: 0 });
    expect(client.assessmentAttempt.update).not.toHaveBeenCalled();
    expect(mocks.refreshPairs).not.toHaveBeenCalled();
  });

  it("retries serialization conflicts and maps exhaustion safely", async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError("conflict", { code: "P2034", clientVersion: "test" });
    mocks.transaction.mockRejectedValue(conflict);
    await expect(expireDueAttempts({ limit: 10 })).rejects.toMatchObject({ code: "TRANSACTION_FAILED", status: 409 });
    expect(mocks.transaction).toHaveBeenCalledTimes(3);
  });

  it("locks and finalizes a specifically requested expired admin detail", async () => {
    const client = tx();
    client.$queryRaw.mockReset().mockResolvedValueOnce([{ id: attempt.id }]).mockResolvedValueOnce([{ now }]);
    client.assessmentAttempt.findUnique
      .mockResolvedValueOnce(attempt)
      .mockResolvedValueOnce({ ...attempt, status: "AUTO_SUBMITTED", completedAt: now });
    mocks.transaction.mockImplementation((callback: (value: typeof client) => unknown) => callback(client));
    await expect(finalizeDueAttemptById(attempt.id)).resolves.toBe(true);
    expect(client.$queryRaw.mock.calls[0][0].strings.join(" ")).toContain("FOR UPDATE");
    expect(client.assessmentAttempt.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "AUTO_SUBMITTED" }),
    }));
  });
});

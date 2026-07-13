import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  tx: {
    contentLesson: { findFirst: vi.fn() },
    contentLessonProgress: { findUnique: vi.fn(), upsert: vi.fn() },
  },
  transaction: vi.fn(),
  refreshTopicProgress: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("./projection", () => ({ refreshTopicProgress: mocks.refreshTopicProgress }));

import { updateLessonProgress } from "./lesson-service";

const now = new Date("2026-07-13T10:00:00.000Z");

describe("lesson progress service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation((callback: (tx: typeof mocks.tx) => unknown) => callback(mocks.tx));
    mocks.tx.contentLesson.findFirst.mockResolvedValue({ id: "lesson", topicId: "topic" });
    mocks.tx.contentLessonProgress.findUnique.mockResolvedValue(null);
    mocks.tx.contentLessonProgress.upsert.mockResolvedValue({ contentLessonId: "lesson", completedAt: now, lastViewedAt: now });
  });

  it("writes an absolute completion state and refreshes the topic in the same transaction", async () => {
    const result = await updateLessonProgress("lesson", "user", { completed: true }, now);
    expect(result).toEqual({ contentLessonId: "lesson", completed: true, completedAt: now, lastViewedAt: now });
    expect(mocks.tx.contentLessonProgress.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ userId: "user", completedAt: now }),
      update: expect.objectContaining({ completedAt: now, lastViewedAt: now }),
    }));
    expect(mocks.refreshTopicProgress).toHaveBeenCalledWith(mocks.tx, "user", "topic");
  });

  it("preserves the first completion timestamp on a completed replay", async () => {
    const first = new Date("2026-07-12T10:00:00.000Z");
    mocks.tx.contentLessonProgress.findUnique.mockResolvedValue({ completedAt: first });
    mocks.tx.contentLessonProgress.upsert.mockResolvedValue({ contentLessonId: "lesson", completedAt: first, lastViewedAt: now });
    await updateLessonProgress("lesson", "user", { completed: true }, now);
    expect(mocks.tx.contentLessonProgress.upsert.mock.calls[0][0].update.completedAt).toEqual(first);
  });

  it("returns inaccessible lessons as indistinguishable not found", async () => {
    mocks.tx.contentLesson.findFirst.mockResolvedValue(null);
    await expect(updateLessonProgress("lesson", "user", { completed: true }, now)).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
    expect(mocks.tx.contentLessonProgress.upsert).not.toHaveBeenCalled();
  });

  it("retries serialization conflicts and returns a safe conflict after exhaustion", async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError("conflict", { code: "P2034", clientVersion: "test" });
    mocks.transaction.mockRejectedValue(conflict);
    await expect(updateLessonProgress("lesson", "user", { completed: true }, now)).rejects.toMatchObject({ code: "TRANSACTION_FAILED", status: 409 });
    expect(mocks.transaction).toHaveBeenCalledTimes(3);
  });
});

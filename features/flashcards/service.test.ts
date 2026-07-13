import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    flashcard: { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    topic: { findUnique: vi.fn() },
    flashcardViewEvent: { findUnique: vi.fn(), create: vi.fn() },
    flashcardProgress: { findUnique: vi.fn(), upsert: vi.fn() },
    auditLog: { create: vi.fn() },
    $queryRaw: vi.fn(),
  };
  return {
    tx,
    prisma: {
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
      flashcardViewEvent: { findUnique: vi.fn() },
      flashcardProgress: { findUnique: vi.fn() },
    },
    refreshTopicProgress: vi.fn(),
  };
});

vi.mock("@/lib/db/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/features/progress/projection", () => ({ refreshTopicProgress: mocks.refreshTopicProgress }));

import { Prisma } from "@prisma/client";
import { bulkSetFlashcardStatus, setFlashcardStatus, updateFlashcard, updateFlashcardProgress } from "./service";

const userId = "10000000-0000-4000-8000-000000000001";
const flashcardId = "20000000-0000-4000-8000-000000000002";
const eventId = "30000000-0000-4000-8000-000000000003";
const now = new Date("2026-07-13T00:00:00.000Z");
const progress = {
  id: "40000000-0000-4000-8000-000000000004",
  userId,
  flashcardId,
  viewedCount: 1,
  isDifficult: false,
  isMastered: false,
  lastViewedAt: now,
  createdAt: now,
  updatedAt: now,
};
const card = {
  id: flashcardId,
  topicId: "50000000-0000-4000-8000-000000000005",
  frontText: "Front",
  backText: "Back",
  frontImageUrl: null,
  frontMediaId: null,
  backImageUrl: null,
  backMediaId: null,
  difficulty: "MEDIUM",
  notes: null,
  displayOrder: 0,
  status: "DRAFT",
  createdAt: now,
  updatedAt: now,
};

function prismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError("write conflict", { code, clientVersion: "test" });
}

describe("flashcard progress service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.prisma.$transaction.mockImplementation((callback: (client: typeof mocks.tx) => unknown) => callback(mocks.tx));
  });

  it("returns inaccessible cards as 404 without creating progress", async () => {
    mocks.tx.flashcard.findFirst.mockResolvedValue(null);
    await expect(updateFlashcardProgress(flashcardId, userId, { eventId })).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
    expect(mocks.tx.flashcardViewEvent.create).not.toHaveBeenCalled();
  });

  it("makes a repeated event a no-op", async () => {
    mocks.tx.flashcard.findFirst.mockResolvedValue({ id: flashcardId });
    mocks.tx.flashcardViewEvent.findUnique.mockResolvedValue({ userId, flashcardId, eventId });
    mocks.tx.flashcardProgress.findUnique.mockResolvedValue(progress);
    await expect(updateFlashcardProgress(flashcardId, userId, { eventId, isDifficult: true })).resolves.toMatchObject({ viewedCount: 1, isDifficult: false });
    expect(mocks.tx.flashcardViewEvent.create).not.toHaveBeenCalled();
    expect(mocks.tx.flashcardProgress.upsert).not.toHaveBeenCalled();
    expect(mocks.refreshTopicProgress).not.toHaveBeenCalled();
  });

  it("retries bounded serialization conflicts and then succeeds", async () => {
    mocks.tx.flashcard.findFirst.mockResolvedValue({ id: flashcardId, topicId: card.topicId });
    mocks.tx.flashcardViewEvent.findUnique.mockResolvedValue(null);
    mocks.tx.flashcardProgress.upsert.mockResolvedValue(progress);
    mocks.prisma.$transaction
      .mockRejectedValueOnce(prismaError("P2034"))
      .mockRejectedValueOnce(prismaError("P2034"))
      .mockImplementationOnce((callback: (client: typeof mocks.tx) => unknown) => callback(mocks.tx));

    await expect(updateFlashcardProgress(flashcardId, userId, { eventId })).resolves.toMatchObject({ viewedCount: 1 });
    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(3);
    expect(mocks.refreshTopicProgress).toHaveBeenCalledWith(mocks.tx, userId, card.topicId);
  });

  it("stops after the bounded serialization retry count", async () => {
    mocks.prisma.$transaction.mockRejectedValue(prismaError("P2034"));

    await expect(updateFlashcardProgress(flashcardId, userId, { eventId })).rejects.toMatchObject({ code: "TRANSACTION_FAILED", status: 409 });
    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(3);
  });

  it("preserves P2002 idempotency recovery", async () => {
    mocks.prisma.$transaction.mockRejectedValueOnce(prismaError("P2002"));
    mocks.prisma.flashcardViewEvent.findUnique.mockResolvedValue({ userId, flashcardId, eventId });
    mocks.prisma.flashcardProgress.findUnique.mockResolvedValue(progress);

    await expect(updateFlashcardProgress(flashcardId, userId, { eventId })).resolves.toMatchObject({ viewedCount: 1 });
    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("retries a distinct-event P2002 and succeeds", async () => {
    mocks.prisma.$transaction
      .mockRejectedValueOnce(prismaError("P2002"))
      .mockImplementationOnce((callback: (client: typeof mocks.tx) => unknown) => callback(mocks.tx));
    mocks.prisma.flashcardViewEvent.findUnique.mockResolvedValue(null);
    mocks.tx.flashcard.findFirst.mockResolvedValue({ id: flashcardId, topicId: card.topicId });
    mocks.tx.flashcardViewEvent.findUnique.mockResolvedValue(null);
    mocks.tx.flashcardProgress.upsert.mockResolvedValue(progress);
    await expect(updateFlashcardProgress(flashcardId, userId, { eventId })).resolves.toMatchObject({ viewedCount: 1 });
    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it("maps exhausted P2002 conflicts to a safe conflict", async () => {
    mocks.prisma.$transaction.mockRejectedValue(prismaError("P2002"));
    mocks.prisma.flashcardViewEvent.findUnique.mockResolvedValue(null);
    await expect(updateFlashcardProgress(flashcardId, userId, { eventId })).rejects.toMatchObject({ code: "TRANSACTION_FAILED", status: 409 });
    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(3);
  });
});

describe("flashcard mutation locks", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.prisma.$transaction.mockImplementation((callback: (client: typeof mocks.tx) => unknown) => callback(mocks.tx));
    mocks.tx.$queryRaw.mockResolvedValue([{ id: flashcardId }]);
    mocks.tx.flashcard.findUnique.mockResolvedValue(card);
    mocks.tx.topic.findUnique.mockResolvedValue({ status: "PUBLISHED", organSystem: { status: "PUBLISHED", isActive: true } });
    mocks.tx.flashcard.update.mockImplementation(({ data }: { data: object }) => Promise.resolve({ ...card, ...data }));
  });

  it("locks the UUID row before updating it", async () => {
    await updateFlashcard(flashcardId, { frontText: "Updated" }, { actorId: userId, requestId: eventId });
    expect(mocks.tx.$queryRaw).toHaveBeenCalledOnce();
    expect(mocks.tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(mocks.tx.flashcard.findUnique.mock.invocationCallOrder[0]);
    expect(mocks.tx.$queryRaw.mock.calls[0][0].values).toContain(flashcardId);
  });

  it("locks the UUID row before changing status", async () => {
    await setFlashcardStatus(flashcardId, "PUBLISHED", { actorId: userId, requestId: eventId });
    expect(mocks.tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(mocks.tx.flashcard.findUnique.mock.invocationCallOrder[0]);
    expect(mocks.tx.$queryRaw.mock.calls[0][0].values).toContain(flashcardId);
  });
});

describe("flashcard bulk lifecycle", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.prisma.$transaction.mockImplementation((callback: (client: typeof mocks.tx) => unknown) => callback(mocks.tx));
    mocks.tx.$queryRaw.mockResolvedValue([]);
  });

  it("validates the complete selection before writing", async () => {
    mocks.tx.flashcard.findMany.mockResolvedValue([]);
    await expect(bulkSetFlashcardStatus([flashcardId], "ARCHIVED", { actorId: userId, requestId: eventId })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.tx.flashcard.update).not.toHaveBeenCalled();
    expect(mocks.tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("locks bulk IDs in deterministic UUID order before reading", async () => {
    const otherId = "10000000-0000-4000-8000-000000000001";
    mocks.tx.$queryRaw.mockResolvedValue([{ id: otherId }, { id: flashcardId }]);
    mocks.tx.flashcard.findMany.mockResolvedValue([
      { ...card, id: flashcardId, status: "ARCHIVED", topic: { status: "PUBLISHED", organSystem: { status: "PUBLISHED", isActive: true } } },
      { ...card, id: otherId, status: "ARCHIVED", topic: { status: "PUBLISHED", organSystem: { status: "PUBLISHED", isActive: true } } },
    ]);

    await bulkSetFlashcardStatus([flashcardId, otherId], "ARCHIVED", { actorId: userId, requestId: eventId });
    expect(mocks.tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(mocks.tx.flashcard.findMany.mock.invocationCallOrder[0]);
    expect(mocks.tx.$queryRaw.mock.calls[0][0].values).toEqual([otherId, flashcardId]);
  });
});

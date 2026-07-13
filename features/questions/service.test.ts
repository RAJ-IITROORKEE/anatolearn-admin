import { beforeEach, describe, expect, it, vi } from "vitest";

const { tx, prisma } = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    topic: { findUnique: vi.fn() },
    question: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    questionOption: { deleteMany: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return {
    tx,
    prisma: { $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)) },
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/prisma", () => ({ prisma }));

import { createQuestion, duplicateQuestion, updateQuestion } from "./service";

const context = { actorId: crypto.randomUUID(), requestId: crypto.randomUUID() };
const topicId = crypto.randomUUID();

function storedQuestion(overrides: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(), topicId, assessmentType: "QUIZ", questionText: "Question",
    imageUrl: null, mediaId: null, explanation: "Explanation", difficulty: "MEDIUM",
    conceptTag: null, status: "DRAFT", isActive: true, createdAt: new Date(), updatedAt: new Date(),
    options: [
      { id: crypto.randomUUID(), key: crypto.randomUUID(), label: "A", displayOrder: 1, optionText: "One", imageUrl: null, mediaId: null, isCorrect: true },
      { id: crypto.randomUUID(), key: crypto.randomUUID(), label: "B", displayOrder: 2, optionText: "Two", imageUrl: null, mediaId: null, isCorrect: false },
    ],
    ...overrides,
  };
}

describe("question transactional writes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.topic.findUnique.mockResolvedValue({ status: "PUBLISHED", organSystem: { status: "PUBLISHED", isActive: true } });
  });

  it("creates all option metadata on the server and audits in one transaction", async () => {
    tx.question.create.mockImplementation(async ({ data }: { data: { options: { create: unknown[] } } }) => storedQuestion({ options: data.options.create }));
    await createQuestion({
      topicId, assessmentType: "QUIZ", questionText: "Question", explanation: "Explanation",
      difficulty: "MEDIUM", options: [
        { optionText: "One", isCorrect: true },
        { optionText: "Two", isCorrect: false },
      ],
    }, context);

    const create = tx.question.create.mock.calls[0][0].data.options.create;
    expect(create.map((option: { label: string; displayOrder: number }) => [option.label, option.displayOrder])).toEqual([["A", 1], ["B", 2]]);
    expect(create.every((option: { id: string; key: string }) => option.id && option.key)).toBe(true);
    expect(tx.auditLog.create).toHaveBeenCalledOnce();
  });

  it("fully replaces options while retaining validated existing IDs and keys", async () => {
    const before = storedQuestion();
    tx.question.findUnique.mockResolvedValue(before);
    tx.question.update.mockImplementation(async ({ data }: { data: { options: { create: unknown[] } } }) => ({ ...before, options: data.options.create }));

    await updateQuestion(before.id, { options: [
      { id: before.options[1].id, optionText: "Moved", isCorrect: true },
      { optionText: "New", isCorrect: false },
    ] }, context);

    expect(tx.questionOption.deleteMany).toHaveBeenCalledWith({ where: { questionId: before.id } });
    const replacement = tx.question.update.mock.calls[0][0].data.options.create;
    expect(replacement[0]).toMatchObject({ id: before.options[1].id, key: before.options[1].key, label: "A", displayOrder: 1 });
    expect(replacement[1].id).not.toBe(before.options[0].id);
    expect(replacement[1].key).not.toBe(before.options[0].key);
  });

  it("duplicates into a draft with fresh question option IDs and keys", async () => {
    const source = storedQuestion({ status: "PUBLISHED", isActive: false });
    tx.question.findUnique.mockResolvedValue(source);
    tx.question.create.mockImplementation(async ({ data }: { data: { options: { create: unknown[] } } }) => storedQuestion({ ...data, options: data.options.create }));

    const duplicate = await duplicateQuestion(source.id, context);

    expect(duplicate.status).toBe("DRAFT");
    expect(duplicate.isActive).toBe(true);
    expect(duplicate.options.map((option) => option.id)).not.toEqual(source.options.map((option) => option.id));
    expect(duplicate.options.map((option) => option.key)).not.toEqual(source.options.map((option) => option.key));
  });
});

import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminPage: vi.fn(),
  createFlashcard: vi.fn(),
  createQuestion: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/session", () => ({ requireAdminPage: mocks.requireAdminPage }));
vi.mock("@/features/flashcards/service", () => ({
  bulkSetFlashcardStatus: vi.fn(),
  createFlashcard: mocks.createFlashcard,
  setFlashcardStatus: vi.fn(),
  updateFlashcard: vi.fn(),
}));
vi.mock("@/features/questions/service", () => ({
  archiveQuestion: vi.fn(),
  bulkSetQuestionStatus: vi.fn(),
  createQuestion: mocks.createQuestion,
  duplicateQuestion: vi.fn(),
  setQuestionActivity: vi.fn(),
  setQuestionStatus: vi.fn(),
  updateQuestion: vi.fn(),
}));
vi.mock("@/features/trash/service", () => ({ bulkMoveToTrash: vi.fn(), moveToTrash: vi.fn() }));

import { createFlashcardAction, createQuestionAction } from "./phase4-actions";

const topicId = "20000000-0000-4000-8000-000000000002";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdminPage.mockResolvedValue({ profile: { id: crypto.randomUUID() } });
});

test("question action rejects an invalid option set before service mutation", async () => {
  const data = new FormData();
  data.set("assessmentType", "QUIZ");
  data.set("topicId", "not-a-topic-id");
  data.set("questionText", "Question?");
  data.set("explanation", "Explanation");
  data.set("difficulty", "MEDIUM");
  data.set("optionCount", "1");
  data.set("correctOption", "0");
  data.set("optionText.0", "Only option");

  const result = await createQuestionAction({}, data);

  expect(result.error).toBeTruthy();
  expect(mocks.createQuestion).not.toHaveBeenCalled();
});

test("returns a created flashcard to the flashcard list", async () => {
  mocks.createFlashcard.mockResolvedValue({ id: crypto.randomUUID() });
  const data = new FormData();
  data.set("topicId", topicId);
  data.set("frontText", "Front");
  data.set("backText", "Back");
  data.set("difficulty", "MEDIUM");
  data.set("displayOrder", "0");

  await expect(createFlashcardAction({}, data)).resolves.toMatchObject({ redirectTo: "/flashcards" });
});

describe.each([
  ["QUIZ", "/questions/quiz"],
  ["TEST", "/questions/test"],
] as const)("%s question creation", (assessmentType, destination) => {
  test(`returns to ${destination}`, async () => {
    mocks.createQuestion.mockResolvedValue({ id: crypto.randomUUID() });
    const data = new FormData();
    data.set("assessmentType", assessmentType);
    data.set("topicId", topicId);
    data.set("questionText", "Which chamber pumps systemic blood?");
    data.set("explanation", "The left ventricle pumps into the aorta.");
    data.set("difficulty", "MEDIUM");
    data.set("optionCount", "2");
    data.set("correctOption", "0");
    data.set("optionText.0", "Left ventricle");
    data.set("optionText.1", "Right atrium");

    await expect(createQuestionAction({}, data)).resolves.toMatchObject({ redirectTo: destination });
  });
});

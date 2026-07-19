import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { QuestionError } from "@/features/questions/domain";

const questionId = "00000006-0000-4000-8000-00000000000a";
const mocks = vi.hoisted(() => ({
  getAdminMediaMap: vi.fn(),
  getQuestion: vi.fn(),
  listAdmin: vi.fn(),
  notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/components/app-shell/page-header", () => ({ PageHeader: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock("@/components/phase3/action-form", () => ({ InlineAction: () => null }));
vi.mock("@/components/phase3/admin-ui", () => ({ StatusBadge: () => null }));
vi.mock("@/components/phase3/data", () => ({ listAdmin: mocks.listAdmin }));
vi.mock("@/components/questions/question-form", () => ({
  QuestionForm: ({ existingMedia }: { existingMedia: Record<string, { signedUrl: string }> }) => (
    <div>Question editor {existingMedia["question-media"]?.signedUrl} {existingMedia["option-media"]?.signedUrl}</div>
  ),
}));
vi.mock("@/features/media/service", () => ({ getAdminMediaMap: mocks.getAdminMediaMap }));
vi.mock("@/features/questions/service", () => ({ getQuestion: mocks.getQuestion }));
vi.mock("../phase4-actions", () => ({
  changeQuestionActivityAction: vi.fn(),
  changeQuestionStatusAction: vi.fn(),
  duplicateQuestionAction: vi.fn(),
  trashQuestionAction: vi.fn(),
  updateQuestionAction: vi.fn(),
}));

import QuestionDetailPage from "./[id]/page";

const question = {
  id: questionId,
  topicId: "00000002-0000-4000-8000-000000000001",
  assessmentType: "QUIZ",
  questionText: "Which chamber pumps systemic blood?",
  mediaId: "question-media",
  explanation: "The left ventricle pumps into the aorta.",
  difficulty: "MEDIUM",
  conceptTag: "circulation",
  status: "DRAFT",
  isActive: true,
  options: [
    { id: "option-a", optionText: "Left ventricle", mediaId: "option-media", isCorrect: true },
    { id: "option-b", optionText: "Right atrium", mediaId: null, isCorrect: false },
  ],
};

describe("question detail page routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getQuestion.mockResolvedValue(question);
    mocks.listAdmin.mockResolvedValue({ items: [], pagination: { page: 1, pageSize: 100, total: 0, totalPages: 0 } });
    mocks.getAdminMediaMap.mockResolvedValue(new Map([
      ["question-media", { signedUrl: "https://signed.example/question" }],
      ["option-media", { signedUrl: "https://signed.example/option" }],
    ]));
  });

  it("returns not found for an invalid UUID without querying questions", async () => {
    await expect(QuestionDetailPage({ params: Promise.resolve({ id: "not-a-uuid" }) })).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mocks.getQuestion).not.toHaveBeenCalled();
  });

  it("maps the known question NOT_FOUND response to not found", async () => {
    mocks.getQuestion.mockRejectedValue(new QuestionError("NOT_FOUND", "Question was not found.", 404));

    await expect(QuestionDetailPage({ params: Promise.resolve({ id: questionId }) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.notFound).toHaveBeenCalledOnce();
  });

  it("resolves the seeded question UUID and passes signed question and option media to the editor", async () => {
    render(await QuestionDetailPage({ params: Promise.resolve({ id: questionId }) }));

    expect(mocks.getQuestion).toHaveBeenCalledWith(questionId);
    expect(mocks.getAdminMediaMap).toHaveBeenCalledWith(["question-media", "option-media"]);
    expect(screen.getByRole("heading", { name: question.questionText })).toBeVisible();
    expect(screen.getByText(/https:\/\/signed\.example\/question/)).toBeVisible();
    expect(screen.getByText(/https:\/\/signed\.example\/option/)).toBeVisible();
  });

  it("propagates invalid stored questions to the error boundary", async () => {
    const error = new QuestionError("INVALID_STORED_QUESTION", "Question has invalid options.", 500);
    mocks.getQuestion.mockRejectedValue(error);

    await expect(QuestionDetailPage({ params: Promise.resolve({ id: questionId }) })).rejects.toBe(error);
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it("propagates unexpected database failures to the error boundary", async () => {
    const error = new Error("database unavailable");
    mocks.getQuestion.mockRejectedValue(error);

    await expect(QuestionDetailPage({ params: Promise.resolve({ id: questionId }) })).rejects.toBe(error);
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it("propagates media provider failures to the error boundary", async () => {
    const error = new Error("storage provider unavailable");
    mocks.getAdminMediaMap.mockRejectedValue(error);

    await expect(QuestionDetailPage({ params: Promise.resolve({ id: questionId }) })).rejects.toBe(error);
    expect(mocks.notFound).not.toHaveBeenCalled();
  });
});

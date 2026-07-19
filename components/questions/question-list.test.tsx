import { render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { QuestionList } from "./question-list";

const item = {
  id: "20000000-0000-4000-8000-000000000002",
  topicId: "10000000-0000-4000-8000-000000000001",
  topicTitle: "Cardiac chambers",
  assessmentType: "QUIZ" as const,
  questionText: "Which chamber pumps oxygenated blood into the systemic circulation?",
  imageUrl: null,
  mediaId: null,
  explanation: "The left ventricle pumps into the aorta.",
  difficulty: "MEDIUM" as const,
  conceptTag: "circulation",
  status: "PUBLISHED" as const,
  isActive: true,
  createdAt: new Date("2026-07-19T08:00:00.000Z"),
  updatedAt: new Date("2026-07-20T12:30:00.000Z"),
  options: [
    { id: "1", key: "1", label: "A", displayOrder: 1, optionText: "Left ventricle", imageUrl: null, mediaId: null, isCorrect: true },
    { id: "2", key: "2", label: "B", displayOrder: 2, optionText: "Right atrium", imageUrl: null, mediaId: null, isCorrect: false },
  ],
};

it("renders quiz questions as responsive semantic rows with activity, options, topic, date, and explicit actions", () => {
  render(<QuestionList assessmentType="QUIZ" bulkAction={vi.fn()} items={[item]} page={3} pageSize={15} trashAction={vi.fn()} />);

  const table = screen.getByRole("table", { name: "Quiz questions" });
  expect(within(table).getByRole("cell", { name: "31" })).toBeInTheDocument();
  expect(within(table).getByRole("columnheader", { name: "Activity" })).toBeInTheDocument();
  expect(screen.getAllByText("Cardiac chambers")).toHaveLength(2);
  expect(screen.getAllByText("2 options")).toHaveLength(2);
  expect(screen.getAllByText("Active")).toHaveLength(2);
  expect(screen.getAllByText(item.questionText)[0]).toHaveClass("truncate");
  expect(screen.getAllByText(/Jul 20, 2026/).length).toBeGreaterThan(0);
  expect(screen.getAllByRole("link", { name: `Edit ${item.questionText}` })).toHaveLength(2);
  expect(screen.getAllByRole("button", { name: `Delete ${item.questionText}` })).toHaveLength(2);
});

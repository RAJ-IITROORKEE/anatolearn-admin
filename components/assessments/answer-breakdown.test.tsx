import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AnswerBreakdown } from "./answer-breakdown";

const question = {
  displayOrder: 1,
  questionText: "Which chamber pumps blood to the lungs?",
  topicTitle: "Cardiac chambers",
  difficulty: "MEDIUM" as const,
  conceptTag: "Circulation",
  answeredOptionKey: "option-b",
  timeSpentSeconds: 18,
  options: [
    { key: "option-a", label: "A", displayOrder: 1, optionText: "Left atrium" },
    { key: "option-b", label: "B", displayOrder: 2, optionText: "Right ventricle" },
  ],
  correctOptionKey: "option-b",
  isCorrect: true,
  explanation: "The right ventricle supplies the pulmonary circulation.",
};

const managedMedia = new Map([
  ["question-media", { id: "question-media", signedUrl: "https://signed.example/question", width: 800, height: 600, altText: "Stored question alt" }],
]);

describe("AnswerBreakdown", () => {
  it("shows explicit submitted answer state, keys, explanation, and time", () => {
    render(<AnswerBreakdown question={question} status="COMPLETED" />);

    expect(screen.getByText("Correct")).toBeVisible();
    expect(screen.getByText("Selected answer")).toBeVisible();
    expect(screen.getByText("Correct answer")).toBeVisible();
    expect(screen.getByText(question.explanation)).toBeVisible();
    expect(screen.getByText("18 sec")).toBeVisible();
  });

  it("does not disclose correctness or explanations before submission", () => {
    render(<AnswerBreakdown question={question} status="IN_PROGRESS" />);

    expect(screen.getByText("Response recorded")).toBeVisible();
    expect(screen.queryByText("Correct")).not.toBeInTheDocument();
    expect(screen.queryByText("Correct answer")).not.toBeInTheDocument();
    expect(screen.queryByText(question.explanation)).not.toBeInTheDocument();
  });

  it("does not disclose correctness for abandoned attempts", () => {
    render(<AnswerBreakdown question={question} status="ABANDONED" />);

    expect(screen.queryByText("Correct answer")).not.toBeInTheDocument();
    expect(screen.queryByText(question.explanation)).not.toBeInTheDocument();
  });

  it("prefers managed question media and falls back to legacy option URLs", () => {
    render(<AnswerBreakdown mediaById={managedMedia} question={{
      ...question,
      mediaId: "question-media",
      imageUrl: "https://legacy.example/question",
      options: [
        { ...question.options[0], imageUrl: "https://legacy.example/option", mediaId: null },
        question.options[1],
      ],
    }} status="COMPLETED" />);

    expect(screen.getByRole("img", { name: "Question 1 image" })).toHaveAttribute("src", "https://signed.example/question");
    expect(screen.getByRole("img", { name: "Option A image" })).toHaveAttribute("src", "https://legacy.example/option");
    expect(screen.queryByRole("img", { name: "Option B image" })).not.toBeInTheDocument();
  });

  it("uses a legacy question URL when managed media is missing without affecting privacy", () => {
    render(<AnswerBreakdown mediaById={new Map()} question={{ ...question, mediaId: "missing-media", imageUrl: "https://legacy.example/question" }} status="IN_PROGRESS" />);

    expect(screen.getByRole("img", { name: "Question 1 image" })).toHaveAttribute("src", "https://legacy.example/question");
    expect(screen.queryByText("Correct answer")).not.toBeInTheDocument();
    expect(screen.queryByText(question.explanation)).not.toBeInTheDocument();
  });
});

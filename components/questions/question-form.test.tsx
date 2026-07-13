import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";

import { QuestionForm } from "./question-form";

test("question editor starts with four options and enforces the 2-6 option controls", async () => {
  const user = userEvent.setup();
  render(<QuestionForm action={vi.fn()} assessmentType="QUIZ" topics={[{ id: "topic-id", label: "Heart" }]} />);

  expect(screen.getAllByRole("textbox", { name: /option [A-D]/i })).toHaveLength(4);
  expect(screen.getByText("Quiz question preview")).toHaveClass("text-quiz");

  await user.click(screen.getByRole("button", { name: "Add option" }));
  await user.click(screen.getByRole("button", { name: "Add option" }));
  expect(screen.getAllByRole("textbox", { name: /option [A-F]/i })).toHaveLength(6);
  expect(screen.getByRole("button", { name: "Add option" })).toBeDisabled();

  await user.click(screen.getByRole("button", { name: "Remove option F" }));
  expect(screen.getAllByRole("textbox", { name: /option [A-E]/i })).toHaveLength(5);
});

test("question preview reflects the prompt, options, and selected correct answer", async () => {
  const user = userEvent.setup();
  render(<QuestionForm action={vi.fn()} assessmentType="TEST" topics={[{ id: "topic-id", label: "Heart" }]} />);

  await user.type(screen.getByRole("textbox", { name: "Question text" }), "Which chamber pumps systemic blood?");
  await user.type(screen.getByRole("textbox", { name: "Option A" }), "Left ventricle");
  await user.click(screen.getByRole("radio", { name: "Mark option A correct" }));

  expect(screen.getByText("Test question preview")).toHaveClass("text-test");
  const preview = screen.getByRole("complementary", { name: "Question preview" });
  expect(within(preview).getByText("Which chamber pumps systemic blood?")).toBeInTheDocument();
  expect(within(preview).getByText(/Left ventricle/)).toHaveClass("font-semibold");
});

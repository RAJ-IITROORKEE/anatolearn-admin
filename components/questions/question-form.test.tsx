import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/questions/new" }));

import { QuestionForm } from "./question-form";

test("question editor starts with four options and enforces the 2-6 option controls", async () => {
  const user = userEvent.setup();
  const { container } = render(<QuestionForm action={vi.fn()} assessmentType="QUIZ" topics={[{ id: "topic-id", label: "Heart" }]} />);

  expect(screen.getAllByRole("textbox", { name: /option [A-D]/i })).toHaveLength(4);
  expect(container.querySelector('input[type="file"][name="optionFile.0"]')).toBeInTheDocument();
  expect(container.querySelector('input[type="file"][name="optionFile.3"]')).toBeInTheDocument();
  expect(container.querySelector('input[type="hidden"][name="optionMediaId.0"]')).toHaveValue("");
  expect(container.querySelector('input[type="hidden"][name="optionMediaId.3"]')).toHaveValue("");
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

test("question editor follows the content order and keeps image controls compact", () => {
  const { container } = render(<QuestionForm action={vi.fn()} assessmentType="QUIZ" topics={[{ id: "topic-id", label: "Heart" }]} />);

  expect(screen.getByText("Quiz question")).toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: "Topic" })).toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: "Difficulty" }).closest("label")).toHaveClass("self-start");
  expect(screen.getByRole("region", { name: "Question image" })).toHaveAttribute("data-compact", "true");
  expect(screen.getByRole("group", { name: /Answer options/ })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Publication" })).toHaveTextContent("created as a draft");
  expect(container.querySelector('input[name="status"]')).not.toBeInTheDocument();
});

test("question editor has roomy sections and a compact sticky metadata sidebar", () => {
  render(<QuestionForm action={vi.fn()} assessmentType="TEST" topics={[{ id: "topic-id", label: "Heart" }]} />);

  expect(screen.getByRole("heading", { name: "Question Details" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Answer Options" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Answer & Explanation" })).toBeVisible();
  expect(screen.getByRole("complementary", { name: "Question metadata" })).toHaveClass("xl:sticky", "xl:top-24");
  expect(screen.getByRole("combobox", { name: "Difficulty" })).toHaveClass("max-w-40");
  expect(screen.getByTestId("question-editor-layout")).toHaveClass("xl:grid-cols-[minmax(0,1fr)_20rem]");
});

test("question and option image controls receive existing signed previews", () => {
  render(<QuestionForm
    action={vi.fn()}
    assessmentType="QUIZ"
    existingMedia={{
      "question-media": { signedUrl: "https://signed.example/question", altText: "Heart diagram" },
      "option-media": { signedUrl: "https://signed.example/option", altText: "Left ventricle" },
    }}
    item={{
      topicId: "topic-id",
      questionText: "Which chamber pumps systemic blood?",
      mediaId: "question-media",
      explanation: "The left ventricle pumps into the aorta.",
      difficulty: "MEDIUM",
      conceptTag: "circulation",
      options: [
        { id: "option-a", optionText: "Left ventricle", mediaId: "option-media", isCorrect: true },
        { id: "option-b", optionText: "Right atrium", mediaId: null, isCorrect: false },
      ],
    }}
    topics={[{ id: "topic-id", label: "Heart" }]}
  />);

  expect(screen.getByRole("img", { name: "Heart diagram" })).toHaveAttribute("src", "https://signed.example/question");
  expect(screen.getByRole("img", { name: "Left ventricle" })).toHaveAttribute("src", "https://signed.example/option");
  const details = screen.getByRole("region", { name: "Question Details" });
  const prompt = within(details).getByRole("textbox", { name: "Question text" });
  const questionImage = within(details).getByRole("region", { name: "Question image" });
  expect(prompt.compareDocumentPosition(questionImage) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getByRole("region", { name: "Option A image" }).parentElement).toHaveClass("lg:grid-cols-[minmax(0,1fr)_minmax(22rem,.8fr)]");
});

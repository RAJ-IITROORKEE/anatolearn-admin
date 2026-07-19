import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { FlashcardList } from "./flashcard-list";

const item = {
  id: "20000000-0000-4000-8000-000000000002",
  topicId: "10000000-0000-4000-8000-000000000001",
  topicTitle: "Cardiac chambers",
  frontText: "A deliberately long flashcard title explaining the chamber that pumps systemic blood",
  backText: "Left ventricle",
  frontImageUrl: null,
  frontMediaId: null,
  backImageUrl: null,
  backMediaId: null,
  difficulty: "HARD" as const,
  notes: null,
  displayOrder: 0,
  status: "DRAFT" as const,
  createdAt: new Date("2026-07-19T08:00:00.000Z"),
  updatedAt: new Date("2026-07-20T12:30:00.000Z"),
};

it("renders a semantic desktop table and equivalent mobile row with topic, truncation, date, and actions", () => {
  render(<FlashcardList bulkAction={vi.fn()} items={[item]} page={2} pageSize={15} trashAction={vi.fn()} />);

  const table = screen.getByRole("table", { name: "Flashcards" });
  expect(within(table).getByRole("columnheader", { name: "S.No" })).toBeInTheDocument();
  expect(within(table).getByRole("columnheader", { name: "Topic" })).toBeInTheDocument();
  expect(within(table).getByRole("cell", { name: "16" })).toBeInTheDocument();
  expect(screen.getAllByText("Cardiac chambers")).toHaveLength(2);
  expect(screen.getAllByText(item.frontText)[0]).toHaveClass("truncate");
  expect(screen.getAllByText(item.frontText)[0].parentElement).toHaveAttribute("title", item.frontText);
  expect(screen.getAllByText(/Jul 20, 2026/).length).toBeGreaterThan(0);
  expect(screen.getAllByRole("link", { name: `Edit ${item.frontText}` })).toHaveLength(2);
  expect(screen.getAllByRole("button", { name: `Delete ${item.frontText}` })).toHaveLength(2);
});

it("moves a row to recoverable Trash after confirmation", async () => {
  const user = userEvent.setup();
  const trashAction = vi.fn().mockResolvedValue({ success: "Moved to Trash.", redirectTo: "/flashcards" });
  render(<FlashcardList bulkAction={vi.fn()} items={[item]} page={1} pageSize={15} trashAction={trashAction} />);

  await user.click(screen.getAllByRole("button", { name: `Delete ${item.frontText}` })[0]);
  expect(screen.getByRole("alertdialog", { name: "Move flashcard to Trash?" })).toHaveTextContent("restored from Settings > Trash for 30 days");
  await user.click(screen.getByRole("button", { name: "Move to Trash" }));
  await waitFor(() => expect(trashAction).toHaveBeenCalledOnce());
});

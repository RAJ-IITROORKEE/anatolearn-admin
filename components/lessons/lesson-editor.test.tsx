import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";

vi.mock("@/app/(admin)/managed-media-actions", () => ({ searchManagedMediaAction: vi.fn().mockResolvedValue({ items: [], pagination: { page: 1, totalPages: 0 } }) }));

import { LessonEditor } from "./lesson-editor";

test("adds all seven block types and serializes stable schema-valid IDs", async () => {
  const user = userEvent.setup();
  const { container } = render(<LessonEditor initialBlocks={[]} />);
  const add = screen.getByRole("combobox", { name: "Block type" });

  for (const type of ["heading", "paragraph", "image", "callout", "bulletList", "numberedList", "divider"]) {
    await user.selectOptions(add, type);
    await user.click(screen.getByRole("button", { name: "Add block" }));
  }

  expect(screen.getAllByTestId("lesson-block")).toHaveLength(7);
  const value = JSON.parse((container.querySelector('input[name="contentBlocks"]') as HTMLInputElement).value) as Array<{ id: string; type: string }>;
  expect(value.map((block) => block.type)).toEqual(["heading", "paragraph", "image", "callout", "bulletList", "numberedList", "divider"]);
  expect(new Set(value.map((block) => block.id)).size).toBe(7);
});

test("duplicates, keyboard-moves, removes blocks, and renders validated learner preview", async () => {
  const user = userEvent.setup();
  const { container } = render(<LessonEditor initialBlocks={[{ type: "heading", level: 2, text: "Anatomy" }, { type: "paragraph", text: "Learner copy" }]} />);
  const blocks = screen.getAllByTestId("lesson-block");
  await user.click(within(blocks[0]).getByRole("button", { name: "Duplicate block" }));
  expect(screen.getAllByText("Anatomy")).toHaveLength(2);

  blocks[0].focus();
  await user.keyboard("{Alt>}{ArrowDown}{/Alt}");
  let value = JSON.parse((container.querySelector('input[name="contentBlocks"]') as HTMLInputElement).value) as Array<{ id: string; type: string }>;
  expect(value[0].type).toBe("heading");
  expect(value[0].id).not.toBe(value[1].id);

  await user.click(within(screen.getAllByTestId("lesson-block")[2]).getByRole("button", { name: "Remove block" }));
  await user.click(screen.getByRole("button", { name: "Delete block" }));
  value = JSON.parse((container.querySelector('input[name="contentBlocks"]') as HTMLInputElement).value);
  expect(value).toHaveLength(2);
  expect(screen.getByRole("complementary", { name: "Learner lesson preview" })).toHaveTextContent("Anatomy");
});

test("requires keyboard confirmation for non-empty blocks and cancel preserves editor state and focus", async () => {
  const user = userEvent.setup();
  const { container } = render(<LessonEditor initialBlocks={[{ type: "paragraph", text: "Keep this learner content" }]} />);
  const serialized = () => (container.querySelector('input[name="contentBlocks"]') as HTMLInputElement).value;
  const before = serialized();
  const remove = screen.getByRole("button", { name: "Remove block" });

  remove.focus();
  await user.keyboard("{Enter}");
  expect(screen.getByRole("alertdialog", { name: "Remove Paragraph block?" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();

  await user.keyboard("{Escape}");
  await waitFor(() => expect(remove).toHaveFocus());
  expect(serialized()).toBe(before);
  expect(screen.getAllByTestId("lesson-block")).toHaveLength(1);

  await user.keyboard("{Enter}");
  await user.tab();
  expect(screen.getByRole("button", { name: "Delete block" })).toHaveFocus();
  await user.keyboard("{Enter}");
  expect(screen.queryAllByTestId("lesson-block")).toHaveLength(0);
});

test("only newly added semantically empty blocks remove without confirmation", async () => {
  const user = userEvent.setup();
  render(<LessonEditor initialBlocks={[]} />);
  const type = screen.getByRole("combobox", { name: "Block type" });

  for (const blockType of ["heading", "paragraph", "image", "callout", "bulletList", "numberedList"]) {
    await user.selectOptions(type, blockType);
    await user.click(screen.getByRole("button", { name: "Add block" }));
    await user.click(within(screen.getByTestId("lesson-block")).getByRole("button", { name: "Remove block" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.queryAllByTestId("lesson-block")).toHaveLength(0);
  }

  await user.selectOptions(type, "divider");
  await user.click(screen.getByRole("button", { name: "Add block" }));
  await user.click(within(screen.getByTestId("lesson-block")).getByRole("button", { name: "Remove block" }));
  expect(screen.getByRole("alertdialog", { name: "Remove Divider block?" })).toBeVisible();
});

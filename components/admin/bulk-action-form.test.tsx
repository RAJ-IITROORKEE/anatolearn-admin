import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { BulkActionForm } from "./bulk-action-form";

it("reveals selected-row actions, selects the current page, and clears selection", async () => {
  const user = userEvent.setup();
  const action = vi.fn().mockResolvedValue({ success: "Updated" });
  render(<BulkActionForm action={action} itemIds={["one", "two"]} itemLabel="flashcard"><label><input name="ids" type="checkbox" value="one" />One</label><label><input name="ids" type="checkbox" value="two" />Two</label></BulkActionForm>);

  expect(screen.queryByRole("toolbar", { name: "Bulk actions" })).not.toBeInTheDocument();

  await user.click(screen.getByRole("checkbox", { name: "One" }));
  const toolbar = screen.getByRole("toolbar", { name: "Bulk actions" });
  expect(toolbar).toHaveTextContent("1 flashcard selected");

  await user.click(screen.getByRole("button", { name: "Select all current page" }));
  expect(toolbar).toHaveTextContent("2 flashcards selected");
  expect(screen.getByRole("checkbox", { name: "Two" })).toBeChecked();

  await user.click(screen.getByRole("button", { name: "Clear selection" }));
  expect(screen.queryByRole("toolbar", { name: "Bulk actions" })).not.toBeInTheDocument();
});

it("confirms bulk Trash and submits the complete selected set", async () => {
  const user = userEvent.setup();
  const action = vi.fn().mockResolvedValue({ success: "Moved to Trash" });
  render(<BulkActionForm action={action} itemIds={["one", "two"]} itemLabel="question"><label><input name="ids" type="checkbox" value="one" />One</label><label><input name="ids" type="checkbox" value="two" />Two</label></BulkActionForm>);

  await user.click(screen.getByRole("checkbox", { name: "One" }));
  await user.click(screen.getByRole("button", { name: "Delete selected" }));
  expect(screen.getByRole("alertdialog", { name: "Move selected question to Trash?" })).toHaveTextContent("restored from Settings > Trash for 30 days");
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(action).not.toHaveBeenCalled();

  await user.click(screen.getByRole("button", { name: "Delete selected" }));
  await user.click(screen.getByRole("button", { name: "Move 1 question to Trash" }));
  await waitFor(() => expect(action).toHaveBeenCalledOnce());
  const data = action.mock.calls[0][1] as FormData;
  expect(data.get("operation")).toBe("TRASH");
  expect(data.getAll("ids")).toEqual(["one"]);
});

it("keeps responsive copies of the same row selection synchronized", async () => {
  const user = userEvent.setup();
  render(<BulkActionForm action={vi.fn()} itemIds={["one"]} itemLabel="question"><label><input name="ids" type="checkbox" value="one" />Desktop one</label><label><input name="ids" type="checkbox" value="one" />Mobile one</label></BulkActionForm>);

  const desktop = screen.getByRole("checkbox", { name: "Desktop one" });
  const mobile = screen.getByRole("checkbox", { name: "Mobile one" });
  await user.click(desktop);
  expect(mobile).toBeChecked();

  await user.click(mobile);
  expect(desktop).not.toBeChecked();
  expect(screen.queryByRole("toolbar", { name: "Bulk actions" })).not.toBeInTheDocument();
});

it("intersects selection with current-page IDs and removes invisible stale selections", async () => {
  const user = userEvent.setup();
  const action = vi.fn();
  const { rerender } = render(<BulkActionForm action={action} itemIds={["one", "two"]} itemLabel="feedback item"><label><input name="ids" type="checkbox" value="one" />One</label><label><input name="ids" type="checkbox" value="two" />Two</label></BulkActionForm>);

  await user.click(screen.getByRole("checkbox", { name: "One" }));
  await user.click(screen.getByRole("button", { name: "Select all current page" }));
  expect(screen.getByRole("toolbar", { name: "Bulk actions" })).toHaveTextContent("2 feedback items selected");

  rerender(<BulkActionForm action={action} itemIds={["two", "three"]} itemLabel="feedback item"><label><input name="ids" type="checkbox" value="two" />Two</label><label><input name="ids" type="checkbox" value="three" />Three</label></BulkActionForm>);
  await waitFor(() => expect(screen.getByRole("toolbar", { name: "Bulk actions" })).toHaveTextContent("1 feedback item selected"));
  expect(screen.getByRole("checkbox", { name: "Two" })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: "Three" })).not.toBeChecked();

  rerender(<BulkActionForm action={action} itemIds={["three"]} itemLabel="feedback item"><label><input name="ids" type="checkbox" value="three" />Three</label></BulkActionForm>);
  await waitFor(() => expect(screen.queryByRole("toolbar", { name: "Bulk actions" })).not.toBeInTheDocument());
  expect(screen.getByRole("checkbox", { name: "Three" })).not.toBeChecked();
});

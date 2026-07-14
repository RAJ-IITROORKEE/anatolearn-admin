import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { BulkActionForm } from "./bulk-action-form";

it("confirms the selected bulk action accessibly and supports cancellation", async () => {
  const user = userEvent.setup();
  const action = vi.fn().mockResolvedValue({ success: "Updated" });
  const confirm = vi.spyOn(window, "confirm");
  render(<BulkActionForm action={action}><label><input name="ids" type="checkbox" value="one" />One</label></BulkActionForm>);

  await user.click(screen.getByRole("checkbox", { name: "One" }));
  const trigger = screen.getByRole("button", { name: "Apply" });
  await user.click(trigger);
  expect(screen.getByRole("alertdialog", { name: "Confirm bulk action" })).toHaveTextContent("1 selected item");
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(trigger).toHaveFocus();
  expect(action).not.toHaveBeenCalled();

  await user.click(trigger);
  await user.click(screen.getByRole("button", { name: "Apply to 1 item" }));
  await waitFor(() => expect(action).toHaveBeenCalledOnce());
  expect(confirm).not.toHaveBeenCalled();
  confirm.mockRestore();
});

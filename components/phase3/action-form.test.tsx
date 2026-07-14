import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/content/new" }));
import { ActionForm, InlineAction } from "./action-form";

test("confirmation supports focus, cancel, and confirm without window.confirm", async () => {
  const user = userEvent.setup();
  const action = vi.fn().mockResolvedValue({ success: "Archived" });
  const confirm = vi.spyOn(window, "confirm");
  render(<InlineAction action={action} confirmMessage="Archive it?">Archive</InlineAction>);

  const trigger = screen.getByRole("button", { name: "Archive" });
  trigger.focus();
  await user.keyboard("{Enter}");
  expect(screen.getByRole("alertdialog", { name: "Confirm action" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  await user.keyboard("{Escape}");
  expect(trigger).toHaveFocus();
  expect(action).not.toHaveBeenCalled();

  await user.click(trigger);
  await user.click(screen.getByRole("button", { name: "Confirm" }));
  await waitFor(() => expect(action).toHaveBeenCalledOnce());
  expect(confirm).not.toHaveBeenCalled();
  confirm.mockRestore();
});

test("guarded forms stay dirty after failure and clear after a successful save", async () => {
  const user = userEvent.setup();
  const action = vi.fn()
    .mockResolvedValueOnce({ error: "Could not save." })
    .mockResolvedValueOnce({ success: "Saved." });
  render(<ActionForm action={action} guardUnsavedChanges="lesson"><label>Title<input name="title" /></label></ActionForm>);

  await user.type(screen.getByRole("textbox", { name: "Title" }), "Heart");
  expect(screen.getByTestId("unsaved-navigation-guard")).toHaveAttribute("data-dirty", "true");
  await user.click(screen.getByRole("button", { name: "Save changes" }));
  expect(await screen.findByText("Could not save.")).toBeInTheDocument();
  expect(screen.getByTestId("unsaved-navigation-guard")).toHaveAttribute("data-dirty", "true");

  await user.click(screen.getByRole("button", { name: "Save changes" }));
  expect(await screen.findByText("Saved.")).toBeInTheDocument();
  await waitFor(() => expect(screen.getByTestId("unsaved-navigation-guard")).toHaveAttribute("data-dirty", "false"));
});

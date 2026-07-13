import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { InlineAction } from "./action-form";

test("confirmation can cancel a destructive action", async () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  render(<InlineAction action={vi.fn()} confirmMessage="Archive it?">Archive</InlineAction>);
  await userEvent.click(screen.getByRole("button", { name: "Archive" }));
  expect(confirm).toHaveBeenCalledWith("Archive it?");
  confirm.mockRestore();
});

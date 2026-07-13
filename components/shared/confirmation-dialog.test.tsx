import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";

describe("ConfirmationDialog", () => {
  it("requires explicit confirmation before a destructive action", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <ConfirmationDialog
        title="Archive lesson?"
        description="Learners will no longer see this lesson."
        confirmLabel="Archive lesson"
        onConfirm={onConfirm}
      >
        <button type="button">Archive</button>
      </ConfirmationDialog>,
    );

    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(screen.getByRole("alertdialog", { name: "Archive lesson?" })).toBeVisible();
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Archive lesson" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});

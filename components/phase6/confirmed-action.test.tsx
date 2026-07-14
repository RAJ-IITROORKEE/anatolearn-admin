import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { ConfirmedAction } from "./confirmed-action";

it("requires an accessible dialog confirmation without window.confirm", async () => {
  const action = vi.fn().mockResolvedValue({ success: "Updated." });
  const confirmSpy = vi.spyOn(window, "confirm");
  render(<ConfirmedAction action={action} confirmLabel="Deactivate user" description="Access will be disabled." title="Deactivate this user?">Deactivate</ConfirmedAction>);

  await userEvent.click(screen.getByRole("button", { name: "Deactivate" }));
  expect(screen.getByRole("alertdialog", { name: "Deactivate this user?" })).toBeInTheDocument();
  expect(action).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Deactivate user" }));
  expect(action).toHaveBeenCalledTimes(1);
  expect(confirmSpy).not.toHaveBeenCalled();
  confirmSpy.mockRestore();
});

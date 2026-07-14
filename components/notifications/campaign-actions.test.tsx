import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { CampaignAction } from "./campaign-actions";

it("requires an accessible confirmation and never uses window.confirm", async () => {
  const action = vi.fn().mockResolvedValue({ success: "Campaign queued for provider processing." });
  const confirmSpy = vi.spyOn(window, "confirm");
  render(<CampaignAction action={action} confirmLabel="Send campaign" description="This queues provider delivery." title="Send now?">Send now</CampaignAction>);

  await userEvent.click(screen.getByRole("button", { name: "Send now" }));
  expect(screen.getByRole("alertdialog", { name: "Send now?" })).toBeInTheDocument();
  expect(action).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Send campaign" }));
  expect(action).toHaveBeenCalledTimes(1);
  expect(confirmSpy).not.toHaveBeenCalled();
  confirmSpy.mockRestore();
});

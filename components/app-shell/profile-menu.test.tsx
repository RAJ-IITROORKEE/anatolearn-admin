import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ logoutAction: vi.fn() }));

vi.mock("@/features/auth/actions", () => ({ logoutAction: mocks.logoutAction }));

import { ProfileMenu } from "./profile-menu";

it("invokes the logout action when sign out is selected", async () => {
  const user = userEvent.setup();
  render(<ProfileMenu profile={{ fullName: "Admin", email: "admin@example.com" }} />);

  await user.click(screen.getByRole("button", { name: "Open profile menu" }));
  await user.click(screen.getByRole("menuitem", { name: "Sign out" }));

  expect(mocks.logoutAction).toHaveBeenCalledOnce();
});

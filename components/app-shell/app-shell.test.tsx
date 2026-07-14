import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
vi.mock("@/components/app-shell/profile-menu", () => ({ ProfileMenu: () => <button>Profile</button> }));

import { AppShell } from "./app-shell";

it("places a keyboard-visible skip link before shell navigation", async () => {
  const user = userEvent.setup();
  render(<AppShell profile={{ fullName: "Admin", email: "admin@example.com" }}><h1>Dashboard</h1></AppShell>);

  await user.tab();
  const skipLink = screen.getByRole("link", { name: "Skip to main content" });
  expect(skipLink).toHaveFocus();
  expect(skipLink).toHaveAttribute("href", "#main-content");
  expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
  expect(screen.getByRole("main")).toHaveAttribute("tabindex", "-1");
});

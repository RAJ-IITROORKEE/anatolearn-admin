import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/notifications/new" }));

import { UnsavedNavigationGuard } from "./unsaved-navigation-guard";

it("intercepts internal links and supports accessible cancel and confirm without window.confirm", () => {
  const confirmSpy = vi.spyOn(window, "confirm");
  render(<><UnsavedNavigationGuard dirty subject="question" /><a href="/dashboard">Dashboard</a></>);

  fireEvent.click(screen.getByRole("link", { name: "Dashboard" }));
  expect(screen.getByRole("alertdialog", { name: "Discard unsaved question changes?" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
  expect(push).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("link", { name: "Dashboard" }));
  fireEvent.click(screen.getByRole("button", { name: "Discard and leave" }));
  expect(push).toHaveBeenCalledWith("/dashboard");
  expect(confirmSpy).not.toHaveBeenCalled();
  confirmSpy.mockRestore();
});

it("retains a beforeunload guard while dirty", () => {
  render(<UnsavedNavigationGuard dirty />);
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
});

import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/users/11111111-1111-4111-8111-111111111111" }));

import { Breadcrumbs } from "./breadcrumbs";

it("omits unresolved UUID path segments from visible breadcrumbs", () => {
  render(<Breadcrumbs />);
  expect(screen.getByRole("link", { name: "users" })).toBeInTheDocument();
  expect(screen.queryByText("11111111-1111-4111-8111-111111111111")).not.toBeInTheDocument();
});

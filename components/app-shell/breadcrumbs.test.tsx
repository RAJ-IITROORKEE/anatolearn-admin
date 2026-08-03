import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ pathname: "/users/11111111-1111-4111-8111-111111111111" }));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname }));

import { Breadcrumbs } from "./breadcrumbs";

beforeEach(() => {
  mocks.pathname = "/users/11111111-1111-4111-8111-111111111111";
});

it("omits unresolved UUID path segments from visible breadcrumbs", () => {
  render(<Breadcrumbs />);
  expect(screen.getByRole("link", { name: "users" })).toBeInTheDocument();
  expect(screen.queryByText("11111111-1111-4111-8111-111111111111")).not.toBeInTheDocument();
});

it("keeps breadcrumb links unique when topic and lesson slugs match", () => {
  mocks.pathname = "/organ-systems/lymphatic/topics/lymphatic-system-overview-and-lymph-transport/content/lymphatic-system-overview-and-lymph-transport";
  render(<Breadcrumbs />);

  const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
  expect(new Set(hrefs).size).toBe(hrefs.length);
  expect(hrefs.at(-1)).toBe(mocks.pathname);
  expect(screen.getAllByRole("link").at(-1)).toHaveAttribute("aria-current", "page");
});

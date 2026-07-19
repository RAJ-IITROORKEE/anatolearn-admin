import { render, screen, within } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ listMedia: vi.fn() }));

vi.mock("@/features/media/service", () => ({ listMedia: mocks.listMedia }));
vi.mock("../phase3-actions", () => ({ trashMediaAction: vi.fn(), updateMediaAction: vi.fn(), uploadMediaAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams() }));

import MediaPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listMedia.mockResolvedValue({ items: [], pagination: { page: 1, pageSize: 12, total: 0, totalPages: 0 } });
});

test("keeps media search, status filtering, pagination, empty state, and header upload action", async () => {
  render(await MediaPage({ searchParams: Promise.resolve({ q: "heart", archived: "false" }) }));

  expect(screen.getByRole("heading", { name: "Media library" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Upload image" })).toBeVisible();
  expect(screen.getByRole("textbox", { name: "Search" })).toHaveValue("heart");
  expect(screen.getByRole("combobox", { name: "Status" })).toHaveValue("false");
  expect(mocks.listMedia).toHaveBeenCalledWith(expect.objectContaining({ archived: false, search: "heart" }));
  expect(screen.getByText("No media found")).toBeVisible();
  expect(within(screen.getByRole("navigation", { name: "Pagination" })).getByText(/Page/).parentElement).toHaveTextContent("Page 1 of 1");
});

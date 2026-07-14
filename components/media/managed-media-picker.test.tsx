import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";

const searchMedia = vi.fn();
vi.mock("@/app/(admin)/managed-media-actions", () => ({ searchManagedMediaAction: (...args: unknown[]) => searchMedia(...args) }));

import { ManagedMediaPicker } from "./managed-media-picker";

test("searches current managed media and stores the selected UUID in a hidden field", async () => {
  searchMedia.mockResolvedValue({
    items: [
      { id: "550e8400-e29b-41d4-a716-446655440000", originalFilename: "heart.png", mimeType: "image/png", altText: "Heart anatomy", signedUrl: "https://signed.example/heart" },
      { id: "550e8400-e29b-41d4-a716-446655440001", originalFilename: "lungs.webp", mimeType: "image/webp", altText: "Lung anatomy", signedUrl: null },
    ],
    pagination: { page: 1, totalPages: 1 },
  });
  const user = userEvent.setup();
  const { container } = render(<ManagedMediaPicker label="Question image" name="mediaId" />);

  await user.click(screen.getByRole("button", { name: "Choose Question image" }));
  await user.type(screen.getByRole("searchbox", { name: "Search managed media" }), "heart");
  await user.click(screen.getByRole("button", { name: "Search" }));
  expect(searchMedia).toHaveBeenLastCalledWith({ page: 1, search: "heart" });
  expect(await screen.findByText("Preview temporarily unavailable")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /Select heart.png/i }));
  expect(container.querySelector('input[name="mediaId"]')).toHaveValue("550e8400-e29b-41d4-a716-446655440000");
  expect(screen.getByText("Heart anatomy")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Choose Question image" }));
  expect(screen.getByRole("searchbox", { name: "Search managed media" })).toHaveValue("");
  expect(searchMedia).toHaveBeenLastCalledWith({
    page: 1,
    search: "",
    selectedId: "550e8400-e29b-41d4-a716-446655440000",
  });
  await user.click(screen.getByRole("button", { name: "Close media picker" }));

  await user.click(screen.getByRole("button", { name: "Clear Question image" }));
  expect(container.querySelector('input[name="mediaId"]')).toHaveValue("");
});

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { DirectImageInput } from "./direct-image-input";

const createObjectURL = vi.fn();
const revokeObjectURL = vi.fn();

beforeEach(() => {
  createObjectURL.mockReset();
  revokeObjectURL.mockReset();
  createObjectURL.mockReturnValueOnce("blob:first").mockReturnValueOnce("blob:second");
  vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
});

test("shows a compact signed existing image and only offers clear when an image exists", () => {
  const { rerender } = render(
    <DirectImageInput
      altTextName="coverAltText"
      clearName="clearCover"
      existingAltText="Heart illustration"
      existingMediaId="10000000-0000-4000-8000-000000000001"
      existingPreviewUrl="https://signed.example/heart.png"
      fileName="coverFile"
      label="Cover image"
      mediaIdName="coverMediaId"
    />,
  );

  expect(screen.getByRole("img", { name: "Heart illustration" })).toHaveAttribute("src", "https://signed.example/heart.png");
  expect(screen.getByRole("img", { name: "Heart illustration" }).parentElement).toHaveClass("h-24", "w-24");
  expect(screen.getByRole("checkbox", { name: "Remove the existing image" })).toBeInTheDocument();

  rerender(
    <DirectImageInput
      altTextName="coverAltText"
      clearName="clearCover"
      fileName="coverFile"
      label="Cover image"
      mediaIdName="coverMediaId"
    />,
  );
  expect(screen.queryByRole("checkbox", { name: "Remove the existing image" })).not.toBeInTheDocument();
});

test("revokes each local object URL once when replaced or unmounted", () => {
  const { unmount } = render(
    <DirectImageInput altTextName="coverAltText" fileName="coverFile" label="Cover image" />,
  );
  const input = document.querySelector('input[name="coverFile"]') as HTMLInputElement;
  const first = new File(["first"], "first.png", { type: "image/png" });
  const second = new File(["second"], "second.png", { type: "image/png" });

  fireEvent.change(input, { target: { files: [first] } });
  expect(screen.getByRole("img", { name: "Local preview of first.png" })).toBeVisible();
  fireEvent.change(input, { target: { files: [second] } });

  expect(revokeObjectURL).toHaveBeenCalledTimes(1);
  expect(revokeObjectURL).toHaveBeenCalledWith("blob:first");
  unmount();
  expect(revokeObjectURL).toHaveBeenCalledTimes(2);
  expect(revokeObjectURL).toHaveBeenLastCalledWith("blob:second");
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";

vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:preview"), revokeObjectURL: vi.fn() });

import { UploadMediaForm } from "./upload-media-form";

test("shows an accessible local image preview before upload", async () => {
  const user = userEvent.setup();
  render(<UploadMediaForm action={vi.fn()} />);
  await user.upload(screen.getByLabelText("Image file"), new File(["image"], "heart.png", { type: "image/png" }));
  expect(screen.getByRole("img", { name: "Local preview of heart.png" })).toHaveAttribute("src", "blob:preview");
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";

const urlMocks = {
  createObjectURL: vi.fn(() => "blob:preview"),
  revokeObjectURL: vi.fn(),
};

vi.stubGlobal("URL", urlMocks);
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { UploadMediaDialog, UploadMediaForm } from "./upload-media-form";

beforeEach(() => {
  vi.clearAllMocks();
});

test("shows local preview and derives client metadata before saving", async () => {
  const user = userEvent.setup();
  render(<UploadMediaForm action={vi.fn()} />);
  const file = new File([new Uint8Array(1536)], "heart.png", { type: "image/png" });

  await user.upload(screen.getByLabelText("Image file"), file);

  expect(screen.getByText("heart.png")).toBeVisible();
  expect(screen.getByText("1.5 KB")).toBeVisible();
  expect(screen.getByText("image/png")).toBeVisible();
  expect(screen.getByRole("img", { name: "Local preview of heart.png" })).toHaveAttribute("src", "blob:preview");

  const preview = screen.getByRole("img", { name: "Local preview of heart.png" });
  Object.defineProperty(preview, "naturalWidth", { configurable: true, value: 1200 });
  Object.defineProperty(preview, "naturalHeight", { configurable: true, value: 800 });
  fireEvent.load(preview);

  expect(screen.getByText("1200 x 800")).toBeVisible();
});

test("replaces a picked image by drop and submits exactly one file field", async () => {
  const user = userEvent.setup();
  const action = vi.fn().mockResolvedValue({ success: "Image uploaded." });
  const pickedFile = new File(["old image"], "old-heart.png", { type: "image/png" });
  const droppedFile = new File(["new image"], "heart.webp", { type: "image/webp" });
  render(<UploadMediaForm action={action} />);

  await user.upload(screen.getByLabelText("Image file"), pickedFile);
  fireEvent.drop(screen.getByTestId("media-drop-zone"), { dataTransfer: { files: [droppedFile] } });
  await user.type(screen.getByLabelText("Alt text Optional"), "Four chambers of the heart");
  await user.click(screen.getByRole("button", { name: "Save image" }));

  await waitFor(() => expect(action).toHaveBeenCalledOnce());
  const formData = action.mock.calls[0]?.[1] as FormData;
  const fileEntries = [...formData.entries()].filter(([, value]) => value instanceof File);
  expect(fileEntries).toEqual([["file", droppedFile]]);
  expect(formData.getAll("file")).toEqual([droppedFile]);
  expect(formData.has("fileSelection")).toBe(false);
  expect(formData.get("altText")).toBe("Four chambers of the heart");
});

test("opens upload in an accessible dialog", async () => {
  const user = userEvent.setup();
  render(<UploadMediaDialog action={vi.fn()} />);

  await user.click(screen.getByRole("button", { name: "Upload image" }));

  expect(screen.getByRole("dialog", { name: "Upload image" })).toBeVisible();
  expect(screen.getByText("PNG, JPEG, or WebP up to the configured upload limit.")).toBeVisible();
});

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { MediaLibrary } from "./media-library";

const item = {
  id: "10000000-0000-4000-8000-000000000001",
  originalFilename: "heart-anatomy.png",
  mimeType: "image/png",
  byteSize: "1536",
  width: 1200,
  height: 800,
  altText: "Anterior view of the four heart chambers",
  archivedAt: null,
  createdAt: new Date("2026-07-19T08:00:00.000Z"),
  updatedAt: new Date("2026-07-20T12:30:00.000Z"),
  uploadedById: "20000000-0000-4000-8000-000000000002",
  signedUrl: "https://storage.example/heart?token=temporary",
  signedUrlExpiresIn: 900,
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

test("renders complete media data in a semantic desktop table and equivalent mobile card", () => {
  render(<MediaLibrary items={[item]} trashAction={vi.fn()} updateAction={vi.fn()} />);

  const table = screen.getByRole("table", { name: "Media library assets" });
  const headers = within(table).getAllByRole("columnheader").map((header) => header.textContent?.trim());
  expect(headers).toEqual(["Image", "File and alt text", "Updated", "Size", "Dimensions", "Type", "Status", "Actions"]);
  expect(within(table).getByRole("img", { name: "Preview of heart-anatomy.png" })).toHaveClass("size-14");
  expect(screen.getAllByText("heart-anatomy.png")).toHaveLength(2);
  expect(screen.getAllByText("Anterior view of the four heart chambers")).toHaveLength(2);
  expect(screen.getAllByText(/Jul 20, 2026/).length).toBeGreaterThan(0);
  expect(screen.getAllByText("1.5 KB")).toHaveLength(2);
  expect(screen.getAllByText("1200 x 800")).toHaveLength(2);
  expect(screen.getAllByText("image/png")).toHaveLength(2);
  expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
});

test("handles missing signed previews and legacy dimensions without hiding metadata", () => {
  render(<MediaLibrary items={[{ ...item, signedUrl: null, signedUrlExpiresIn: null, width: null, height: null }]} trashAction={vi.fn()} updateAction={vi.fn()} />);

  expect(screen.getAllByText("Preview unavailable").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Unknown")).toHaveLength(2);
  expect(screen.getAllByRole("button", { name: "Copy signed URL for heart-anatomy.png" })[0]).toBeDisabled();
});

test("opens an accessible image preview dialog with metadata", async () => {
  const user = userEvent.setup();
  render(<MediaLibrary items={[item]} trashAction={vi.fn()} updateAction={vi.fn()} />);

  await user.click(screen.getAllByRole("button", { name: "View heart-anatomy.png" })[0]);

  const dialog = screen.getByRole("dialog", { name: "Preview heart-anatomy.png" });
  expect(within(dialog).getByRole("img", { name: item.altText })).toHaveAttribute("src", item.signedUrl);
  expect(within(dialog).getByText("1.5 KB")).toBeVisible();
  expect(within(dialog).getByText("1200 x 800")).toBeVisible();
  expect(within(dialog).getByText("image/png")).toBeVisible();
});

test("edits optional alt text in an accessible dialog", async () => {
  const user = userEvent.setup();
  const updateAction = vi.fn().mockResolvedValue({ success: "Alt text updated." });
  render(<MediaLibrary items={[item]} trashAction={vi.fn()} updateAction={updateAction} />);

  await user.click(screen.getAllByRole("button", { name: "Edit alt text for heart-anatomy.png" })[0]);
  const dialog = screen.getByRole("dialog", { name: "Edit alt text" });
  const altText = within(dialog).getByRole("textbox", { name: "Alt text Optional" });
  await user.clear(altText);
  await user.type(altText, "Updated heart anatomy description");
  await user.click(within(dialog).getByRole("button", { name: "Save alt text" }));

  await waitFor(() => expect(updateAction).toHaveBeenCalledOnce());
  const formData = updateAction.mock.calls[0]?.[2] as FormData;
  expect(formData.get("altText")).toBe("Updated heart anatomy description");
});

test("copies the server-signed URL with clear 15-minute expiry guidance", async () => {
  const user = userEvent.setup();
  const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
  render(<MediaLibrary items={[item]} trashAction={vi.fn()} updateAction={vi.fn()} />);

  await user.click(screen.getAllByRole("button", { name: "Copy signed URL for heart-anatomy.png" })[0]);

  expect(writeText).toHaveBeenCalledWith(item.signedUrl);
  expect(screen.getByRole("status")).toHaveTextContent("Copied secure temporary URL. It expires 15 minutes after generation.");
});

test("moves current media to recoverable Trash only after confirmation", async () => {
  const user = userEvent.setup();
  const trashAction = vi.fn().mockResolvedValue({ success: "Moved to Trash." });
  render(<MediaLibrary items={[item]} trashAction={trashAction} updateAction={vi.fn()} />);

  await user.click(screen.getAllByRole("button", { name: "Delete heart-anatomy.png" })[0]);
  expect(screen.getByRole("alertdialog", { name: "Move image to Trash?" })).toHaveTextContent("restored from Settings > Trash for 30 days");
  await user.click(screen.getByRole("button", { name: "Move to Trash" }));

  await waitFor(() => expect(trashAction).toHaveBeenCalledOnce());
});

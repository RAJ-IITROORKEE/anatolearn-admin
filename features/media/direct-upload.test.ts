import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  uploadMedia: vi.fn(),
  archiveMedia: vi.fn(),
}));

vi.mock("./service", () => mocks);

import {
  cleanupDirectUploads,
  directUploadContext,
  formBoolean,
  formNullable,
  formNumber,
  formValue,
  resolveMediaField,
} from "./direct-upload";

describe("direct upload helpers", () => {
  it("normalizes common multipart form values", () => {
    const data = new FormData();
    data.set("text", "  value  ");
    data.set("number", "12");
    data.set("enabled", "on");

    expect(formValue(data, "text")).toBe("value");
    expect(formNullable(data, "missing")).toBeNull();
    expect(formNumber(data, "number")).toBe(12);
    expect(formBoolean(data, "enabled")).toBe(true);
    expect(formBoolean(data, "missing")).toBe(false);
  });

  it("retains or clears an existing media ID without uploading", async () => {
    const context = directUploadContext("actor", "request");
    const data = new FormData();

    await expect(resolveMediaField(data, { fileKey: "file", altText: "ignored", existingId: "media-id" }, context)).resolves.toBe("media-id");
    await expect(resolveMediaField(data, { fileKey: "file", altText: "ignored", existingId: "media-id", clear: true }, context)).resolves.toBeNull();
    expect(mocks.uploadMedia).not.toHaveBeenCalled();
  });

  it("uploads a replacement, validates alt text, and tracks the new ID", async () => {
    mocks.uploadMedia.mockResolvedValueOnce({ id: "new-media-id" });
    const context = directUploadContext("actor", "request");
    const data = new FormData();
    data.set("file", new File(["image"], "cover.png", { type: "image/png" }));

    await expect(resolveMediaField(data, { fileKey: "file", altText: "  Cover image  " }, context)).resolves.toBe("new-media-id");
    expect(mocks.uploadMedia).toHaveBeenCalledWith(expect.any(File), "Cover image", "actor", "request");
    expect(context.uploadedMediaIds).toEqual(["new-media-id"]);
  });

  it("uploads an image when optional alt text is blank", async () => {
    mocks.uploadMedia.mockResolvedValueOnce({ id: "unlabeled-media-id" });
    const context = directUploadContext("actor", "request");
    const data = new FormData();
    data.set("file", new File(["image"], "icon.png", { type: "image/png" }));

    await expect(resolveMediaField(data, { fileKey: "file", altText: "" }, context)).resolves.toBe("unlabeled-media-id");
    expect(mocks.uploadMedia).toHaveBeenCalledWith(expect.any(File), "", "actor", "request");
  });

  it("archives tracked uploads during parent-mutation cleanup", async () => {
    const context = directUploadContext("actor", "request");
    context.uploadedMediaIds.push("media-one", "media-two");

    await cleanupDirectUploads(context);

    expect(mocks.archiveMedia).toHaveBeenNthCalledWith(1, "media-one", "actor", "request");
    expect(mocks.archiveMedia).toHaveBeenNthCalledWith(2, "media-two", "actor", "request");
  });
});

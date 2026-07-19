import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  archiveMedia: vi.fn(),
  createContent: vi.fn(),
  resolveRequestIdentity: vi.fn(),
  updateContent: vi.fn(),
  uploadMedia: vi.fn(),
}));

vi.mock("@/lib/auth/request", () => ({
  hasRole: (identity: { profile: { role: string } }, role: string) => identity.profile.role === role,
  resolveRequestIdentity: mocks.resolveRequestIdentity,
}));
vi.mock("@/features/content/service", () => ({
  createContent: mocks.createContent,
  getAdmin: vi.fn(),
  listAdmin: vi.fn(),
  reorderContent: vi.fn(),
  setStatus: vi.fn(),
  updateContent: mocks.updateContent,
}));
vi.mock("@/features/media/service", () => ({
  archiveMedia: mocks.archiveMedia,
  uploadMedia: mocks.uploadMedia,
}));
vi.mock("@/features/trash/service", () => ({ moveToTrash: vi.fn() }));

import { POST } from "./route";
import { PATCH } from "./[id]/route";

const actorId = "10000000-0000-4000-8000-000000000001";
const topicId = "20000000-0000-4000-8000-000000000002";
const lessonId = "30000000-0000-4000-8000-000000000003";
const uploadId = "40000000-0000-4000-8000-000000000004";
const mediaId = "50000000-0000-4000-8000-000000000005";
const identity = { profile: { id: actorId, role: "ADMIN" }, user: {}, mode: "bearer" };

function richLessonForm(overrides?: { uploadIds?: string[] }) {
  const uploadIds = overrides?.uploadIds ?? [uploadId];
  const data = new FormData();
  data.set("topicId", topicId);
  data.set("title", "Rich heart lesson");
  data.set("slug", "rich-heart-lesson");
  data.set("summary", "Rich content");
  data.set("estimatedReadingMinutes", "3");
  data.set("displayOrder", "0");
  data.set("contentBlocks", JSON.stringify({
    version: 2,
    richContent: {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Heart anatomy" }] },
        ...uploadIds.map((id, index) => ({
          type: "image",
          attrs: { uploadId: id, alt: `Heart image ${index + 1}`, caption: null, legacyId: id },
        })),
      ],
    },
    fallbackBlocks: [{ type: "paragraph", text: "Client-supplied stale fallback" }],
  }));
  uploadIds.forEach((id, index) => {
    data.set(`lessonFile.${id}`, new File([`image-${index}`], `heart-${index}.png`, { type: "image/png" }));
  });
  return data;
}

function multipartRequest(url: string, method: "POST" | "PATCH", data: FormData) {
  return {
    url,
    method,
    headers: new Headers({ "content-type": "multipart/form-data; boundary=test" }),
    formData: async () => data,
  } as Request;
}

function expectResolvedRichContent(input: { contentBlocks: unknown }, expectedMediaId = mediaId) {
  expect(input.contentBlocks).toMatchObject({
    version: 2,
    richContent: {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Heart anatomy" }] },
        { type: "image", attrs: { mediaId: expectedMediaId, alt: "Heart image 1", caption: null, legacyId: uploadId } },
      ],
    },
    fallbackBlocks: [
      { type: "paragraph", text: "Heart anatomy" },
      { id: uploadId, type: "image", mediaId: expectedMediaId, altText: "Heart image 1", caption: null },
    ],
  });
  expect(JSON.stringify(input.contentBlocks)).not.toContain('"uploadId"');
  expect(JSON.stringify(input.contentBlocks)).not.toContain("Client-supplied stale fallback");
}

describe("admin content lesson rich multipart routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveRequestIdentity.mockResolvedValue(identity);
    mocks.uploadMedia.mockResolvedValue({ id: mediaId });
    mocks.createContent.mockResolvedValue({ id: lessonId });
    mocks.updateContent.mockResolvedValue({ id: lessonId });
  });

  it("creates a rich lesson by resolving upload IDs and regenerating its fallback", async () => {
    const response = await POST(multipartRequest(
      "https://admin.example/api/v1/admin/content-lessons",
      "POST",
      richLessonForm(),
    ));

    expect(response.status).toBe(201);
    expect(mocks.uploadMedia).toHaveBeenCalledWith(expect.any(File), "Heart image 1", actorId, expect.any(String));
    expectResolvedRichContent(mocks.createContent.mock.calls[0][1]);
  });

  it("updates a rich lesson through the item route using the same multipart contract", async () => {
    const response = await PATCH(
      multipartRequest(`https://admin.example/api/v1/admin/content-lessons/${lessonId}`, "PATCH", richLessonForm()),
      { params: Promise.resolve({ id: lessonId }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.updateContent).toHaveBeenCalledWith(
      "contentLesson",
      lessonId,
      expect.any(Object),
      expect.objectContaining({ actorId }),
    );
    expectResolvedRichContent(mocks.updateContent.mock.calls[0][2]);
  });

  it("archives a rich upload when the parent mutation fails", async () => {
    mocks.createContent.mockRejectedValueOnce(new Error("Parent write failed"));

    const response = await POST(multipartRequest(
      "https://admin.example/api/v1/admin/content-lessons",
      "POST",
      richLessonForm(),
    ));

    expect(response.status).toBe(500);
    expect(mocks.archiveMedia).toHaveBeenCalledWith(mediaId, actorId, expect.any(String));
  });

  it("archives completed rich uploads when a later image upload fails", async () => {
    const secondUploadId = "60000000-0000-4000-8000-000000000006";
    mocks.uploadMedia
      .mockResolvedValueOnce({ id: mediaId })
      .mockRejectedValueOnce(new Error("Second upload failed"));

    const response = await POST(multipartRequest(
      "https://admin.example/api/v1/admin/content-lessons",
      "POST",
      richLessonForm({ uploadIds: [uploadId, secondUploadId] }),
    ));

    expect(response.status).toBe(500);
    expect(mocks.archiveMedia).toHaveBeenCalledWith(mediaId, actorId, expect.any(String));
    expect(mocks.createContent).not.toHaveBeenCalled();
  });

  it("validates the generated fallback before uploading rich images", async () => {
    const data = richLessonForm();
    data.set("contentBlocks", JSON.stringify({
      version: 2,
      richContent: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "x".repeat(5001) }] },
          { type: "image", attrs: { uploadId, alt: "Heart image 1", caption: null } },
        ],
      },
    }));

    const response = await POST(multipartRequest(
      "https://admin.example/api/v1/admin/content-lessons",
      "POST",
      data,
    ));

    expect(response.status).toBe(400);
    expect(mocks.uploadMedia).not.toHaveBeenCalled();
    expect(mocks.createContent).not.toHaveBeenCalled();
  });
});

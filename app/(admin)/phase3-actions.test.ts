import { beforeEach, describe, expect, it, vi } from "vitest";

const systemId = "10000000-0000-4000-8000-000000000001";
const topicId = "20000000-0000-4000-8000-000000000002";
const mocks = vi.hoisted(() => ({
  requireAdminPage: vi.fn(),
  createContent: vi.fn(),
  getAdmin: vi.fn(),
  updateContent: vi.fn(),
  setStatus: vi.fn(),
  revalidatePath: vi.fn(),
  archiveMedia: vi.fn(),
  updateMedia: vi.fn(),
  uploadMedia: vi.fn(),
  moveToTrash: vi.fn(),
  restoreFromTrash: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/session", () => ({ requireAdminPage: mocks.requireAdminPage }));
vi.mock("@/features/content/service", () => ({ createContent: mocks.createContent, getAdmin: mocks.getAdmin, setStatus: mocks.setStatus, updateContent: mocks.updateContent }));
vi.mock("@/features/media/service", () => ({ archiveMedia: mocks.archiveMedia, updateMedia: mocks.updateMedia, uploadMedia: mocks.uploadMedia }));
vi.mock("@/features/trash/service", () => ({ moveToTrash: mocks.moveToTrash, restoreFromTrash: mocks.restoreFromTrash }));

import { createResource, trashListResourceAction, trashResourceAction, updateResource } from "./phase3-actions";

function topicFormData(slug = "heart-anatomy") {
  const data = new FormData();
  data.set("organSystemId", systemId);
  data.set("title", "Heart anatomy");
  data.set("slug", slug);
  data.set("summary", "Structure of the heart.");
  data.set("displayOrder", "0");
  return data;
}

describe("topic server-action navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminPage.mockResolvedValue({ profile: { id: crypto.randomUUID() } });
    mocks.getAdmin.mockResolvedValue({ id: systemId, slug: "circulatory" });
  });

  it("lands a created topic on its readable canonical route", async () => {
    mocks.createContent.mockResolvedValue({ id: topicId, organSystemId: systemId, organSystemSlug: "circulatory", slug: "heart-anatomy" });

    await expect(createResource("topic", {}, topicFormData())).resolves.toMatchObject({
      success: "Topic created.",
      redirectTo: "/organ-systems/circulatory/topics/heart-anatomy",
    });
  });

  it("lands an updated topic on the route for its resulting slugs", async () => {
    mocks.updateContent.mockResolvedValue({ id: topicId, organSystemId: systemId, organSystemSlug: "circulatory", slug: "cardiac-anatomy" });

    await expect(updateResource("topic", topicId, {}, topicFormData("cardiac-anatomy"))).resolves.toMatchObject({
      success: "Changes saved.",
      redirectTo: "/organ-systems/circulatory/topics/cardiac-anatomy",
    });
  });
});

describe("rich lesson image resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminPage.mockResolvedValue({ profile: { id: crypto.randomUUID() } });
    mocks.createContent.mockImplementation((_resource, input) => ({ id: crypto.randomUUID(), ...input }));
    mocks.uploadMedia.mockResolvedValue({ id: "30000000-0000-4000-8000-000000000003" });
  });

  it("resolves dropped files through their stable multipart names and stores only managed media IDs", async () => {
    const uploadId = "40000000-0000-4000-8000-000000000004";
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
          { type: "paragraph", content: [{ type: "text", text: "Heart" }] },
          { type: "image", attrs: { uploadId, alt: "Dropped heart", caption: null, legacyId: uploadId } },
        ],
      },
    }));
    data.set(`lessonFile.${uploadId}`, new File(["image"], "heart.png", { type: "image/png" }));

    await expect(createResource("contentLesson", {}, data)).resolves.toMatchObject({ success: "Lesson created." });

    const stored = mocks.createContent.mock.calls[0][1].contentBlocks;
    expect(stored.version).toBe(2);
    expect(JSON.stringify(stored)).toContain("30000000-0000-4000-8000-000000000003");
    expect(JSON.stringify(stored)).not.toContain('"uploadId"');
    expect(JSON.stringify(stored)).not.toContain("blob:");
    expect(stored.fallbackBlocks).toContainEqual(expect.objectContaining({ type: "image", mediaId: "30000000-0000-4000-8000-000000000003" }));
  });

  it("validates generated fallback limits before starting an upload", async () => {
    const uploadId = "40000000-0000-4000-8000-000000000004";
    const data = lessonFormData({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "x".repeat(5001) }] },
        { type: "image", attrs: { uploadId, alt: "Should not upload", caption: null } },
      ],
    });
    data.set(`lessonFile.${uploadId}`, new File(["image"], "heart.png", { type: "image/png" }));

    await expect(createResource("contentLesson", {}, data)).resolves.toHaveProperty("error");
    expect(mocks.uploadMedia).not.toHaveBeenCalled();
    expect(mocks.createContent).not.toHaveBeenCalled();
  });

  it("resolves rich uploads sequentially so a later failure cleans up every completed upload", async () => {
    const firstUploadId = "40000000-0000-4000-8000-000000000004";
    const secondUploadId = "50000000-0000-4000-8000-000000000005";
    const firstMediaId = "60000000-0000-4000-8000-000000000006";
    let firstFinished = false;
    mocks.uploadMedia
      .mockImplementationOnce(async () => {
        await Promise.resolve();
        firstFinished = true;
        return { id: firstMediaId };
      })
      .mockImplementationOnce(async () => {
        if (!firstFinished) throw new Error("Uploads ran in parallel");
        throw new Error("Second upload failed");
      });
    const data = lessonFormData({
      type: "doc",
      content: [
        { type: "image", attrs: { uploadId: firstUploadId, alt: "First", caption: null } },
        { type: "image", attrs: { uploadId: secondUploadId, alt: "Second", caption: null } },
      ],
    });
    data.set(`lessonFile.${firstUploadId}`, new File(["first"], "first.png", { type: "image/png" }));
    data.set(`lessonFile.${secondUploadId}`, new File(["second"], "second.png", { type: "image/png" }));

    await expect(createResource("contentLesson", {}, data)).resolves.toHaveProperty("error");
    expect(mocks.archiveMedia).toHaveBeenCalledWith(firstMediaId, expect.any(String), expect.any(String));
  });
});

function lessonFormData(richContent: unknown) {
  const data = new FormData();
  data.set("topicId", topicId);
  data.set("title", "Rich heart lesson");
  data.set("slug", "rich-heart-lesson");
  data.set("summary", "Rich content");
  data.set("estimatedReadingMinutes", "3");
  data.set("displayOrder", "0");
  data.set("contentBlocks", JSON.stringify({ version: 2, richContent }));
  return data;
}

describe("content Trash navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminPage.mockResolvedValue({ profile: { id: crypto.randomUUID() } });
    mocks.moveToTrash.mockResolvedValue({});
  });

  it.each([
    ["organ-system", systemId, "/organ-systems"],
    ["topic", topicId, "/topics"],
  ] as const)("redirects a deleted %s detail to its list and revalidates Trash", async (type, id, destination) => {
    await expect(trashResourceAction(type, id, {})).resolves.toEqual({
      success: "Moved to Trash.",
      redirectTo: destination,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith(destination);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/settings/trash");
  });

  it("revalidates a topic list deletion without replacing its filtered URL", async () => {
    await expect(trashListResourceAction("topic", topicId, {})).resolves.toEqual({ success: "Moved to Trash." });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/topics");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/settings/trash");
  });
});

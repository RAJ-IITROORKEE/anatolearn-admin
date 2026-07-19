import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ContentError } from "@/features/content/domain";

const lessonId = "00000003-0000-4000-8000-000000000001";
const mocks = vi.hoisted(() => ({
  getAdmin: vi.fn(),
  getAdminMediaMap: vi.fn(),
  listAdmin: vi.fn(),
  notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/components/app-shell/page-header", () => ({ PageHeader: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock("@/components/phase3/action-form", () => ({ InlineAction: () => null }));
vi.mock("@/components/phase3/admin-ui", () => ({ StatusBadge: () => null }));
vi.mock("@/components/phase3/data", () => ({ getAdmin: mocks.getAdmin, listAdmin: mocks.listAdmin }));
vi.mock("@/components/phase3/resource-forms", () => ({
  LessonForm: ({ existingMedia }: { existingMedia: Record<string, { signedUrl: string }> }) => (
    <div>Lesson editor {existingMedia["lesson-media"]?.signedUrl}</div>
  ),
}));
vi.mock("@/features/media/service", () => ({ getAdminMediaMap: mocks.getAdminMediaMap }));
vi.mock("../phase3-actions", () => ({ changeResourceStatus: vi.fn(), trashResourceAction: vi.fn(), updateResource: vi.fn() }));

import ContentDetailPage from "./[id]/page";

const lesson = {
  id: lessonId,
  topicId: "00000002-0000-4000-8000-000000000001",
  title: "Heart anatomy",
  slug: "heart-anatomy",
  summary: null,
  contentBlocks: [{ type: "image", mediaId: "lesson-media", altText: "Heart" }],
  estimatedReadingMinutes: 5,
  displayOrder: 0,
  status: "DRAFT",
};

describe("content detail page routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAdmin.mockResolvedValue(lesson);
    mocks.listAdmin.mockResolvedValue({ items: [], pagination: { page: 1, pageSize: 100, total: 0, totalPages: 0 } });
    mocks.getAdminMediaMap.mockResolvedValue(new Map([
      ["lesson-media", { signedUrl: "https://signed.example/lesson" }],
    ]));
  });

  it("returns not found for an invalid UUID without querying content", async () => {
    await expect(ContentDetailPage({ params: Promise.resolve({ id: "not-a-uuid" }) })).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mocks.getAdmin).not.toHaveBeenCalled();
  });

  it("maps the known content NOT_FOUND response to not found", async () => {
    mocks.getAdmin.mockRejectedValue(new ContentError("NOT_FOUND", "Content was not found.", 404));

    await expect(ContentDetailPage({ params: Promise.resolve({ id: lessonId }) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.notFound).toHaveBeenCalledOnce();
  });

  it("resolves the seeded lesson UUID and passes signed block media to the editor", async () => {
    render(await ContentDetailPage({ params: Promise.resolve({ id: lessonId }) }));

    expect(mocks.getAdmin).toHaveBeenCalledWith("contentLesson", lessonId);
    expect(mocks.getAdminMediaMap).toHaveBeenCalledWith(["lesson-media"]);
    expect(screen.getByRole("heading", { name: "Heart anatomy" })).toBeVisible();
    expect(screen.getByText(/https:\/\/signed\.example\/lesson/)).toBeVisible();
  });

  it("propagates invalid stored content to the error boundary", async () => {
    const error = new ContentError("INVALID_STORED_CONTENT", "Invalid stored lesson.", 500);
    mocks.getAdmin.mockRejectedValue(error);

    await expect(ContentDetailPage({ params: Promise.resolve({ id: lessonId }) })).rejects.toBe(error);
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it("propagates unexpected database failures to the error boundary", async () => {
    const error = new Error("database unavailable");
    mocks.getAdmin.mockRejectedValue(error);

    await expect(ContentDetailPage({ params: Promise.resolve({ id: lessonId }) })).rejects.toBe(error);
    expect(mocks.notFound).not.toHaveBeenCalled();
  });
});
